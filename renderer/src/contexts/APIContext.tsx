import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { OpenSubtitlesAPI, TranscriptionInfo, TranslationInfo, SubtitleSearchParams, SubtitleDownloadParams, SubtitleLanguage, FeatureSearchParams } from '../services/api';
import { logger } from '../utils/errorLogger';
import { isOnline, isFullyOnline, checkAPIConnectivity, invalidateConnectivityCache, forceConnectivityCheck } from '../utils/networkUtils';
import { usePower } from './PowerContext';
import CacheManager from '../services/cache';

// Authentication state machine
export enum AuthState {
  UNAUTHENTICATED = 'unauthenticated',
  AUTHENTICATING = 'authenticating',
  AUTHENTICATED = 'authenticated',
  RETRYING = 'retrying'
}

interface APIContextType {
  api: OpenSubtitlesAPI | null;
  isAuthenticated: boolean;
  authState: AuthState;
  isAuthenticating: boolean;
  credits: { used: number; remaining: number } | null;
  transcriptionInfo: TranscriptionInfo | null;
  translationInfo: TranslationInfo | null;
  modelInfoVersion: number;
  userInfo: any | null;
  isLoading: boolean;
  error: string | null;
  connectivityIssue: string | null;
  
  // Actions
  login: (username: string, password: string, apiKey: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshCredits: () => Promise<void>;
  updateCredits: (credits: { used: number; remaining: number }) => void;
  refreshConnectivityAndAuth: () => Promise<void>;
  refreshModelInfo: () => Promise<void>;

  // Test functions
  prepareForHibernationTest: () => void;
  
  // Centralized API methods
  getServicesInfo: () => Promise<{ success: boolean; data?: any; error?: string }>;
  getCreditPackages: (email?: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  getTranslationLanguagesForApi: (apiId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  getTranscriptionLanguagesForApi: (apiId: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  getTranslationApisForLanguage: (sourceLanguage: string, targetLanguage: string) => Promise<{ success: boolean; data?: any; error?: string }>;
  detectLanguage: (file: File | string, duration?: number) => Promise<any>;
  checkLanguageDetectionStatus: (correlationId: string) => Promise<any>;
  initiateTranscription: (audioFile: File | string, options: any) => Promise<any>;
  initiateTranslation: (subtitleFile: File | string, options: any) => Promise<any>;
  checkTranscriptionStatus: (correlationId: string) => Promise<any>;
  checkTranslationStatus: (correlationId: string) => Promise<any>;
  downloadFile: (url: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  downloadFileByMediaId: (mediaId: string, fileName: string) => Promise<{ success: boolean; content?: string; error?: string }>;
  getRecentMedia: () => Promise<{ success: boolean; data?: any; error?: string }>;
  searchSubtitles: (params: SubtitleSearchParams) => Promise<{ success: boolean; data?: any; error?: string }>;
  downloadSubtitle: (params: SubtitleDownloadParams) => Promise<{ success: boolean; data?: any; error?: string }>;
  searchForFeatures: (params: FeatureSearchParams) => Promise<{ success: boolean; data?: any; error?: string }>;
  getSubtitleSearchLanguages: () => Promise<{ success: boolean; data?: SubtitleLanguage[]; error?: string }>;

  // Sync helper functions for filename generation
  getTranslationLanguageNameSync: (apiId: string, languageCode: string) => string | null;
  getTranscriptionLanguageNameSync: (apiId: string, languageCode: string) => string | null;
}

const APIContext = createContext<APIContextType | null>(null);

export const useAPI = () => {
  const context = useContext(APIContext);
  if (!context) {
    throw new Error('useAPI must be used within an APIProvider');
  }
  return context;
};

interface APIProviderProps {
  children: React.ReactNode;
  initialConfig?: {
    username: string;
    password: string;
    apiKey: string;
    apiBaseUrl?: string;
    apiUrlParameter?: string;
  };
}

export const APIProvider: React.FC<APIProviderProps> = ({ children, initialConfig }) => {
  const [api, setApi] = useState<OpenSubtitlesAPI | null>(null);
  const [authState, setAuthState] = useState<AuthState>(AuthState.UNAUTHENTICATED);
  const [credits, setCredits] = useState<{ used: number; remaining: number } | null>(null);
  const [transcriptionInfo, setTranscriptionInfo] = useState<TranscriptionInfo | null>(null);
  const [translationInfo, setTranslationInfo] = useState<TranslationInfo | null>(null);
  const [modelInfoVersion, setModelInfoVersion] = useState(0);
  const [userInfo, setUserInfo] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectivityIssue, setConnectivityIssue] = useState<string | null>(null);

  // Derived states for backward compatibility
  const isAuthenticated = authState === AuthState.AUTHENTICATED;
  const isAuthenticating = authState === AuthState.AUTHENTICATING || authState === AuthState.RETRYING;
  const authenticationInProgress = isAuthenticating;

  // Power context for hibernation recovery
  const { lastResumeTime, registerConnectivityRefreshCallback } = usePower();

  // Global promise to prevent concurrent authentication attempts
  const authPromiseRef = useRef<Promise<boolean> | null>(null);

  // Retry timer for hibernation recovery (no reactive state, just a timer)
  const hibernationRetryTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Prevent multiple API instance creation in React StrictMode
  const apiCreatedRef = useRef(false);

  // Helper function to check device online status with hibernation recovery grace period
  const checkDeviceOnlineWithGracePeriod = useCallback(async (): Promise<boolean> => {
    const currentTime = Date.now();
    const GRACE_PERIOD_MS = 10000; // Extended to 10 seconds grace period for hibernation recovery

    // Check if we recently resumed from hibernation
    if (lastResumeTime && (currentTime - lastResumeTime) < GRACE_PERIOD_MS) {
      logger.debug(1, 'APIContext', `Within hibernation recovery grace period (${Math.round((currentTime - lastResumeTime) / 1000)}s ago), waiting for network stabilization`);

      // More aggressive retry approach for hibernation recovery
      for (let attempt = 1; attempt <= 5; attempt++) {
        logger.debug(1, 'APIContext', `Hibernation recovery network check attempt ${attempt}/5`);

        const isCurrentlyOnline = isOnline();
        if (isCurrentlyOnline) {
          logger.debug(1, 'APIContext', `Network available on attempt ${attempt}, proceeding with authentication`);
          return true;
        }

        // Wait progressively longer between attempts
        const waitTime = attempt * 1000; // 1s, 2s, 3s, 4s, 5s
        logger.debug(1, 'APIContext', `Network not available, waiting ${waitTime}ms before retry`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }

      logger.warn('APIContext', 'Network still not available after hibernation recovery attempts, but proceeding anyway - token might still be valid');
      // Don't fail completely - token might still be valid even if network check fails
      return true;
    }

    // Normal online check if not in grace period
    return isOnline();
  }, [lastResumeTime]);

  // Initialize API instance when config is provided
  useEffect(() => {
    logger.debug(1, 'APIContext', 'Initialization effect triggered', {
      hasApiKey: !!initialConfig?.apiKey,
      hasApi: !!api,
      apiCreated: apiCreatedRef.current,
      hasCredentials: !!(initialConfig?.username && initialConfig?.password),
      lastResumeTime: lastResumeTime
    });

    if (initialConfig?.apiKey && !api && !apiCreatedRef.current) {
      logger.info('APIContext', 'Creating initial API instance');
      apiCreatedRef.current = true;
      const apiInstance = new OpenSubtitlesAPI(initialConfig.apiKey, initialConfig.apiBaseUrl, initialConfig.apiUrlParameter);
      logger.info('APIContext', 'Setting API instance in state (initial)');
      setApi(apiInstance);

      // Try to authenticate immediately if we have credentials
      if (initialConfig.username && initialConfig.password) {
        logger.info('APIContext', 'Starting initial authentication on app startup');
        authenticateUser(apiInstance, initialConfig.username, initialConfig.password)
          .then(success => {
            logger.info('APIContext', `Initial authentication completed: ${success}`);
          })
          .catch(error => {
            logger.error('APIContext', 'Initial authentication failed:', error);
          });
      }
    } else {
      logger.debug(1, 'APIContext', 'Skipping API instance creation', {
        reason: !initialConfig?.apiKey ? 'no apiKey' :
                api ? 'api exists' :
                apiCreatedRef.current ? 'already created' : 'unknown'
      });
    }
  }, [initialConfig?.apiKey, initialConfig?.username, initialConfig?.password, initialConfig?.apiBaseUrl, initialConfig?.apiUrlParameter, api]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (hibernationRetryTimerRef.current) {
        clearTimeout(hibernationRetryTimerRef.current);
        hibernationRetryTimerRef.current = null;
      }
    };
  }, []);

  const authenticateUser = async (apiInstance: OpenSubtitlesAPI, username: string, password: string) => {
    // Prevent concurrent authentication attempts using a promise-based approach
    if (authPromiseRef.current) {
      logger.warn('APIContext', 'Authentication already in progress, waiting for existing promise');
      return await authPromiseRef.current;
    }

    // Create and store the authentication promise
    const authPromise = performAuthentication(apiInstance, username, password);
    authPromiseRef.current = authPromise;

    try {
      const result = await authPromise;
      return result;
    } finally {
      // Clear the promise when done
      authPromiseRef.current = null;
    }
  };

  const performAuthentication = async (apiInstance: OpenSubtitlesAPI, username: string, password: string) => {
    setAuthState(AuthState.AUTHENTICATING);
    setIsLoading(true);
    setError(null);

    try {
      logger.info('APIContext', 'Attempting authentication...');

      // Try to load cached token first
      const hasCachedToken = await apiInstance.loadCachedToken();
      if (hasCachedToken) {
        logger.info('APIContext', 'Using cached token, verifying with credits check');
        logger.info('APIContext', `Cached token loaded on instance: ${(apiInstance as any).token ? 'YES' : 'NO'}`);

        // Check if device is online with hibernation recovery grace period
        const isDeviceOnline = await checkDeviceOnlineWithGracePeriod();
        if (!isDeviceOnline) {
          logger.warn('APIContext', 'Device is offline, skipping credits verification');

          // Schedule a single retry if this is post-hibernation
          if (lastResumeTime && (Date.now() - lastResumeTime) < 30000 && !hibernationRetryTimerRef.current) {
            logger.debug(1, 'APIContext', 'Scheduling hibernation recovery retry in 10 seconds');
            setAuthState(AuthState.RETRYING);
            hibernationRetryTimerRef.current = setTimeout(() => {
              hibernationRetryTimerRef.current = null;
              if (isOnline() && isFullyOnline()) {
                logger.info('APIContext', 'Attempting hibernation recovery authentication retry');
                authenticateUser(apiInstance, username, password).catch(error => {
                  logger.error('APIContext', 'Hibernation recovery retry failed:', error);
                  setAuthState(AuthState.UNAUTHENTICATED);
                });
              } else {
                setAuthState(AuthState.UNAUTHENTICATED);
              }
            }, 10000);
          } else {
            setAuthState(AuthState.UNAUTHENTICATED);
          }

          setIsLoading(false);
          return false;
        }

        // Check cached connectivity status instead of making a real-time test
        if (!isFullyOnline()) {
          logger.warn('APIContext', 'API server appears unreachable based on cached connectivity status, skipping credits verification');

          // Schedule a single retry if this is post-hibernation
          if (lastResumeTime && (Date.now() - lastResumeTime) < 30000 && !hibernationRetryTimerRef.current) {
            logger.debug(1, 'APIContext', 'Scheduling hibernation recovery retry in 10 seconds');
            setAuthState(AuthState.RETRYING);
            hibernationRetryTimerRef.current = setTimeout(() => {
              hibernationRetryTimerRef.current = null;
              if (isOnline() && isFullyOnline()) {
                logger.info('APIContext', 'Attempting hibernation recovery authentication retry');
                authenticateUser(apiInstance, username, password).catch(error => {
                  logger.error('APIContext', 'Hibernation recovery retry failed:', error);
                  setAuthState(AuthState.UNAUTHENTICATED);
                });
              } else {
                setAuthState(AuthState.UNAUTHENTICATED);
              }
            }, 10000);
          } else {
            setAuthState(AuthState.UNAUTHENTICATED);
          }

          setIsLoading(false);
          return false;
        }
        logger.debug(1, 'APIContext', 'API connectivity appears good based on cached status, proceeding with authentication');

        // Verify token is still valid with a credits check
        const creditsResult = await apiInstance.getCredits();
        if (creditsResult.success) {
          setAuthState(AuthState.AUTHENTICATED);
          setCredits({ used: 0, remaining: creditsResult.credits || 0 });
          await loadAPIInfo(apiInstance);

          // Clear any pending hibernation retry on successful authentication
          if (hibernationRetryTimerRef.current) {
            clearTimeout(hibernationRetryTimerRef.current);
            hibernationRetryTimerRef.current = null;
          }

          logger.info('APIContext', 'Cached token verified successfully');
          return true;
        } else {
          logger.warn('APIContext', 'Cached token invalid, attempting fresh login');
        }
      }

      // If no cached token or it's invalid, do fresh login
      const loginResult = await apiInstance.login(username, password);
      if (loginResult.success) {
        setAuthState(AuthState.AUTHENTICATED);

        // Clear any pending hibernation retry on successful authentication
        if (hibernationRetryTimerRef.current) {
          clearTimeout(hibernationRetryTimerRef.current);
          hibernationRetryTimerRef.current = null;
        }
        logger.info('APIContext', 'Fresh authentication successful');
        logger.info('APIContext', `Token set on instance: ${(apiInstance as any).token ? 'YES' : 'NO'}`);

        // Load credits and API info
        await Promise.all([
          refreshCredits(),
          loadAPIInfo(apiInstance)
        ]);

        return true;
      } else {
        setError(loginResult.error || 'Authentication failed');
        setAuthState(AuthState.UNAUTHENTICATED);
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';
      logger.error('APIContext', 'Authentication error:', error);
      setError(errorMessage);
      setAuthState(AuthState.UNAUTHENTICATED);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const loadAPIInfo = async (apiInstance: OpenSubtitlesAPI) => {
    try {
      logger.info('APIContext', 'Loading API info...');

      const [transcriptionResult, translationResult] = await Promise.all([
        apiInstance.getTranscriptionInfo(),
        apiInstance.getTranslationInfo()
      ]);

      if (transcriptionResult.success && transcriptionResult.data) {
        setTranscriptionInfo(transcriptionResult.data);
        logger.info('APIContext', 'Transcription info loaded');
      }

      if (translationResult.success && translationResult.data) {
        setTranslationInfo(translationResult.data);
        logger.info('APIContext', 'Translation info loaded');
      }

      logger.info('APIContext', 'API info loading completed');
    } catch (error) {
      logger.error('APIContext', 'Failed to load API info:', error);
    }
  };

  const refreshModelInfo = useCallback(async () => {
    if (!api) return;

    logger.info('APIContext', 'Refreshing model info...');

    // Clear cache entries
    CacheManager.remove('transcription_info');
    CacheManager.remove('translation_info');
    CacheManager.remove('services_info');

    // Reload fresh data
    await loadAPIInfo(api);

    // Increment version to notify listeners
    setModelInfoVersion(prev => prev + 1);
    logger.debug(2, 'APIContext', 'Model info version incremented');
  }, [api]);

  const login = useCallback(async (username: string, password: string, apiKey: string): Promise<boolean> => {
    // Prevent multiple simultaneous login attempts
    if (authenticationInProgress) {
      logger.warn('APIContext', 'Authentication already in progress, skipping duplicate login attempt');
      return false;
    }

    logger.info('APIContext', `Starting login for user: ${username}`);
    setAuthState(AuthState.AUTHENTICATING);

    try {
      // Reuse existing API instance or create one if none exists
      let apiInstance = api;
      if (!apiInstance || apiInstance.apiKey !== apiKey) {
        // Only create new instance if none exists or API key changed
        apiInstance = new OpenSubtitlesAPI(apiKey, initialConfig?.apiBaseUrl, initialConfig?.apiUrlParameter);
        logger.info('APIContext', 'Setting API instance in state (login)');
        setApi(apiInstance);
      }

      const result = await authenticateUser(apiInstance, username, password);
      logger.info('APIContext', `Login completed for user: ${username}, success: ${result}`);
      return result;
    } catch (error) {
      logger.error('APIContext', 'Login error:', error);
      setAuthState(AuthState.UNAUTHENTICATED);
      return false;
    }
  }, [authenticationInProgress, api, initialConfig]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      if (api) {
        await api.clearCachedToken();
      }
      setApi(null);
      setAuthState(AuthState.UNAUTHENTICATED);
      setCredits(null);
      setTranscriptionInfo(null);
      setTranslationInfo(null);
      setUserInfo(null);
      setError(null);
      logger.info('APIContext', 'Logout completed');
    } catch (error) {
      logger.error('APIContext', 'Error during logout:', error);
    }
  }, [api]);

  const refreshCredits = useCallback(async (): Promise<void> => {
    if (!api || !isAuthenticated) return;

    try {
      logger.info('APIContext', `refreshCredits: Using API instance with token: ${(api as any).token ? 'YES' : 'NO'}`);
      const result = await api.getCredits();
      if (result.success && typeof result.credits === 'number') {
        setCredits({ used: 0, remaining: result.credits });
        logger.info('APIContext', `Credits refreshed: ${result.credits} remaining`);
      }
    } catch (error) {
      logger.error('APIContext', 'Failed to refresh credits:', error);
    }
  }, [api, isAuthenticated]);

  const updateCredits = useCallback((newCredits: { used: number; remaining: number }) => {
    setCredits(newCredits);
    logger.info('APIContext', `Credits updated: ${newCredits.remaining} remaining, ${newCredits.used} used`);
  }, []);

  // Test function to prepare authentication state for hibernation simulation
  const prepareForHibernationTest = useCallback(() => {
    logger.info('APIContext', '🧪 TEST: Preparing for hibernation simulation');
    setAuthState(AuthState.UNAUTHENTICATED);
    setIsAuthenticated(false);
    // Token stays in API instance for re-authentication
    logger.debug(1, 'APIContext', '🧪 TEST: Authentication state cleared, ready for hibernation simulation');
  }, []);

  // Refresh connectivity and trigger re-authentication if needed
  const refreshConnectivityAndAuth = useCallback(async (): Promise<void> => {
    logger.info('APIContext', 'Refreshing connectivity and authentication after system resume');

    // RACE CONDITION FIX: Cancel any pending hibernation retry timer
    if (hibernationRetryTimerRef.current) {
      logger.debug(1, 'APIContext', 'Cancelling pending hibernation retry timer');
      clearTimeout(hibernationRetryTimerRef.current);
      hibernationRetryTimerRef.current = null;
    }

    // Invalidate connectivity cache to force fresh check
    invalidateConnectivityCache();

    // Force immediate connectivity check if we have API config
    if (initialConfig?.apiBaseUrl) {
      let connected = await forceConnectivityCheck(initialConfig.apiBaseUrl, 5000);
      logger.debug(1, 'APIContext', `Initial connectivity check result: ${connected}`);

      // If initial check fails, retry after a short delay (DNS might not be ready yet after resume)
      if (!connected && navigator.onLine) {
        logger.info('APIContext', 'Initial connectivity check failed but network is online, retrying after delay...');
        await new Promise(resolve => setTimeout(resolve, 2000));
        connected = await forceConnectivityCheck(initialConfig.apiBaseUrl, 5000);
        logger.debug(1, 'APIContext', `Retry connectivity check result: ${connected}`);
      }

      // If connected and we have credentials, trigger re-authentication
      if (connected && api && initialConfig?.username && initialConfig?.password) {
        logger.info('APIContext', 'Network restored, attempting re-authentication');

        // RACE CONDITION FIX: If auth already in progress, wait for it instead of starting new one
        if (authPromiseRef.current) {
          logger.debug(1, 'APIContext', 'Authentication already in progress, waiting for completion');
          await authPromiseRef.current;
        } else {
          await authenticateUser(api, initialConfig.username, initialConfig.password);
        }
      } else if (!connected && api && initialConfig?.username && initialConfig?.password) {
        logger.warn('APIContext', 'Connectivity check failed after retry, but will rely on withAuthRetry middleware for re-authentication on next API call');
      }
    }
  }, [api, initialConfig, authenticateUser]);

  // Register connectivity refresh callback with PowerContext
  useEffect(() => {
    registerConnectivityRefreshCallback(refreshConnectivityAndAuth);
  }, [registerConnectivityRefreshCallback, refreshConnectivityAndAuth]);

  // Global middleware wrapper that handles post-hibernation re-authentication
  const withAuthRetry = useCallback(async <T,>(
    apiCall: () => Promise<T>,
    context: string = 'API Call'
  ): Promise<T> => {
    // Check if we're within post-hibernation window and need re-authentication
    if (lastResumeTime && api && initialConfig?.username && initialConfig?.password) {
      const timeSinceResume = Date.now() - lastResumeTime;
      const HIBERNATION_REAUTH_WINDOW_MS = 30000; // 30 seconds

      if (timeSinceResume < HIBERNATION_REAUTH_WINDOW_MS && authState !== AuthState.AUTHENTICATED) {
        logger.debug(1, 'APIContext', `${context}: Within post-hibernation window, attempting re-authentication`);

        // RACE CONDITION FIX: If authentication is already in progress, wait for it
        if (authPromiseRef.current) {
          logger.debug(1, 'APIContext', `${context}: Authentication already in progress, waiting...`);
          const authSuccess = await authPromiseRef.current;
          if (!authSuccess) {
            logger.warn('APIContext', `${context}: Post-hibernation re-authentication failed (waited for existing auth)`);
            return { success: false, error: 'Authentication failed after system resume' } as T;
          }
          logger.info('APIContext', `${context}: Post-hibernation re-authentication successful (waited for existing auth)`);
        } else {
          // No auth in progress, start new one
          const authSuccess = await authenticateUser(api, initialConfig.username, initialConfig.password);
          if (!authSuccess) {
            logger.warn('APIContext', `${context}: Post-hibernation re-authentication failed`);
            return { success: false, error: 'Authentication failed after system resume' } as T;
          }
          logger.info('APIContext', `${context}: Post-hibernation re-authentication successful`);
        }
      }
    }

    // Proceed with the API call wrapped in error handling
    return await handleAPICall(apiCall, context);
  }, [api, authState, lastResumeTime, initialConfig, authenticateUser]);

  // Centralized error handling wrapper
  const handleAPICall = useCallback(async <T,>(
    apiCall: () => Promise<T>,
    context: string = 'API Call'
  ): Promise<T> => {
    try {
      return await apiCall();
    } catch (error: any) {
      const status = error.status || 0;

      // Handle authentication errors
      if (status === 401 || status === 403) {
        logger.warn('APIContext', `${context}: Authentication error detected, re-authenticating...`);

        // Only clear token and re-authenticate if not already in progress
        if (!authenticationInProgress && api && initialConfig?.username && initialConfig?.password) {
          await api.clearCachedToken();
          setAuthState(AuthState.UNAUTHENTICATED);

          // Attempt re-authentication
          const success = await authenticateUser(api, initialConfig.username, initialConfig.password);
          if (success) {
            logger.info('APIContext', `${context}: Re-authentication successful, retrying original call`);
            // Retry the original call once
            return await apiCall();
          } else {
            logger.error('APIContext', `${context}: Re-authentication failed`);
            throw new Error('Authentication failed after retry');
          }
        } else {
          logger.warn('APIContext', `${context}: Authentication already in progress or missing credentials`);
          throw error;
        }
      }

      // Handle rate limiting - coordinate globally
      if (status === 429) {
        logger.warn('APIContext', `${context}: Rate limit hit, error will be handled by network utils retry logic`);
        // Let the existing networkUtils retry logic handle this with proper delays
        throw error;
      }

      // Handle server errors and other errors
      if (status >= 500) {
        logger.warn('APIContext', `${context}: Server error ${status}, error will be handled by network utils retry logic`);
        throw error;
      }

      // For all other errors, just pass through
      throw error;
    }
  }, [api, authenticationInProgress, initialConfig, authenticateUser]);

  // Centralized API methods - all use withAuthRetry middleware
  // RACE CONDITION FIX: Allow calls through if authenticated OR authenticating (middleware will handle waiting)
  const getServicesInfo = useCallback(async () => {
    if (!api) return { success: false, error: 'API not available' };
    if (!isAuthenticating && !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await withAuthRetry(() => api.getServicesInfo(), 'Get Services Info');
  }, [api, isAuthenticated, isAuthenticating, withAuthRetry]);

  const getCreditPackages = useCallback(async (email?: string) => {
    if (!api) return { success: false, error: 'API not available' };
    if (!isAuthenticating && !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await withAuthRetry(() => api.getCreditPackages(email), 'Get Credit Packages');
  }, [api, isAuthenticated, isAuthenticating, withAuthRetry]);

  const getTranslationLanguagesForApi = useCallback(async (apiId: string) => {
    if (!api) return { success: false, error: 'API not available' };
    if (!isAuthenticating && !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await withAuthRetry(() => api.getTranslationLanguagesForApi(apiId), 'Get Translation Languages');
  }, [api, isAuthenticated, isAuthenticating, withAuthRetry]);

  const getTranscriptionLanguagesForApi = useCallback(async (apiId: string) => {
    if (!api) return { success: false, error: 'API not available' };
    if (!isAuthenticating && !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await withAuthRetry(() => api.getTranscriptionLanguagesForApi(apiId), 'Get Transcription Languages');
  }, [api, isAuthenticated, isAuthenticating, withAuthRetry]);

  const getTranslationApisForLanguage = useCallback(async (sourceLanguage: string, targetLanguage: string) => {
    if (!api) return { success: false, error: 'API not available' };
    if (!isAuthenticating && !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await withAuthRetry(() => api.getTranslationApisForLanguage(sourceLanguage, targetLanguage), 'Get Translation APIs');
  }, [api, isAuthenticated, isAuthenticating, withAuthRetry]);

  const detectLanguage = useCallback(async (file: File | string, duration?: number) => {
    if (!api) return { status: 'ERROR', errors: ['API not available'] };
    if (!isAuthenticating && !isAuthenticated) return { status: 'ERROR', errors: ['API not authenticated'] };
    return await withAuthRetry(() => api.detectLanguage(file, duration), 'Detect Language');
  }, [api, isAuthenticated, isAuthenticating, withAuthRetry]);

  const checkLanguageDetectionStatus = useCallback(async (correlationId: string) => {
    if (!api) return { status: 'ERROR', errors: ['API not available'] };
    if (!isAuthenticating && !isAuthenticated) return { status: 'ERROR', errors: ['API not authenticated'] };
    return await withAuthRetry(() => api.checkLanguageDetectionStatus(correlationId), 'Check Language Detection');
  }, [api, isAuthenticated, isAuthenticating, withAuthRetry]);

  const initiateTranscription = useCallback(async (audioFile: File | string, options: any) => {
    if (!api) return { status: 'ERROR', errors: ['API not available'] };
    if (!isAuthenticating && !isAuthenticated) return { status: 'ERROR', errors: ['API not authenticated'] };
    return await withAuthRetry(() => api.initiateTranscription(audioFile, options), 'Initiate Transcription');
  }, [api, isAuthenticated, isAuthenticating, withAuthRetry]);

  const initiateTranslation = useCallback(async (subtitleFile: File | string, options: any) => {
    if (!api) return { status: 'ERROR', errors: ['API not available'] };
    if (!isAuthenticating && !isAuthenticated) return { status: 'ERROR', errors: ['API not authenticated'] };
    return await withAuthRetry(() => api.initiateTranslation(subtitleFile, options), 'Initiate Translation');
  }, [api, isAuthenticated, isAuthenticating, withAuthRetry]);

  const checkTranscriptionStatus = useCallback(async (correlationId: string) => {
    if (!api) return { status: 'ERROR', errors: ['API not available'] };
    if (!isAuthenticating && !isAuthenticated) return { status: 'ERROR', errors: ['API not authenticated'] };
    return await withAuthRetry(() => api.checkTranscriptionStatus(correlationId), 'Check Transcription Status');
  }, [api, isAuthenticated, isAuthenticating, withAuthRetry]);

  const checkTranslationStatus = useCallback(async (correlationId: string) => {
    if (!api) return { status: 'ERROR', errors: ['API not available'] };
    if (!isAuthenticating && !isAuthenticated) return { status: 'ERROR', errors: ['API not authenticated'] };
    return await withAuthRetry(() => api.checkTranslationStatus(correlationId), 'Check Translation Status');
  }, [api, isAuthenticated, isAuthenticating, withAuthRetry]);

  const downloadFile = useCallback(async (url: string) => {
    if (!api) return { success: false, error: 'API not available' };
    if (!isAuthenticating && !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await withAuthRetry(() => api.downloadFile(url), 'Download File');
  }, [api, isAuthenticated, isAuthenticating, withAuthRetry]);

  const downloadFileByMediaId = useCallback(async (mediaId: string, fileName: string) => {
    if (!api) return { success: false, error: 'API not available' };
    if (!isAuthenticating && !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await withAuthRetry(() => api.downloadFileByMediaId(mediaId, fileName), 'Download File By Media ID');
  }, [api, isAuthenticated, isAuthenticating, withAuthRetry]);

  const getRecentMedia = useCallback(async () => {
    if (!api) return { success: false, error: 'API not available' };
    if (!isAuthenticating && !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await withAuthRetry(() => api.getRecentMedia(), 'Get Recent Media');
  }, [api, isAuthenticated, isAuthenticating, withAuthRetry]);

  const searchSubtitles = useCallback(async (params: SubtitleSearchParams) => {
    if (!api) return { success: false, error: 'API not available' };
    if (!isAuthenticating && !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await withAuthRetry(() => api.searchSubtitles(params), 'Search Subtitles');
  }, [api, isAuthenticated, isAuthenticating, withAuthRetry]);

  const downloadSubtitle = useCallback(async (params: SubtitleDownloadParams) => {
    if (!api) return { success: false, error: 'API not available' };
    if (!isAuthenticating && !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await withAuthRetry(() => api.downloadSubtitle(params), 'Download Subtitle');
  }, [api, isAuthenticated, isAuthenticating, withAuthRetry]);

  const searchForFeatures = useCallback(async (params: FeatureSearchParams) => {
    if (!api) return { success: false, error: 'API not available' };
    if (!isAuthenticating && !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await withAuthRetry(() => api.searchForFeatures(params), 'Search Features');
  }, [api, isAuthenticated, isAuthenticating, withAuthRetry]);
  const getSubtitleSearchLanguages = useCallback(async () => {
    if (!api) return { success: false, error: 'API not available' };
    return await withAuthRetry(() => api.getSubtitleSearchLanguages(), 'Get Subtitle Search Languages');
  }, [api, withAuthRetry]);

  // Sync helper functions for filename generation using cached data
  const getTranslationLanguageNameSync = useCallback((apiId: string, languageCode: string): string | null => {
    if (!translationInfo?.apis?.[apiId]?.supported_languages) {
      return null;
    }

    const language = translationInfo.apis[apiId].supported_languages.find(
      (lang: any) => lang.language_code === languageCode
    );

    return language?.language_name || null;
  }, [translationInfo]);

  const getTranscriptionLanguageNameSync = useCallback((apiId: string, languageCode: string): string | null => {
    if (!transcriptionInfo?.apis?.[apiId]?.supported_languages) {
      return null;
    }

    const language = transcriptionInfo.apis[apiId].supported_languages.find(
      (lang: any) => lang.language_code === languageCode
    );

    return language?.language_name || null;
  }, [transcriptionInfo]);

  const contextValue: APIContextType = {
    api,
    isAuthenticated,
    authState,
    isAuthenticating,
    credits,
    transcriptionInfo,
    translationInfo,
    modelInfoVersion,
    userInfo,
    isLoading,
    error,
    connectivityIssue,
    login,
    logout,
    refreshCredits,
    updateCredits,
    refreshConnectivityAndAuth,
    refreshModelInfo,
    prepareForHibernationTest,
    getServicesInfo,
    getCreditPackages,
    getTranslationLanguagesForApi,
    getTranscriptionLanguagesForApi,
    getTranslationApisForLanguage,
    detectLanguage,
    checkLanguageDetectionStatus,
    initiateTranscription,
    initiateTranslation,
    checkTranscriptionStatus,
    checkTranslationStatus,
    downloadFile,
    downloadFileByMediaId,
    getRecentMedia,
    searchSubtitles,
    downloadSubtitle,
    searchForFeatures,
    getSubtitleSearchLanguages,
    getTranslationLanguageNameSync,
    getTranscriptionLanguageNameSync
  };

  return (
    <APIContext.Provider value={contextValue}>
      {children}
    </APIContext.Provider>
  );
};