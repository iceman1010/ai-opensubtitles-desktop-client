import { logger } from './errorLogger';
import networkConfigManager from './networkConfig';
import { activityTracker } from './activityTracker';

// Export activity tracker for external access
export { activityTracker };

// Session ID cache with promise to prevent race conditions
let sessionIdCache: string | null = null;
let sessionIdPromise: Promise<string> | null = null;

/**
 * Gets the session ID from the main process (race condition safe)
 */
async function getSessionId(): Promise<string> {
  if (sessionIdCache) {
    return sessionIdCache;
  }

  // If already fetching, wait for the existing promise
  if (sessionIdPromise) {
    return sessionIdPromise;
  }

  sessionIdPromise = (async () => {
    try {
      const sessionId = await window.electronAPI.getSessionId();
      sessionIdCache = sessionId;
      return sessionId;
    } catch (error) {
      logger.error('Failed to get session ID from main process', error);
      // Fallback to random UUID
      const fallbackId = crypto.randomUUID();
      sessionIdCache = fallbackId;
      return fallbackId;
    } finally {
      sessionIdPromise = null;
    }
  })();

  return sessionIdPromise;
}

export enum NetworkErrorType {
  OFFLINE = 'offline',
  TIMEOUT = 'timeout',
  PROXY_ERROR = 'proxy_error',
  CLOUDFLARE_ERROR = 'cloudflare_error',
  SERVER_ERROR = 'server_error',
  AUTH_ERROR = 'auth_error',
  RATE_LIMIT = 'rate_limit',
  UNKNOWN = 'unknown'
}

export interface NetworkError {
  type: NetworkErrorType;
  message: string;
  originalError?: any;
  isRetryable: boolean;
}

/**
 * Checks if the error is related to network connectivity
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;
  
  // Check error message patterns
  const errorMessage = error.message?.toLowerCase() || '';
  const networkErrorPatterns = [
    'failed to fetch',
    'network error',
    'err_internet_disconnected',
    'err_network_changed',
    'err_connection_refused',
    'err_name_not_resolved',
    'err_connection_timed_out',
    'err_connection_reset'
  ];
  
  return networkErrorPatterns.some(pattern => errorMessage.includes(pattern));
}

/**
 * Categorizes network errors for better handling using configuration
 */
export function categorizeNetworkError(error: any): NetworkError {
  if (!error) {
    return {
      type: NetworkErrorType.UNKNOWN,
      message: networkConfigManager.getUserMessage('unknown'),
      isRetryable: false
    };
  }

  const errorMessage = error.message?.toLowerCase() || '';
  const responseText = error.responseText?.toLowerCase() || '';
  const status = error.status || 0;
  const config = networkConfigManager.getConfig();
  
  // Check each error type from configuration
  for (const [errorTypeName, errorConfig] of Object.entries(config.errorTypes)) {
    if (!errorConfig.enabled) continue;
    
    // Check status codes
    if (errorConfig.statusCodes.length > 0 && errorConfig.statusCodes.includes(status)) {
      return createNetworkError(errorTypeName, error, errorConfig.maxRetries > 0);
    }
    
    // Check keywords in error message or response text
    if (errorConfig.keywords.length > 0) {
      const hasKeyword = errorConfig.keywords.some(keyword => 
        errorMessage.includes(keyword.toLowerCase()) || 
        responseText.includes(keyword.toLowerCase())
      );
      
      if (hasKeyword) {
        return createNetworkError(errorTypeName, error, errorConfig.maxRetries > 0);
      }
    }
  }
  
  // Special case: check if navigator is offline
  if (!navigator.onLine) {
    return createNetworkError('offlineErrors', error, true);
  }
  
  // Default to unknown error
  return {
    type: NetworkErrorType.UNKNOWN,
    message: networkConfigManager.getUserMessage('unknown'),
    originalError: error,
    isRetryable: false
  };
}

/**
 * Creates a NetworkError object from configuration
 */
function createNetworkError(errorTypeName: string, originalError: any, isRetryable: boolean): NetworkError {
  // Map config error type names to enum values
  const typeMapping: { [key: string]: NetworkErrorType } = {
    'rateLimitErrors': NetworkErrorType.RATE_LIMIT,
    'cloudflareErrors': NetworkErrorType.CLOUDFLARE_ERROR,
    'proxyErrors': NetworkErrorType.PROXY_ERROR,
    'serverErrors': NetworkErrorType.SERVER_ERROR,
    'timeoutErrors': NetworkErrorType.TIMEOUT,
    'offlineErrors': NetworkErrorType.OFFLINE,
    'authErrors': NetworkErrorType.AUTH_ERROR
  };
  
  const messageMapping: { [key: string]: string } = {
    'rateLimitErrors': 'rateLimited',
    'cloudflareErrors': 'cloudflare',
    'proxyErrors': 'proxy',
    'serverErrors': 'server',
    'timeoutErrors': 'timeout',
    'offlineErrors': 'offline',
    'authErrors': 'auth'
  };
  
  const errorType = typeMapping[errorTypeName] || NetworkErrorType.UNKNOWN;
  const messageKey = messageMapping[errorTypeName] || 'unknown';
  
  return {
    type: errorType,
    message: networkConfigManager.getUserMessage(messageKey),
    originalError: originalError,
    isRetryable: isRetryable
  };
}

/**
 * Checks if the error is a CloudFlare error
 */
function isCloudFlareError(error: any): boolean {
  const status = error.status || 0;
  const errorMessage = error.message?.toLowerCase() || '';
  const responseText = error.responseText?.toLowerCase() || '';
  
  // CloudFlare specific status codes
  const cloudFlareStatuses = [
    520, // Web Server Returned an Unknown Error
    521, // Web Server Is Down
    522, // Connection Timed Out
    523, // Origin Is Unreachable
    524, // A Timeout Occurred
    525, // SSL Handshake Failed
    526, // Invalid SSL Certificate
    527, // Railgun Error
    530, // Origin DNS Error
  ];
  
  if (cloudFlareStatuses.includes(status)) {
    return true;
  }
  
  // Check for CloudFlare in error messages or response
  const cloudFlareIndicators = [
    'cloudflare',
    'cf-ray',
    'attention required',
    'checking your browser',
    'ddos protection',
    'security check'
  ];
  
  return cloudFlareIndicators.some(indicator => 
    errorMessage.includes(indicator) || responseText.includes(indicator)
  );
}

/**
 * Checks if the error is from a proxy server (Varnish, Kong, etc.)
 */
function isProxyError(error: any): boolean {
  const status = error.status || 0;
  const errorMessage = error.message?.toLowerCase() || '';
  const responseText = error.responseText?.toLowerCase() || '';
  
  // Proxy-specific status codes
  const proxyStatuses = [
    502, // Bad Gateway
    503, // Service Unavailable
    504, // Gateway Timeout
    507, // Insufficient Storage (sometimes used by proxies)
  ];
  
  if (proxyStatuses.includes(status)) {
    return true;
  }
  
  // Check for proxy server indicators
  const proxyIndicators = [
    'varnish',
    'kong',
    'nginx',
    'haproxy',
    'proxy',
    'gateway',
    'upstream',
    'backend',
    'load balancer'
  ];
  
  return proxyIndicators.some(indicator => 
    errorMessage.includes(indicator) || responseText.includes(indicator)
  );
}

/**
 * Creates a more user-friendly error message
 */
export function getUserFriendlyErrorMessage(error: any): string {
  const categorized = categorizeNetworkError(error);
  return categorized.message;
}

// Cache for API connectivity status to avoid excessive calls
let apiConnectivityCache: {
  connected: boolean;
  lastChecked: number;
  cacheValidMs: number;
} = {
  connected: true, // Assume connected initially
  lastChecked: 0,
  cacheValidMs: 30000 // 30 seconds cache by default
};

/**
 * Checks if the browser is currently online (basic check)
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Enhanced connectivity check that considers both network adapter and API server reachability
 * This is used by UI components and API gating logic
 */
export function isFullyOnline(): boolean {
  // First check basic network connectivity
  if (!navigator.onLine) {
    return false;
  }

  // Check cached API connectivity status
  const now = Date.now();
  const cacheExpired = (now - apiConnectivityCache.lastChecked) > apiConnectivityCache.cacheValidMs;

  if (!cacheExpired) {
    return apiConnectivityCache.connected;
  }

  // If cache expired, return last known status but don't block
  // The actual connectivity test happens asynchronously in the background
  return apiConnectivityCache.connected;
}

/**
 * Updates the API connectivity cache
 * Called by the StatusBar or other components that test connectivity
 */
export function updateAPIConnectivityCache(connected: boolean, cacheValidMs: number = 30000): void {
  apiConnectivityCache = {
    connected,
    lastChecked: Date.now(),
    cacheValidMs
  };
}

/**
 * Invalidates the API connectivity cache
 * Useful after system resume to force fresh connectivity check
 */
export function invalidateConnectivityCache(): void {
  logger.debug(2, 'NetworkUtils', 'Invalidating connectivity cache');
  apiConnectivityCache = {
    connected: true,  // Optimistic: assume online until check proves otherwise
    lastChecked: 0,   // Force expired so next check runs immediately
    cacheValidMs: 30000
  };
}

/**
 * Forces an immediate connectivity check and updates the cache
 * Returns the updated connectivity status
 */
export async function forceConnectivityCheck(apiBaseUrl: string, timeoutMs: number = 5000): Promise<boolean> {
  logger.debug(2, 'NetworkUtils', 'Forcing immediate connectivity check');
  const result = await checkAPIConnectivity(apiBaseUrl, timeoutMs);
  updateAPIConnectivityCache(result.connected, 30000);
  return result.connected;
}

/**
 * Gets the current API connectivity status from cache
 */
export function getAPIConnectivityStatus(): { connected: boolean; lastChecked: number; cacheExpired: boolean } {
  const now = Date.now();
  const cacheExpired = (now - apiConnectivityCache.lastChecked) > apiConnectivityCache.cacheValidMs;

  return {
    connected: apiConnectivityCache.connected,
    lastChecked: apiConnectivityCache.lastChecked,
    cacheExpired
  };
}

/**
 * Enhanced connectivity check that tests actual API server connectivity
 * by attempting to reach the configured API info/discovery endpoint
 */
export async function checkAPIConnectivity(
  apiBaseUrl: string,
  timeoutMs: number = 5000
): Promise<{
  connected: boolean;
  error?: string;
  responseTime?: number;
}> {
  // First check navigator.onLine for quick offline detection
  if (!navigator.onLine) {
    return {
      connected: false,
      error: 'Device is offline (no network adapter connection)'
    };
  }

  const startTime = Date.now();

  try {
    // Get session ID for tracking
    const sessionId = await getSessionId();

    // Use discovery endpoint for connectivity testing with session ID
    const discoveryUrl = `${apiBaseUrl}/ai/info/discovery?sessionId=${encodeURIComponent(sessionId)}`;
    logger.debug(2, 'NetworkUtils', `Testing connectivity to: ${discoveryUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(discoveryUrl, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-cache',
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'API_Test_AI.OS'
      }
    });

    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    logger.debug(2, 'NetworkUtils', `Response status: ${response.status}, time: ${responseTime}ms`);

    if (response.ok) {
      const responseText = await response.text();
      logger.debug(2, 'NetworkUtils', 'Success response:', responseText);
      return {
        connected: true,
        responseTime
      };
    } else {
      const responseText = await response.text();
      logger.debug(1, 'NetworkUtils', 'Error response:', responseText);
      return {
        connected: false,
        error: `API server responded with status ${response.status}: ${responseText}`,
        responseTime
      };
    }
  } catch (error: any) {
    const responseTime = Date.now() - startTime;

    logger.debug(1, 'NetworkUtils', 'Connectivity test failed:', error);

    // Categorize the error
    let errorMessage = 'Unknown connectivity error';

    if (error.name === 'AbortError') {
      errorMessage = `Connection timeout after ${timeoutMs}ms`;
    } else if (error.message?.toLowerCase().includes('failed to fetch')) {
      errorMessage = 'Cannot reach API server (DNS resolution or connectivity issue)';
    } else if (error.message?.toLowerCase().includes('network error')) {
      errorMessage = 'Network error occurred';
    } else if (error.message) {
      errorMessage = error.message;
    }

    return {
      connected: false,
      error: errorMessage,
      responseTime
    };
  }
}

/**
 * Sets up network status listeners
 */
export function setupNetworkListeners(
  onOnline: () => void,
  onOffline: () => void
): () => void {
  const handleOnline = () => {
    logger.info('NetworkUtils', 'Network connection restored');
    onOnline();
  };
  
  const handleOffline = () => {
    logger.info('NetworkUtils', 'Network connection lost');
    onOffline();
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Retries a function with intelligent backoff based on error type
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      const networkError = categorizeNetworkError(error);
      
      // Don't retry if error is not retryable
      if (!networkError.isRetryable) {
        logger.info('NetworkUtils', `Error not retryable: ${networkError.type} - ${networkError.message}`);
        throw error;
      }
      
      // Don't retry if this was the last attempt
      if (attempt === maxRetries) {
        break;
      }
      
      // Calculate delay based on error type
      const delay = calculateRetryDelay(networkError.type, attempt, baseDelay);
      
      logger.info('NetworkUtils', `Retry attempt ${attempt + 1}/${maxRetries + 1} for ${networkError.type} after ${delay}ms`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Calculates retry delay based on error type and attempt number using configuration
 */
function calculateRetryDelay(errorType: NetworkErrorType, attempt: number, baseDelay: number): number {
  // Map NetworkErrorType back to config key
  const typeToConfigMap: { [key in NetworkErrorType]: string } = {
    [NetworkErrorType.RATE_LIMIT]: 'rateLimitErrors',
    [NetworkErrorType.CLOUDFLARE_ERROR]: 'cloudflareErrors',
    [NetworkErrorType.PROXY_ERROR]: 'proxyErrors',
    [NetworkErrorType.SERVER_ERROR]: 'serverErrors',
    [NetworkErrorType.TIMEOUT]: 'timeoutErrors',
    [NetworkErrorType.OFFLINE]: 'offlineErrors',
    [NetworkErrorType.AUTH_ERROR]: 'authErrors',
    [NetworkErrorType.UNKNOWN]: 'unknown'
  };
  
  const configKey = typeToConfigMap[errorType];
  if (configKey && configKey !== 'unknown') {
    return networkConfigManager.getDelayForErrorType(configKey, attempt);
  }
  
  // Default exponential backoff with jitter
  const delay = baseDelay * Math.pow(2, attempt);
  return networkConfigManager.applyJitter(delay);
}

/**
 * Wrapper for API requests with automatic retries and error simulation
 */
export async function apiRequestWithRetry<T>(
  requestFn: () => Promise<T>,
  context: string = 'API Request',
  maxRetries?: number
): Promise<T> {
  // Generate unique request ID for activity tracking
  const requestId = activityTracker.generateRequestId();
  
  // Start activity tracking with context
  activityTracker.startActivity(requestId, context);
  
  // Use configured max retries if not specified
  const effectiveMaxRetries = maxRetries ?? networkConfigManager.getMaxRetries();
  
  try {
    // Check if retry is enabled
    if (!networkConfigManager.isRetryEnabled()) {
      logger.info('NetworkUtils', `${context}: Retry disabled, making single request`);
      return await executeRequest(requestFn, context);
    }
    
    return await retryWithBackoff(async () => {
      return await executeRequest(requestFn, context);
    }, effectiveMaxRetries);
  } catch (error) {
    const networkError = categorizeNetworkError(error);
    
    if (networkConfigManager.getConfig().logging.logErrors) {
      logger.error('NetworkUtils', `${context} failed after ${effectiveMaxRetries + 1} attempts:`, {
        type: networkError.type,
        message: networkError.message,
        simulated: (error as any).simulated || false,
        originalError: error
      });
    }
    
    // Check if this is an API error with specific error details
    // If so, preserve the original error message instead of using generic network error message
    if (error.message && error.message !== 'An unexpected error occurred' &&
        error.message !== networkError.message) {
      // This is likely an API error with specific details, preserve it
      const enhancedError = new Error(error.message);
      (enhancedError as any).type = networkError.type;
      (enhancedError as any).isRetryable = networkError.isRetryable;
      (enhancedError as any).originalError = error;
      (enhancedError as any).simulated = (error as any).simulated || false;
      throw enhancedError;
    }

    // Re-throw with enhanced error information
    const enhancedError = new Error(networkError.message);
    (enhancedError as any).type = networkError.type;
    (enhancedError as any).isRetryable = networkError.isRetryable;
    (enhancedError as any).originalError = error;
    (enhancedError as any).simulated = (error as any).simulated || false;

    throw enhancedError;
  } finally {
    // End activity tracking
    activityTracker.endActivity(requestId);
  }
}

/**
 * Executes a request with error simulation
 */
async function executeRequest<T>(requestFn: () => Promise<T>, context: string): Promise<T> {
  // Check error simulation first
  const simulationResult = networkConfigManager.shouldSimulateError();
  if (simulationResult.simulate && simulationResult.error) {
    if (networkConfigManager.getConfig().logging.logSimulation) {
      logger.warn('NetworkUtils', `${context}: Simulating error`, {
        type: (simulationResult.error as any).simulationType,
        status: (simulationResult.error as any).status,
        message: simulationResult.error.message
      });
    }
    throw simulationResult.error;
  }
  
  // Check if we're offline or API is unreachable
  if (!isFullyOnline()) {
    const basicOnline = isOnline();
    if (!basicOnline) {
      logger.warn('NetworkUtils', `${context}: Device is offline, skipping request`);
      throw new Error('Device is offline');
    } else {
      logger.warn('NetworkUtils', `${context}: API server unreachable, skipping request`);
      throw new Error('API server unreachable');
    }
  }
  
  try {
    const result = await requestFn();
    
    // Notify config manager of success (resets simulation state if configured)
    networkConfigManager.onRequestSuccess();
    
    if (networkConfigManager.getConfig().logging.logSuccess) {
      logger.info('NetworkUtils', `${context}: Request successful`);
    }
    
    return result;
  } catch (error) {
    if (networkConfigManager.getConfig().logging.logErrors) {
      logger.warn('NetworkUtils', `${context}: Request failed`, {
        error: (error as any).message,
        status: (error as any).status
      });
    }
    throw error;
  }
}