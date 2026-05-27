import CacheManager from '../cache';
import { logger } from '../../utils/errorLogger';
import { apiRequestWithRetry, getUserFriendlyErrorMessage } from '../../utils/networkUtils';
import { rethrowIfAuthError, getUserAgent, parseJsonResponse } from './helpers';
import {
  ApiState,
  ServicesInfo,
  CreditPackage,
  RecentMediaItem,
  RecentActivityItem,
  PaymentHistoryItem,
} from './types';

export async function getCredits(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
): Promise<{ success: boolean; credits?: number; error?: string }> {
  try {
    const result = await apiRequestWithRetry(async () => {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Api-Key': state.apiKey || '',
        'User-Agent': getUserAgent(),
      };

      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }

      const response = await fetch(getAIUrl('/credits'), {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).responseText = await response.text().catch(() => '');
        throw error;
      }

      const responseData = await parseJsonResponse(response);
      logger.debug(3, 'API', 'Credits response:', responseData);

      return {
        success: true,
        credits: responseData.data?.credits || responseData.credits || 0,
      };
    }, 'Get Credits', 3);

    return result;
  } catch (error: any) {
    rethrowIfAuthError(error);
    logger.error('API', 'Error fetching credits after retries:', error);
    return {
      success: false,
      error: getUserFriendlyErrorMessage(error),
    };
  }
}

export async function getServicesInfo(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
): Promise<{ success: boolean; data?: ServicesInfo; error?: string }> {
  const cacheKey = 'services_info';
  const cached = CacheManager.get<ServicesInfo>(cacheKey);

  if (cached) {
    logger.debug(2, 'API', 'Using cached services info');
    return { success: true, data: cached };
  }

  if (!state.apiKey) {
    const error = 'API Key is required to fetch services info';
    logger.error('API', error);
    return { success: false, error };
  }

  try {
    const result = await apiRequestWithRetry(async () => {
      logger.debug(2, 'API', 'Fetching services info from API...');

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Api-Key': state.apiKey || '',
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
      };

      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }

      const response = await fetch(getAIUrl('/info/services'), {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).responseText = await response.text().catch(() => '');
        throw error;
      }

      const responseData = await parseJsonResponse(response);
      logger.debug(3, 'API', 'Services info response:', responseData);

      const data: ServicesInfo = responseData.data || responseData;

      CacheManager.set(cacheKey, data);
      logger.debug(2, 'API', 'Services info cached successfully');

      return {
        success: true,
        data,
      };
    }, 'Get Services Info', 3);

    return result;
  } catch (error: any) {
    rethrowIfAuthError(error);
    logger.error('API', 'Error fetching services info after retries:', error);
    return {
      success: false,
      error: getUserFriendlyErrorMessage(error),
    };
  }
}

export async function getCreditPackages(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
  email?: string,
): Promise<{ success: boolean; data?: CreditPackage[]; error?: string }> {
  const cacheKey = `credit_packages_${email || 'default'}`;
  const cached = CacheManager.get<CreditPackage[]>(cacheKey);

  if (cached) {
    logger.debug(2, 'API', 'Using cached credit packages');
    return { success: true, data: cached };
  }

  try {
    logger.debug(2, 'API', 'Fetching credit packages');
    const result = await apiRequestWithRetry(async () => {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Api-Key': state.apiKey || '',
        'User-Agent': getUserAgent(),
      };

      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }

      const body = new FormData();
      if (email) {
        body.append('email', email);
      }

      const response = await fetch(getAIUrl('/credits/buy'), {
        method: 'POST',
        headers,
        body: body,
      });

      if (!response.ok) {
        const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).responseText = await response.text().catch(() => '');
        throw error;
      }

      const responseData = await parseJsonResponse(response);
      logger.debug(3, 'API', 'Credit packages response:', responseData);

      if (responseData.data && Array.isArray(responseData.data)) {
        const data = responseData.data;
        CacheManager.set(cacheKey, data);
        logger.debug(2, 'API', 'Credit packages cached successfully');

        return {
          success: true,
          data,
        };
      } else {
        throw new Error('Invalid response format - expected data array');
      }
    }, 'Get Credit Packages', 3);

    return result;
  } catch (error: any) {
    rethrowIfAuthError(error);
    logger.error('API', 'Error fetching credit packages after retries:', error);
    return {
      success: false,
      error: getUserFriendlyErrorMessage(error),
    };
  }
}

export async function getRecentMedia(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
  page: number = 1,
): Promise<{ success: boolean; data?: RecentMediaItem[]; error?: string }> {
  const cacheKey = `recent_media_page_${page}`;
  const cached = CacheManager.get<RecentMediaItem[]>(cacheKey);

  if (cached) {
    logger.debug(2, 'API', `Using cached recent media data (page ${page})`);
    return { success: true, data: cached };
  }

  if (!state.apiKey) {
    const error = 'API Key is required to fetch recent media';
    logger.error('API', error);
    return { success: false, error };
  }

  try {
    const result = await apiRequestWithRetry(async () => {
      logger.debug(2, 'API', `Fetching recent media from API (page ${page})...`);

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Api-Key': state.apiKey || '',
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
      };

      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }

      const response = await fetch(getAIUrl(`/recent_media?page=${page}`), {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).responseText = await response.text().catch(() => '');
        throw error;
      }

      const responseData = await parseJsonResponse(response);
      logger.debug(3, 'API', 'Recent media response:', responseData);

      const data: RecentMediaItem[] = responseData.data || responseData;

      CacheManager.set(cacheKey, data);
      logger.debug(2, 'API', 'Recent media cached successfully');

      return {
        success: true,
        data,
      };
    }, 'Get Recent Media', 3);

    return result;
  } catch (error: any) {
    rethrowIfAuthError(error);
    logger.error('API', 'Error fetching recent media after retries:', error);
    return {
      success: false,
      error: getUserFriendlyErrorMessage(error),
    };
  }
}

export async function getRecentActivities(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
  page: number = 1,
): Promise<{ success: boolean; data?: RecentActivityItem[]; error?: string }> {
  const cacheKey = `recent_activities_page_${page}`;
  const cached = CacheManager.get<RecentActivityItem[]>(cacheKey);

  if (cached) {
    logger.debug(2, 'API', `Using cached recent activities data (page ${page})`);
    return { success: true, data: cached };
  }

  if (!state.apiKey) {
    const error = 'API Key is required to fetch recent activities';
    logger.error('API', error);
    return { success: false, error };
  }

  try {
    const result = await apiRequestWithRetry(async () => {
      logger.debug(2, 'API', `Fetching recent activities from API (page ${page})...`);

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Api-Key': state.apiKey || '',
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
      };

      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }

      const response = await fetch(getAIUrl(`/recent_activities?page=${page}`), {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).responseText = await response.text().catch(() => '');
        throw error;
      }

      const responseData = await parseJsonResponse(response);
      logger.debug(3, 'API', 'Recent activities response:', responseData);

      const data: RecentActivityItem[] = responseData.data || responseData;

      CacheManager.set(cacheKey, data, 5 * 60 * 1000);
      logger.debug(2, 'API', 'Recent activities cached successfully (5min TTL)');

      return {
        success: true,
        data,
      };
    }, 'Get Recent Activities', 3);

    return result;
  } catch (error: any) {
    rethrowIfAuthError(error);
    logger.error('API', 'Error fetching recent activities after retries:', error);
    return {
      success: false,
      error: getUserFriendlyErrorMessage(error),
    };
  }
}

export async function getPaymentHistory(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
  page: number = 1,
): Promise<{ success: boolean; data?: PaymentHistoryItem[]; error?: string }> {
  const cacheKey = `payment_history_page_${page}`;
  const cached = CacheManager.get<PaymentHistoryItem[]>(cacheKey);

  if (cached) {
    logger.debug(2, 'API', `Using cached payment history data (page ${page})`);
    return { success: true, data: cached };
  }

  if (!state.apiKey) {
    const error = 'API Key is required to fetch payment history';
    logger.error('API', error);
    return { success: false, error };
  }

  try {
    const result = await apiRequestWithRetry(async () => {
      logger.debug(2, 'API', `Fetching payment history from API (page ${page})...`);

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Api-Key': state.apiKey || '',
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
      };

      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }

      const response = await fetch(getAIUrl(`/payment_history?page=${page}`), {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).responseText = await response.text().catch(() => '');
        throw error;
      }

      const responseData = await parseJsonResponse(response);
      logger.debug(3, 'API', 'Payment history response:', responseData);

      const data: PaymentHistoryItem[] = responseData.data || responseData;

      CacheManager.set(cacheKey, data);
      logger.debug(2, 'API', 'Payment history cached successfully');

      return {
        success: true,
        data,
      };
    }, 'Get Payment History', 3);

    return result;
  } catch (error: any) {
    rethrowIfAuthError(error);
    logger.error('API', 'Error fetching payment history after retries:', error);
    return {
      success: false,
      error: getUserFriendlyErrorMessage(error),
    };
  }
}
