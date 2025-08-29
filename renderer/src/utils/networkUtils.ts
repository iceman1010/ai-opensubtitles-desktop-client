import { logger } from './errorLogger';
import networkConfigManager from './networkConfig';
import { activityTracker } from './activityTracker';

// Export activity tracker for external access
export { activityTracker };

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

/**
 * Checks if the browser is currently online
 */
export function isOnline(): boolean {
  return navigator.onLine;
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
  
  // Start activity tracking
  activityTracker.startActivity(requestId);
  
  try {
    // Use configured max retries if not specified
    const effectiveMaxRetries = maxRetries ?? networkConfigManager.getMaxRetries();
  
  
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
  
  // Check if we're offline
  if (!isOnline()) {
    logger.warn('NetworkUtils', `${context}: Device is offline, skipping request`);
    throw new Error('Device is offline');
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