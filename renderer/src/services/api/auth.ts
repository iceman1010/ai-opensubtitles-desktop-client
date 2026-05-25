import { logger } from '../../utils/errorLogger';
import { getUserFriendlyErrorMessage } from '../../utils/networkUtils';
import { getUserAgent } from './helpers';
import { ApiState } from './types';

const LOGIN_RATE_LIMIT_RETRIES = 3;
const LOGIN_RATE_LIMIT_DELAY_MS = 2000;

export async function loadCachedToken(state: ApiState): Promise<boolean> {
  try {
    const cachedToken = await window.electronAPI.getValidToken();
    if (cachedToken) {
      state.token = cachedToken;
      logger.info('API', 'Using cached authentication token');
      return true;
    }
    return false;
  } catch (error) {
    logger.error('API', 'Failed to load cached token', error);
    return false;
  }
}

export async function saveToken(token: string): Promise<void> {
  try {
    await window.electronAPI.saveToken(token);
    logger.info('API', 'Token saved to cache');
  } catch (error) {
    logger.error('API', 'Failed to save token', error);
  }
}

export async function clearCachedToken(state: ApiState): Promise<void> {
  try {
    await window.electronAPI.clearToken();
    state.token = '';
    logger.debug(2, 'API', 'Cached token cleared');
  } catch (error) {
    logger.error('API', 'Failed to clear token', error);
  }
}

export async function refreshToken(
  state: ApiState,
  tokenRefreshPromiseHolder: { promise: Promise<boolean> | null },
  doLogin: (username: string, password: string) => Promise<{ success: boolean; token?: string; error?: string }>,
): Promise<boolean> {
  if (tokenRefreshPromiseHolder.promise) {
    logger.debug(2, 'API', 'Token refresh already in progress, waiting...');
    return await tokenRefreshPromiseHolder.promise;
  }

  if (!state.username || !state.password) {
    logger.error('API', 'Cannot refresh token: no credentials stored');
    return false;
  }

  tokenRefreshPromiseHolder.promise = (async () => {
    try {
      logger.info('API', 'Refreshing token due to invalid token response');
      await clearCachedToken(state);
      const result = await doLogin(state.username, state.password);
      if (result.success) {
        logger.info('API', 'Token refresh successful');
        return true;
      }
      logger.error('API', 'Token refresh failed:', result.error);
      return false;
    } catch (error) {
      logger.error('API', 'Token refresh error:', error);
      return false;
    } finally {
      tokenRefreshPromiseHolder.promise = null;
    }
  })();

  return await tokenRefreshPromiseHolder.promise;
}

async function performLoginRequest(
  state: ApiState,
  getLoginUrl: (endpoint: string) => string,
): Promise<{ success: boolean; token?: string; user_id?: number; error?: string }> {
  const userAgent = getUserAgent();
  logger.info('API', `Attempting login with username: ${state.username}`);

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'Api-Key': state.apiKey || '',
    'Content-Type': 'application/json',
    'User-Agent': userAgent,
  };

  const response = await fetch(getLoginUrl('/login'), {
    method: 'POST',
    headers,
    body: JSON.stringify({
      username: state.username,
      password: state.password,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
    (error as any).status = response.status;
    (error as any).responseText = errorText;
    throw error;
  }

  const responseData = await response.json();
  logger.debug(2, 'API', 'Login response received', responseData);

  if (responseData.token) {
    state.token = responseData.token;
    await saveToken(state.token);
    const userId = responseData.user?.user_id;
    logger.info('API', 'Login successful, token set and cached');
    return { success: true, token: state.token, user_id: userId };
  }

  logger.error('API', 'Login failed: No token received');
  throw new Error('No token received from server');
}

export async function login(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
  getLoginUrl: (endpoint: string) => string,
): Promise<{ success: boolean; token?: string; user_id?: number; error?: string }> {
  if (!state.username || !state.password) {
    const error = 'Username and password are required';
    logger.error('API', error);
    return { success: false, error };
  }

  if (!state.apiKey) {
    const error = 'API Key is required for authentication';
    logger.error('API', error);
    return { success: false, error };
  }

  const userAgentToUse = getUserAgent();
  if (!userAgentToUse) {
    const error = 'User-Agent configuration is missing';
    logger.error('API', error);
    return { success: false, error };
  }

  let lastError: any;

  for (let attempt = 0; attempt <= LOGIN_RATE_LIMIT_RETRIES; attempt++) {
    try {
      return await performLoginRequest(state, getLoginUrl);
    } catch (error: any) {
      lastError = error;
      const status = error.status || 0;

      if (status === 429 && attempt < LOGIN_RATE_LIMIT_RETRIES) {
        logger.info('API', `Login rate limited (429), retrying in ${LOGIN_RATE_LIMIT_DELAY_MS}ms (attempt ${attempt + 1}/${LOGIN_RATE_LIMIT_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, LOGIN_RATE_LIMIT_DELAY_MS));
        continue;
      }

      if (status === 401 || status === 403) {
        throw error;
      }

      break;
    }
  }

  logger.error('API', 'Login error after retries', { error: lastError?.message });
  return {
    success: false,
    error: getUserFriendlyErrorMessage(lastError),
  };
}
