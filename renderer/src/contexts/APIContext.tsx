import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { OpenSubtitlesAPI, TranscriptionInfo, TranslationInfo } from '../services/api';
import { logger } from '../utils/errorLogger';
import { isOnline } from '../utils/networkUtils';

interface APIContextType {
  api: OpenSubtitlesAPI | null;
  isAuthenticated: boolean;
  credits: { used: number; remaining: number } | null;
  transcriptionInfo: TranscriptionInfo | null;
  translationInfo: TranslationInfo | null;
  userInfo: any | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (username: string, password: string, apiKey: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshCredits: () => Promise<void>;
  updateCredits: (credits: { used: number; remaining: number }) => void;
  
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
  getRecentMedia: () => Promise<{ success: boolean; data?: any; error?: string }>;

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
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [credits, setCredits] = useState<{ used: number; remaining: number } | null>(null);
  const [transcriptionInfo, setTranscriptionInfo] = useState<TranscriptionInfo | null>(null);
  const [translationInfo, setTranslationInfo] = useState<TranslationInfo | null>(null);
  const [userInfo, setUserInfo] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authenticationInProgress, setAuthenticationInProgress] = useState(false);

  // Global promise to prevent concurrent authentication attempts
  const authPromiseRef = useRef<Promise<boolean> | null>(null);

  // Prevent multiple API instance creation in React StrictMode
  const apiCreatedRef = useRef(false);

  // Initialize API instance when config is provided
  useEffect(() => {
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
    }
  }, [initialConfig?.apiKey, initialConfig?.username, initialConfig?.password, initialConfig?.apiBaseUrl, initialConfig?.apiUrlParameter, api]);

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
    setAuthenticationInProgress(true);
    setIsLoading(true);
    setError(null);
    
    try {
      logger.info('APIContext', 'Attempting authentication...');
      
      // Try to load cached token first
      const hasCachedToken = await apiInstance.loadCachedToken();
      if (hasCachedToken) {
        logger.info('APIContext', 'Using cached token, verifying with credits check');
        logger.info('APIContext', `Cached token loaded on instance: ${(apiInstance as any).token ? 'YES' : 'NO'}`);

        // Check if device is online before making network request
        if (!isOnline()) {
          logger.warn('APIContext', 'Device is offline, skipping credits verification');
          setAuthenticationInProgress(false);
          setIsLoading(false);
          return false;
        }

        // Verify token is still valid with a credits check
        const creditsResult = await apiInstance.getCredits();
        if (creditsResult.success) {
          setIsAuthenticated(true);
          setCredits({ used: 0, remaining: creditsResult.credits || 0 });
          await loadAPIInfo(apiInstance);
          logger.info('APIContext', 'Cached token verified successfully');
          return true;
        } else {
          logger.warn('APIContext', 'Cached token invalid, attempting fresh login');
        }
      }
      
      // If no cached token or it's invalid, do fresh login
      const loginResult = await apiInstance.login(username, password);
      if (loginResult.success) {
        setIsAuthenticated(true);
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
        setIsAuthenticated(false);
        return false;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown authentication error';
      logger.error('APIContext', 'Authentication error:', error);
      setError(errorMessage);
      setIsAuthenticated(false);
      return false;
    } finally {
      setIsLoading(false);
      setAuthenticationInProgress(false);
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

  const login = useCallback(async (username: string, password: string, apiKey: string): Promise<boolean> => {
    // Prevent multiple simultaneous login attempts
    if (authenticationInProgress) {
      logger.warn('APIContext', 'Authentication already in progress, skipping duplicate login attempt');
      return false;
    }

    logger.info('APIContext', `Starting login for user: ${username}`);
    setAuthenticationInProgress(true);

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
    } finally {
      setAuthenticationInProgress(false);
    }
  }, [authenticationInProgress, api, initialConfig]);

  const logout = useCallback(async (): Promise<void> => {
    try {
      if (api) {
        await api.clearCachedToken();
      }
      setApi(null);
      setIsAuthenticated(false);
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
          setIsAuthenticated(false);

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

  // Centralized API methods
  const getServicesInfo = useCallback(async () => {
    if (!api || !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await handleAPICall(() => api.getServicesInfo(), 'Get Services Info');
  }, [api, isAuthenticated, handleAPICall]);

  const getCreditPackages = useCallback(async (email?: string) => {
    if (!api || !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await handleAPICall(() => api.getCreditPackages(email), 'Get Credit Packages');
  }, [api, isAuthenticated, handleAPICall]);

  const getTranslationLanguagesForApi = useCallback(async (apiId: string) => {
    if (!api || !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await handleAPICall(() => api.getTranslationLanguagesForApi(apiId), 'Get Translation Languages');
  }, [api, isAuthenticated, handleAPICall]);

  const getTranscriptionLanguagesForApi = useCallback(async (apiId: string) => {
    if (!api || !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await handleAPICall(() => api.getTranscriptionLanguagesForApi(apiId), 'Get Transcription Languages');
  }, [api, isAuthenticated, handleAPICall]);

  const getTranslationApisForLanguage = useCallback(async (sourceLanguage: string, targetLanguage: string) => {
    if (!api || !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await api.getTranslationApisForLanguage(sourceLanguage, targetLanguage);
  }, [api, isAuthenticated]);

  const detectLanguage = useCallback(async (file: File | string, duration?: number) => {
    if (!api || !isAuthenticated) return { status: 'ERROR', errors: ['API not authenticated'] };
    return await api.detectLanguage(file, duration);
  }, [api, isAuthenticated]);

  const checkLanguageDetectionStatus = useCallback(async (correlationId: string) => {
    if (!api || !isAuthenticated) return { status: 'ERROR', errors: ['API not authenticated'] };
    return await api.checkLanguageDetectionStatus(correlationId);
  }, [api, isAuthenticated]);

  const initiateTranscription = useCallback(async (audioFile: File | string, options: any) => {
    if (!api || !isAuthenticated) return { status: 'ERROR', errors: ['API not authenticated'] };
    return await api.initiateTranscription(audioFile, options);
  }, [api, isAuthenticated]);

  const initiateTranslation = useCallback(async (subtitleFile: File | string, options: any) => {
    if (!api || !isAuthenticated) return { status: 'ERROR', errors: ['API not authenticated'] };
    return await api.initiateTranslation(subtitleFile, options);
  }, [api, isAuthenticated]);

  const checkTranscriptionStatus = useCallback(async (correlationId: string) => {
    if (!api || !isAuthenticated) return { status: 'ERROR', errors: ['API not authenticated'] };
    return await api.checkTranscriptionStatus(correlationId);
  }, [api, isAuthenticated]);

  const checkTranslationStatus = useCallback(async (correlationId: string) => {
    if (!api || !isAuthenticated) return { status: 'ERROR', errors: ['API not authenticated'] };
    return await api.checkTranslationStatus(correlationId);
  }, [api, isAuthenticated]);

  const downloadFile = useCallback(async (url: string) => {
    if (!api || !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await api.downloadFile(url);
  }, [api, isAuthenticated]);

  const getRecentMedia = useCallback(async () => {
    if (!api || !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await api.getRecentMedia();
  }, [api, isAuthenticated]);

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
    credits,
    transcriptionInfo,
    translationInfo,
    userInfo,
    isLoading,
    error,
    login,
    logout,
    refreshCredits,
    updateCredits,
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
    getRecentMedia,
    getTranslationLanguageNameSync,
    getTranscriptionLanguageNameSync
  };

  return (
    <APIContext.Provider value={contextValue}>
      {children}
    </APIContext.Provider>
  );
};