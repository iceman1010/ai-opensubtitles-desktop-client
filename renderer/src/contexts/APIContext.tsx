import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { OpenSubtitlesAPI, TranscriptionInfo, TranslationInfo } from '../services/api';
import { logger } from '../utils/errorLogger';

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
  detectLanguage: (file: File | string) => Promise<any>;
  checkLanguageDetectionStatus: (correlationId: string) => Promise<any>;
  initiateTranscription: (audioFile: File | string, options: any) => Promise<any>;
  initiateTranslation: (subtitleFile: File | string, options: any) => Promise<any>;
  checkTranscriptionStatus: (correlationId: string) => Promise<any>;
  checkTranslationStatus: (correlationId: string) => Promise<any>;
  downloadFile: (url: string) => Promise<{ success: boolean; content?: string; error?: string }>;
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

  // Initialize API instance when config is provided
  useEffect(() => {
    if (initialConfig?.apiKey) {
      const apiInstance = new OpenSubtitlesAPI(initialConfig.apiKey);
      setApi(apiInstance);
      
      // Try to authenticate immediately if we have credentials
      if (initialConfig.username && initialConfig.password) {
        authenticateUser(apiInstance, initialConfig.username, initialConfig.password);
      }
    }
  }, [initialConfig]);

  const authenticateUser = async (apiInstance: OpenSubtitlesAPI, username: string, password: string) => {
    // Prevent concurrent authentication attempts
    if (authenticationInProgress) {
      logger.warn('APIContext', 'Authentication already in progress, skipping duplicate attempt');
      return false;
    }
    
    setAuthenticationInProgress(true);
    setIsLoading(true);
    setError(null);
    
    try {
      logger.info('APIContext', 'Attempting authentication...');
      
      // Try to load cached token first
      const hasCachedToken = await apiInstance.loadCachedToken();
      if (hasCachedToken) {
        logger.info('APIContext', 'Using cached token, verifying with credits check');
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
    // Create new API instance with the provided key
    const apiInstance = new OpenSubtitlesAPI(apiKey);
    setApi(apiInstance);
    
    return await authenticateUser(apiInstance, username, password);
  }, []);

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

  // Centralized API methods
  const getServicesInfo = useCallback(async () => {
    if (!api || !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await api.getServicesInfo();
  }, [api, isAuthenticated]);

  const getCreditPackages = useCallback(async (email?: string) => {
    if (!api || !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await api.getCreditPackages(email);
  }, [api, isAuthenticated]);

  const getTranslationLanguagesForApi = useCallback(async (apiId: string) => {
    if (!api || !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await api.getTranslationLanguagesForApi(apiId);
  }, [api, isAuthenticated]);

  const getTranscriptionLanguagesForApi = useCallback(async (apiId: string) => {
    if (!api || !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await api.getTranscriptionLanguagesForApi(apiId);
  }, [api, isAuthenticated]);

  const getTranslationApisForLanguage = useCallback(async (sourceLanguage: string, targetLanguage: string) => {
    if (!api || !isAuthenticated) return { success: false, error: 'API not authenticated' };
    return await api.getTranslationApisForLanguage(sourceLanguage, targetLanguage);
  }, [api, isAuthenticated]);

  const detectLanguage = useCallback(async (file: File | string) => {
    if (!api || !isAuthenticated) return { status: 'ERROR', errors: ['API not authenticated'] };
    return await api.detectLanguage(file);
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
    downloadFile
  };

  return (
    <APIContext.Provider value={contextValue}>
      {children}
    </APIContext.Provider>
  );
};