import React, { useState, useEffect, useRef, useCallback } from 'react';
import FileSelector from './FileSelector';
import { getProcessingType } from '../config/fileFormats';
import { OpenSubtitlesAPI, LanguageInfo, TranscriptionInfo, TranslationInfo, DetectedLanguage, LanguageDetectionResult, APIResponse } from '../services/api';
import { logger } from '../utils/errorLogger';
import { parseSubtitleFile, formatDuration, formatCharacterCount, ParsedSubtitle } from '../utils/subtitleParser';
import ImprovedTranscriptionOptions from './ImprovedTranscriptionOptions';
import ImprovedTranslationOptions from './ImprovedTranslationOptions';
import { isOnline } from '../utils/networkUtils';
import { useAPI } from '../contexts/APIContext';
import { generateFilename } from '../utils/filenameGenerator';
import appConfig from '../config/appConfig.json';
import * as fileFormatsConfig from '../../../shared/fileFormats.json';

// Utility functions for file type checking
const isVideoFile = (fileName: string): boolean => {
  const ext = fileName.toLowerCase().split('.').pop();
  return ext ? fileFormatsConfig.video.includes(ext) : false;
};

const isAudioFile = (fileName: string): boolean => {
  const ext = fileName.toLowerCase().split('.').pop();
  return ext ? fileFormatsConfig.audio.includes(ext) : false;
};

const isSubtitleFile = (fileName: string): boolean => {
  const ext = fileName.toLowerCase().split('.').pop();
  return ext ? fileFormatsConfig.subtitle.includes(ext) : false;
};

const isAudioVideoFile = (fileName: string): boolean => {
  return isVideoFile(fileName) || isAudioFile(fileName);
};

const needsAudioConversion = (fileName: string): boolean => {
  const ext = fileName.toLowerCase().split('.').pop();
  const supportedAudioFormats = ['mp3', 'wav', 'flac', 'm4a'];
  return ext ? !supportedAudioFormats.includes(ext) : false;
};


interface AppConfig {
  username: string;
  password: string;
  apiKey?: string;
  lastUsedLanguage?: string;
  debugMode?: boolean;
  debugLevel?: number;
  checkUpdatesOnStart?: boolean;
  autoRemoveCompletedFiles?: boolean;
  cacheExpirationHours?: number;
  betaTest?: boolean;
  ffmpegPath?: string;
  audio_language_detection_time?: number;
  apiBaseUrl?: string;
  autoLanguageDetection?: boolean;
  darkMode?: boolean;
  pollingIntervalSeconds?: number;
  pollingTimeoutSeconds?: number;
  defaultFilenameFormat?: string;
  credits?: {
    used: number;
    remaining: number;
  };
}

interface MainScreenProps {
  config: AppConfig;
  setAppProcessing: (processing: boolean, task?: string) => void;
  onNavigateToCredits?: () => void;
  onNavigateToBatch?: (filePaths?: string[]) => void;
  pendingExternalFile?: string | null;
  onExternalFileProcessed?: () => void;
  onCreditsUpdate?: (credits: { used: number; remaining: number }) => void;
  onProcessingStateChange?: (isProcessing: boolean) => void;
}

function MainScreen({ config, setAppProcessing, onNavigateToCredits, onNavigateToBatch, pendingExternalFile, onExternalFileProcessed, onCreditsUpdate, onProcessingStateChange }: MainScreenProps) {
  const {
    isAuthenticated,
    credits,
    transcriptionInfo: contextTranscriptionInfo,
    translationInfo,
    refreshCredits,
    updateCredits,
    getTranslationLanguagesForApi,
    getTranscriptionLanguagesForApi,
    getTranslationLanguageNameSync,
    getTranscriptionLanguageNameSync,
    getTranslationApisForLanguage,
    detectLanguage,
    checkLanguageDetectionStatus,
    initiateTranscription,
    initiateTranslation,
    checkTranscriptionStatus,
    checkTranslationStatus,
    downloadFile
  } = useAPI();


  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileType, setFileType] = useState<'transcription' | 'translation' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [translationOptions, setTranslationOptions] = useState({
    sourceLanguage: 'auto',
    destinationLanguage: '',
    model: '',
    format: fileFormatsConfig.subtitle[0] || 'srt'
  });
  const [transcriptionOptions, setTranscriptionOptions] = useState({
    language: '',
    model: '',
    format: fileFormatsConfig.subtitle[0] || 'srt'
  });
  const [availableTranslationLanguages, setAvailableTranslationLanguages] = useState<LanguageInfo[]>([]);
  const [availableTranslationApis, setAvailableTranslationApis] = useState<string[]>([]);
  const [availableTranscriptionLanguages, setAvailableTranscriptionLanguages] = useState<LanguageInfo[]>([]);
  const [availableTranscriptionApis, setAvailableTranscriptionApis] = useState<string[]>([]);
  const [isLoadingDynamicOptions, setIsLoadingDynamicOptions] = useState(false);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);
  const [detectedLanguage, setDetectedLanguage] = useState<DetectedLanguage | null>(null);
  const [isDetectingLanguage, setIsDetectingLanguage] = useState(false);
  const [languageDetectionCorrelationId, setLanguageDetectionCorrelationId] = useState<string | null>(null);
  const [showLanguageDetectionResult, setShowLanguageDetectionResult] = useState(false);
  const [compatibleModels, setCompatibleModels] = useState<{
    translation: string[];
    transcription: string[];
  }>({ translation: [], transcription: [] });
  const [creditsAnimating, setCreditsAnimating] = useState(false);
  const [fileInfo, setFileInfo] = useState<{
    duration?: number;
    hasAudio?: boolean;
    hasVideo?: boolean;
    format?: string;
    subtitleInfo?: ParsedSubtitle;
  } | null>(null);
  const [isDragOverWindow, setIsDragOverWindow] = useState(false);
  const [isLoadingFileInfo, setIsLoadingFileInfo] = useState(false);
  const [isNetworkOnline, setIsNetworkOnline] = useState(isOnline());
  const hasAttemptedLogin = useRef(false);
  const [showCreditModal, setShowCreditModal] = useState(false);
  const languageDetectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to clear language detection timeout
  const clearLanguageDetectionTimeout = () => {
    if (languageDetectionTimeoutRef.current) {
      clearTimeout(languageDetectionTimeoutRef.current);
      languageDetectionTimeoutRef.current = null;
    }
  };

  // Helper function to clear polling timeout
  const clearPollingTimeout = () => {
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
  };

  // Function to stop current processing
  const handleStopProcess = () => {
    console.log('handleStopProcess called');
    logger.info('MainScreen', 'User requested to stop process');

    // Clear any active polling
    clearPollingTimeout();

    // Reset processing states
    console.log('Setting isProcessing to false');
    setIsProcessing(false);
    setAppProcessing(false);

    // Show cancellation message
    setStatusMessage({
      type: 'info',
      message: 'Process cancelled by user'
    });
  };

  // Report processing state changes to parent component
  useEffect(() => {
    onProcessingStateChange?.(isProcessing);
  }, [isProcessing, onProcessingStateChange]);

  // Initialize API info when context provides data
  useEffect(() => {
    if (contextTranscriptionInfo) {
      setAvailableTranscriptionApis(contextTranscriptionInfo.apis);

      // Set default transcription model and language
      if (contextTranscriptionInfo.apis.length > 0) {
        const defaultModel = contextTranscriptionInfo.apis[0];
        logger.info('MainScreen', `Setting default transcription model: ${defaultModel}`);
        setTranscriptionOptions(prev => ({ ...prev, model: defaultModel }));

        // Load languages for default model
        loadTranscriptionLanguages(defaultModel);
      }
    }
  }, [contextTranscriptionInfo]);

  useEffect(() => {
    if (translationInfo) {
      setAvailableTranslationApis(translationInfo.apis);
      
      // Set default translation model and load languages
      if (translationInfo.apis.length > 0) {
        const defaultModel = translationInfo.apis[0];
        logger.info('MainScreen', `Setting default translation model: ${defaultModel}`);
        setTranslationOptions(prev => ({ ...prev, model: defaultModel }));
        
        // Load languages for default model  
        loadTranslationLanguages(defaultModel);
      }
    }
  }, [translationInfo]);

  // Language loading functions
  const loadTranscriptionLanguages = async (model: string) => {
    if (!contextTranscriptionInfo) return;
    
    try {
      let languages: LanguageInfo[] = [];
      
      if (Array.isArray(contextTranscriptionInfo.languages)) {
        // Simple array format - use all languages
        languages = contextTranscriptionInfo.languages;
      } else if (typeof contextTranscriptionInfo.languages === 'object' && contextTranscriptionInfo.languages[model]) {
        // Grouped by API - get languages for specific model
        languages = contextTranscriptionInfo.languages[model];
      }
      
      setAvailableTranscriptionLanguages(languages);
      
      // Set default language - prioritize English or take first available
      if (languages.length > 0) {
        const defaultLang = languages.find(lang => lang.language_code === 'en') || languages[0];
        logger.info('MainScreen', `Setting default transcription language: ${defaultLang.language_code}`);
        setTranscriptionOptions(prev => ({ ...prev, language: defaultLang.language_code }));
      }
    } catch (error) {
      logger.error('MainScreen', 'Failed to load transcription languages:', error);
    }
  };

  const loadTranslationLanguages = async (model: string) => {
    if (!translationInfo) return;
    
    try {
      let languages: LanguageInfo[] = [];
      
      if (typeof translationInfo.languages === 'object' && translationInfo.languages[model]) {
        languages = translationInfo.languages[model];
      }
      
      setAvailableTranslationLanguages(languages);
      logger.info('MainScreen', `Loaded ${languages.length} languages for translation model ${model}`);
    } catch (error) {
      logger.error('MainScreen', 'Failed to load translation languages:', error);
    }
  };

  // Handle external file from App.tsx (command line or file association)
  useEffect(() => {
    if (pendingExternalFile) {
      logger.debug(1, 'MainScreen', `Processing external file: ${pendingExternalFile}`);
      handleFileSelect(pendingExternalFile);
      onExternalFileProcessed?.();
    }
  }, [pendingExternalFile, onExternalFileProcessed]);


  // Authentication is now handled by APIContext - no individual login needed

  // Remove automatic API info loading on component mount
  // API info should only be loaded after successful login

  // Initialize options when API info is available from context
  useEffect(() => {
    if (translationInfo) {
      setAvailableTranslationApis(translationInfo.apis);
      if (translationInfo.apis.length > 0) {
        const defaultModel = translationInfo.apis[0];
        setTranslationOptions(prev => ({ ...prev, model: defaultModel }));
        loadLanguagesForTranslationModel(defaultModel, translationInfo);
      }
    }
  }, [translationInfo]);

  useEffect(() => {
    if (contextTranscriptionInfo) {
      if (contextTranscriptionInfo.apis.length > 0) {
        setTranscriptionOptions(prev => ({ ...prev, model: contextTranscriptionInfo.apis[0] }));
      }
      // Set default language - handle both array and grouped structures
      let defaultLang = null;
      if (Array.isArray(contextTranscriptionInfo.languages)) {
        if (contextTranscriptionInfo.languages.length > 0) {
          defaultLang = contextTranscriptionInfo.languages.find(lang => lang.language_code === 'en') || contextTranscriptionInfo.languages[0];
        }
      } else if (typeof contextTranscriptionInfo.languages === 'object') {
        const defaultModel = contextTranscriptionInfo.apis[0];
        const modelLanguages = contextTranscriptionInfo.languages[defaultModel];
        if (modelLanguages && Array.isArray(modelLanguages) && modelLanguages.length > 0) {
          defaultLang = modelLanguages.find(lang => lang.language_code === 'en') || modelLanguages[0];
        }
      }
      
      if (defaultLang) {
        setTranscriptionOptions(prev => ({ ...prev, language: defaultLang.language_code }));
      } else {
        setTranscriptionOptions(prev => ({ ...prev, language: 'auto' }));
      }
    }
  }, [contextTranscriptionInfo]);

  // Window-level drag and drop handlers
  useEffect(() => {
    const handleWindowDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (isProcessing || isDetectingLanguage) return;

      // Check if the drag is happening over a FileSelector
      const target = e.target as HTMLElement;
      if (target?.closest('.file-selector') || target?.closest('.file-drop-zone')) {
        return; // Let FileSelector handle this
      }

      setIsDragOverWindow(true);
    };

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (isProcessing || isDetectingLanguage) return;

      // Check if the drag is happening over a FileSelector
      const target = e.target as HTMLElement;
      if (target?.closest('.file-selector') || target?.closest('.file-drop-zone')) {
        return; // Let FileSelector handle this
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault();
      // Only hide if we're leaving the window entirely
      if (!e.relatedTarget || !document.contains(e.relatedTarget as Node)) {
        setIsDragOverWindow(false);
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragOverWindow(false);

      if (isProcessing || isDetectingLanguage) return;

      // Check if the drop is happening over a FileSelector
      const target = e.target as HTMLElement;
      if (target?.closest('.file-selector') || target?.closest('.file-drop-zone')) {
        return; // Let FileSelector handle this
      }

      const files = Array.from(e.dataTransfer?.files || []);

      if (files.length > 0) {
        if (files.length === 1) {
          // Use webUtils to get the real file path
          const filePath = window.electronAPI.getFilePath(files[0]);
          if (filePath) {
            handleFileSelect(filePath);
          }
        } else {
          // Multiple files - get paths using webUtils
          const filePaths = files
            .map(file => window.electronAPI.getFilePath(file))
            .filter((path): path is string => path !== null);

          if (filePaths.length > 0) {
            handleMultipleFileSelect(filePaths);
          }
        }
      }
    };

    // Add listeners to document to capture window-wide events
    document.addEventListener('dragenter', handleWindowDragEnter);
    document.addEventListener('dragover', handleWindowDragOver);
    document.addEventListener('dragleave', handleWindowDragLeave);
    document.addEventListener('drop', handleWindowDrop);

    return () => {
      document.removeEventListener('dragenter', handleWindowDragEnter);
      document.removeEventListener('dragover', handleWindowDragOver);
      document.removeEventListener('dragleave', handleWindowDragLeave);
      document.removeEventListener('drop', handleWindowDrop);
    };
  }, [isProcessing, isDetectingLanguage]);

  // Credits loading now handled by APIContext

  const detectLanguageForFile = async () => {
    if (!selectedFile || isDetectingLanguage) return;

    setIsDetectingLanguage(true);
    setDetectedLanguage(null);
    setShowLanguageDetectionResult(false);
    setCompatibleModels({ translation: [], transcription: [] });
    
    // Set up 60-second timeout
    languageDetectionTimeoutRef.current = setTimeout(() => {
      logger.warn('MainScreen', 'Language detection timed out after 60 seconds');
      setStatusMessage({
        type: 'error',
        message: 'Language detection timed out. Please try again.'
      });
      setIsDetectingLanguage(false);
      setAppProcessing(false);
      setLanguageDetectionCorrelationId(null);
      clearLanguageDetectionTimeout();
    }, 60000); // 60 seconds
    
    try {
      logger.info('MainScreen', 'Starting language detection for file:', selectedFile);
      
      let fileToProcess = selectedFile;
      
      // Check if it's a video/audio file that needs audio extraction
      const fileName = typeof selectedFile === 'string' ? selectedFile : selectedFile.name;
      const isVideoOrAudio = isAudioVideoFile(fileName);
      
      if (isVideoOrAudio) {
        setStatusMessage({ 
          type: 'info', 
          message: 'Extracting first 3 minutes of audio for language detection...' 
        });
        setAppProcessing(true, 'Extracting audio for language detection...');
        
        // Extract audio for language detection using configured duration
        const durationSeconds = config.audio_language_detection_time ?? 240;
        const extractedPath = await window.electronAPI.extractAudio(
          typeof selectedFile === 'string' ? selectedFile : selectedFile.path,
          undefined, // Let system choose temp path
          undefined, // No progress callback for now
          durationSeconds
        );
        
        if (extractedPath) {
          fileToProcess = extractedPath;
          setStatusMessage({ 
            type: 'info', 
            message: 'Audio extracted, detecting language...' 
          });
          setAppProcessing(true, 'Detecting language...');
        } else {
          throw new Error('Failed to extract audio from video file');
        }
      } else {
        // For text files, start detection immediately
        setAppProcessing(true, 'Detecting language...');
      }
      
      const durationSeconds = config.audio_language_detection_time ?? 240;
      const result = await detectLanguage(fileToProcess, durationSeconds);
      
      if (result.data?.language) {
        // Text file - immediate result with data wrapper
        await handleDetectedLanguage(result.data.language);
        
        // Clean up extracted audio file if it was created
        if (isVideoOrAudio && fileToProcess !== selectedFile) {
          try {
            await window.electronAPI.deleteFile(fileToProcess as string);
          } catch (cleanupError) {
            logger.warn('MainScreen', 'Failed to cleanup extracted audio file:', cleanupError);
          }
        }
      } else if (result.correlation_id) {
        // Audio file - need to poll for completion
        setLanguageDetectionCorrelationId(result.correlation_id);
        setStatusMessage({ 
          type: 'info', 
          message: 'Processing audio file for language detection...' 
        });
        setAppProcessing(true, 'Processing audio for language detection...');
        pollLanguageDetection(result.correlation_id);
        
        // Note: Cleanup of extracted file will happen after polling completes
        if (isVideoOrAudio && fileToProcess !== selectedFile) {
          // Store for cleanup after polling
          (window as any).tempAudioFile = fileToProcess;
        }
      } else if (result.status === 'ERROR') {
        throw new Error(result.errors?.join(', ') || 'Language detection failed');
      } else {
        throw new Error('Unexpected response from language detection');
      }
    } catch (error) {
      logger.error('MainScreen', 'Language detection failed', error);
      setStatusMessage({ 
        type: 'error', 
        message: `Language detection failed: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
      setIsDetectingLanguage(false);
      setAppProcessing(false);
    } finally {
      // Clear the timeout
      clearLanguageDetectionTimeout();
    }
  };

  const pollLanguageDetection = async (correlationId: string) => {
    const startTime = Date.now();
    const pollingInterval = (config.pollingIntervalSeconds || 10) * 1000; // Convert to milliseconds
    const timeoutMs = (config.pollingTimeoutSeconds || 7200) * 1000; // Default 2 hours

    const poll = async () => {
      try {
        const elapsedMs = Date.now() - startTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);

        // Update status with elapsed time
        setStatusMessage({
          type: 'info',
          message: `Processing audio for language detection... (${elapsedSeconds}s elapsed)`
        });
        setAppProcessing(true, `Processing audio for language detection... (${elapsedSeconds}s elapsed)`);

        const result = await checkLanguageDetectionStatus(correlationId);

        if (result.status === 'COMPLETED' && result.data?.language) {
          await handleDetectedLanguage(result.data.language);
          setLanguageDetectionCorrelationId(null);

          // Clean up temporary audio file if it exists
          if ((window as any).tempAudioFile) {
            try {
              await window.electronAPI.deleteFile((window as any).tempAudioFile);
              (window as any).tempAudioFile = null;
            } catch (cleanupError) {
              logger.warn('MainScreen', 'Failed to cleanup temp audio file after polling:', cleanupError);
            }
          }
        } else if (result.status === 'ERROR') {
          throw new Error(result.errors?.join(', ') || 'Language detection failed');
        } else if (result.status === 'TIMEOUT') {
          throw new Error('Language detection timed out');
        } else if (elapsedMs >= timeoutMs) {
          const timeoutMinutes = Math.floor(timeoutMs / 60000);
          throw new Error(`Language detection timed out after ${timeoutMinutes} minutes`);
        } else {
          // Still processing, poll again
          setTimeout(poll, pollingInterval);
        }
      } catch (error) {
        logger.error('MainScreen', 'Language detection polling failed', error);
        setStatusMessage({
          type: 'error',
          message: `Language detection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        });
        setIsDetectingLanguage(false);
        setLanguageDetectionCorrelationId(null);
        setAppProcessing(false);
        clearLanguageDetectionTimeout();

        // Clean up temporary audio file if it exists
        if ((window as any).tempAudioFile) {
          try {
            await window.electronAPI.deleteFile((window as any).tempAudioFile);
            (window as any).tempAudioFile = null;
          } catch (cleanupError) {
            logger.warn('MainScreen', 'Failed to cleanup temp audio file after polling error:', cleanupError);
          }
        }
      }
    };

    poll();
  };

  const handleDetectedLanguage = async (language: DetectedLanguage) => {
    setDetectedLanguage(language);
    setShowLanguageDetectionResult(true);
    setIsDetectingLanguage(false);
    clearLanguageDetectionTimeout();
    
    setStatusMessage({ 
      type: 'success', 
      message: `Language detected: ${language.name} (${language.native})` 
    });
    setAppProcessing(true, 'Finding compatible AI models...');

    // Find compatible models
    await findCompatibleModels(language.ISO_639_1);
    
    // Language detection complete
    setAppProcessing(false);
    
    // Auto-update language selections if not already set
    if (fileType === 'translation' && translationOptions.sourceLanguage === 'auto') {
      setTranslationOptions(prev => ({ 
        ...prev, 
        sourceLanguage: language.ISO_639_1 
      }));
    } else if (fileType === 'transcription' && !transcriptionOptions.language) {
      setTranscriptionOptions(prev => ({ 
        ...prev, 
        language: language.ISO_639_1 
      }));
    }
  };

  const findCompatibleModels = async (languageCode: string) => {
    const compatible = { translation: [], transcription: [] };
    
    // Determine what type of file we're working with
    const fileName = typeof selectedFile === 'string' ? selectedFile : selectedFile?.name || '';
    const isSubtitle = isSubtitleFile(fileName);
    const isAudioVideo = isAudioVideoFile(fileName);
    
    logger.info('MainScreen', 'findCompatibleModels debug:', {
      languageCode,
      fileName,
      selectedFile,
      isSubtitle,
      isAudioVideo,
      contextTranscriptionInfoApis: contextTranscriptionInfo?.apis,
      translationInfoApis: translationInfo?.apis
    });
    
    // Only check translation models for subtitle files
    if (isSubtitle && translationInfo?.apis) {
      for (const apiName of translationInfo.apis) {
        try {
          const result = await getTranslationLanguagesForApi(apiName);
          if (result.success && result.data) {
            // The data structure is { data: { data: { apiName: [languages] } } }
            const apiLanguages = result.data.data?.[apiName] || result.data[apiName] || result.data;
            
            if (Array.isArray(apiLanguages)) {
              // Smart language matching - check multiple possible formats
              const hasLanguage = apiLanguages.some(lang => {
                const apiLangCode = lang.language_code.toLowerCase();
                const detectedCode = languageCode.toLowerCase();
                
                // Direct match (e.g., "en" matches "en")
                if (apiLangCode === detectedCode) return true;
                
                // Base language match (e.g., "en" matches "en-US", "en_us", "en-GB")
                if (apiLangCode.startsWith(detectedCode + '-') || 
                    apiLangCode.startsWith(detectedCode + '_')) return true;
                
                // Common alternative formats
                const baseApiCode = apiLangCode.split(/[-_]/)[0];
                if (baseApiCode === detectedCode) return true;
                
                return false;
              });
              
              if (hasLanguage) {
                compatible.translation.push(apiName);
              }
            }
          }
        } catch (error) {
          logger.warn('MainScreen', `Failed to check translation API ${apiName}`, error);
        }
      }
    }
    
    // Only check transcription models for audio/video files
    if (isAudioVideo && contextTranscriptionInfo?.apis) {
      logger.info('MainScreen', `Checking ${contextTranscriptionInfo.apis.length} transcription APIs for language: ${languageCode}`);
      
      for (const apiName of contextTranscriptionInfo.apis) {
        try {
          const result = await getTranscriptionLanguagesForApi(apiName);
          logger.info('MainScreen', `API ${apiName} result:`, { success: result.success, dataLength: result.data?.length });
          
          if (result.success && result.data) {
            // Debug: Let's see the exact structure
            logger.info('MainScreen', `${apiName} raw result.data:`, result.data);
            logger.info('MainScreen', `${apiName} result.data keys:`, Object.keys(result.data));
            
            // The data structure is { data: { data: { apiName: [languages] } } }
            const apiLanguages = result.data.data?.[apiName] || result.data[apiName] || result.data;
            logger.info('MainScreen', `${apiName} apiLanguages:`, apiLanguages);
            logger.info('MainScreen', `${apiName} apiLanguages type:`, typeof apiLanguages, Array.isArray(apiLanguages));
            
            if (Array.isArray(apiLanguages)) {
              const supportedCodes = apiLanguages.map(l => l.language_code);
              logger.info('MainScreen', `${apiName} supported codes (first 10):`, supportedCodes.slice(0, 10));
              
              // Smart language matching - check multiple possible formats
              const matchingLangs = apiLanguages.filter(lang => {
                const apiLangCode = lang.language_code.toLowerCase();
                const detectedCode = languageCode.toLowerCase();
                
                // Direct match (e.g., "en" matches "en")
                if (apiLangCode === detectedCode) return true;
                
                // Base language match (e.g., "en" matches "en-US", "en_us", "en-GB")
                if (apiLangCode.startsWith(detectedCode + '-') || 
                    apiLangCode.startsWith(detectedCode + '_')) return true;
                
                // Common alternative formats
                const baseApiCode = apiLangCode.split(/[-_]/)[0];
                if (baseApiCode === detectedCode) return true;
                
                return false;
              });
              
              logger.info('MainScreen', `${apiName} matching languages for "${languageCode}":`, matchingLangs.map(l => l.language_code));
              
              if (matchingLangs.length > 0) {
                compatible.transcription.push(apiName);
                logger.info('MainScreen', `✓ ${apiName} added to compatible transcription models`);
              } else {
                logger.info('MainScreen', `✗ ${apiName} does not support language "${languageCode}"`);
              }
            } else {
              logger.warn('MainScreen', `${apiName} data is not an array:`, typeof apiLanguages, apiLanguages);
            }
          } else {
            logger.warn('MainScreen', `${apiName} API call failed or returned no data`);
          }
        } catch (error) {
          logger.warn('MainScreen', `Failed to check transcription API ${apiName}`, error);
        }
      }
    } else {
      logger.info('MainScreen', 'Skipping transcription check:', { 
        isAudioVideo, 
        hasTranscriptionInfo: !!contextTranscriptionInfo,
        hasApis: !!contextTranscriptionInfo?.apis 
      });
    }
    
    setCompatibleModels(compatible);
    logger.info('MainScreen', 'Compatible models found:', compatible);
  };

  const triggerCreditsAnimation = () => {
    setCreditsAnimating(true);
    setTimeout(() => {
      setCreditsAnimating(false);
    }, 1000); // Animation duration
  };

  const loadLanguagesForTranslationModel = async (modelId: string, translationData?: TranslationInfo) => {
    setIsLoadingDynamicOptions(true);
    try {
      logger.info('MainScreen', `Loading languages for translation model: ${modelId}`);
      
      // Use provided data or fall back to state
      const dataToUse = translationData || translationInfo;
      
      // Check if we already have the languages data from the initial load
      if (dataToUse && dataToUse.languages && dataToUse.languages[modelId]) {
        const modelLanguages = dataToUse.languages[modelId];
        logger.info('MainScreen', `Using cached languages for model ${modelId}: ${modelLanguages.length} languages`);
        setAvailableTranslationLanguages(modelLanguages);
        
        // Update destination language if current selection is not available
        const currentDestLang = translationOptions.destinationLanguage;
        const isCurrentLangAvailable = modelLanguages.some(lang => lang.language_code === currentDestLang);
        
        // Don't auto-select destination language - let user choose explicitly
        setIsLoadingDynamicOptions(false);
        return;
      }
      
      // Fallback to API call if not in cached data
      const result = await getTranslationLanguagesForApi(modelId);
      logger.info('MainScreen', 'Translation languages result:', result);
      
      if (result.success && result.data) {
        // Ensure data is an array
        const languagesArray = Array.isArray(result.data) ? result.data : [];
        logger.info('MainScreen', `Received ${languagesArray.length} languages for model ${modelId}`);
        
        // Only update if we actually got languages, otherwise keep the current ones
        if (languagesArray.length > 0) {
          setAvailableTranslationLanguages(languagesArray);
          
          // Update destination language if current selection is not available
          const currentDestLang = translationOptions.destinationLanguage;
          const isCurrentLangAvailable = languagesArray.some(lang => lang.language_code === currentDestLang);
          
          // Don't auto-select destination language - let user choose explicitly
        } else {
          logger.warn('MainScreen', `No languages returned for model ${modelId}, keeping current languages`);
        }
      } else {
        logger.error('MainScreen', 'Failed to load languages for model', result.error);
        // Don't clear languages on failure, keep the current ones
      }
    } catch (error) {
      logger.error('MainScreen', 'Exception loading languages for model', error);
      // Don't clear languages on exception, keep the current ones
    } finally {
      setIsLoadingDynamicOptions(false);
    }
  };

  const loadModelsForTranslationLanguage = async (sourceLanguage: string, targetLanguage: string) => {
    setIsLoadingDynamicOptions(true);
    try {
      const result = await getTranslationApisForLanguage(sourceLanguage, targetLanguage);
      if (result.success && result.data) {
        setAvailableTranslationApis(result.data);
        
        // Update model if current selection is not available
        const currentModel = translationOptions.model;
        const isCurrentModelAvailable = result.data.includes(currentModel);
        
        if (!isCurrentModelAvailable && result.data.length > 0) {
          const defaultModel = result.data[0];
          setTranslationOptions(prev => ({ ...prev, model: defaultModel }));
        }
      }
    } catch (error) {
      console.error('Failed to load models for language pair:', error);
    } finally {
      setIsLoadingDynamicOptions(false);
    }
  };

  const handleTranslationModelChange = (newModel: string) => {
    setTranslationOptions(prev => ({ ...prev, model: newModel }));
    loadLanguagesForTranslationModel(newModel);
  };

  const handleTranslationLanguageChange = (field: 'sourceLanguage' | 'destinationLanguage', newLanguage: string) => {
    logger.debug(2, 'MainScreen', 'handleTranslationLanguageChange called', {
      field,
      newLanguage,
      currentOptions: translationOptions
    });

    const updatedOptions = { ...translationOptions, [field]: newLanguage };
    logger.debug(2, 'MainScreen', 'Setting updated options', updatedOptions);

    setTranslationOptions(updatedOptions);

    // Load compatible models for this language pair
    if (updatedOptions.sourceLanguage && updatedOptions.destinationLanguage) {
      logger.debug(2, 'MainScreen', 'Loading models for language pair', {
        source: updatedOptions.sourceLanguage,
        dest: updatedOptions.destinationLanguage
      });
      loadModelsForTranslationLanguage(updatedOptions.sourceLanguage, updatedOptions.destinationLanguage);
    }
  };

  const analyzeSelectedFile = async (filePath: string) => {
    setIsLoadingFileInfo(true);
    setFileInfo(null);
    
    try {
      const processingType = getProcessingType(filePath);
      
      if (processingType === 'transcription') {
        // It's an audio or video file - try to get media info to validate
        try {
          const mediaInfo = await window.electronAPI.getMediaInfo(filePath);
          
          // Check if it's actually a valid media file
          if (!mediaInfo.hasAudio && !mediaInfo.hasVideo) {
            throw new Error('File does not contain audio or video streams');
          }
          
          setFileInfo({
            duration: mediaInfo.duration,
            hasAudio: mediaInfo.hasAudio,
            hasVideo: mediaInfo.hasVideo,
            format: mediaInfo.format
          });
        } catch (mediaError: any) {
          // File extension suggests it's media, but FFmpeg can't read it
          logger.error('MainScreen', `Invalid media file (path: ${filePath}):`, mediaError);
          
          // Show detailed error only in debug mode, simple message otherwise
          let errorMessage = 'File is not a valid audio or video file';
          if (config.debugMode) {
            errorMessage = mediaError.message || errorMessage;
          }
          
          setStatusMessage({
            type: 'error',
            message: `Invalid media file: ${errorMessage}`
          });
          setFileType(null);
          return;
        }
      } else if (processingType === 'translation') {
        // It's a subtitle file - parse text content
        try {
          const textFile = await window.electronAPI.readTextFile(filePath);
          const subtitleInfo = parseSubtitleFile(textFile.content, textFile.fileName);
          
          // Validate that we actually got some text content
          if (subtitleInfo.characterCount === 0) {
            throw new Error('Subtitle file appears to be empty or contains no readable text');
          }
          
          setFileInfo({
            subtitleInfo
          });
        } catch (subtitleError: any) {
          logger.error('MainScreen', 'Invalid subtitle file:', subtitleError);
          
          // Show detailed error only in debug mode, simple message otherwise
          let errorMessage = 'File is not a valid subtitle file';
          if (config.debugMode) {
            errorMessage = subtitleError.message || errorMessage;
          }
          
          setStatusMessage({
            type: 'error',
            message: `Invalid subtitle file: ${errorMessage}`
          });
          setFileType(null);
          return;
        }
      }
    } catch (error: any) {
      logger.error('MainScreen', 'Failed to analyze file:', error);
      
      // Show detailed error only in debug mode, simple message otherwise
      let errorMessage = 'Failed to analyze file. Please check the file format and try again.';
      if (config.debugMode) {
        errorMessage = error.message || errorMessage;
      }
      
      setStatusMessage({
        type: 'error',
        message: errorMessage
      });
      setFileType(null);
    } finally {
      setIsLoadingFileInfo(false);
    }
  };

  const handleFileSelect = (filePath: string) => {
    setSelectedFile(filePath);
    const processingType = getProcessingType(filePath);
    setFileType(processingType === 'unknown' ? null : processingType);
    setStatusMessage(null);
    
    // Reset language detection state when new file is selected
    setDetectedLanguage(null);
    setShowLanguageDetectionResult(false);
    setCompatibleModels({ translation: [], transcription: [] });
    setIsDetectingLanguage(false);
    clearLanguageDetectionTimeout();
    
    // Clear any ongoing language detection status bar messages
    if (isDetectingLanguage) {
      setAppProcessing(false);
    }
    
    // Analyze the file for additional information
    if (processingType !== 'unknown') {
      analyzeSelectedFile(filePath);
    }
  };

  const handleMultipleFileSelect = (filePaths: string[]) => {
    // Redirect to batch screen when multiple files are dropped
    if (onNavigateToBatch) {
      setStatusMessage({ 
        type: 'info', 
        message: `Redirecting to batch screen for ${filePaths.length} files...` 
      });
      setTimeout(() => {
        onNavigateToBatch(filePaths);
      }, 500); // Small delay to show the message
    }
  };

  const handleProcess = async () => {
    if (!selectedFile || !fileType) return;

    // Check if credits are available
    if (credits === 0) {
      setShowCreditModal(true);
      return;
    }

    console.log('Setting isProcessing to true');
    setIsProcessing(true);
    setAppProcessing(true, fileType === 'transcription' ? 'Transcribing...' : 'Translating...');
    setStatusMessage({ type: 'info', message: 'Processing file...' });

    // Prevent system sleep during processing
    try {
      const sleepPrevented = await window.electronAPI.preventSystemSleep();
      if (sleepPrevented) {
        logger.debug(3, 'MainScreen', 'System sleep prevention activated');
      } else {
        logger.warn('MainScreen', 'Failed to prevent system sleep');
      }
    } catch (error) {
      logger.warn('MainScreen', 'Error preventing system sleep:', error);
    }

    let tempAudioFile: string | null = null;
    let isPollingMode = false;

    try {
      let fileToProcess = selectedFile;
      
      // Check if the file is a video and needs audio extraction
      if (fileType === 'transcription') {
        const mediaInfo = await window.electronAPI.getMediaInfo(selectedFile);
        
        if (mediaInfo.hasVideo && mediaInfo.hasAudio) {
          setStatusMessage({ type: 'info', message: 'Extracting audio from video...' });
          
          // Extract audio from video
          try {
            tempAudioFile = await window.electronAPI.extractAudio(selectedFile);
            fileToProcess = tempAudioFile;
            setStatusMessage({ type: 'info', message: 'Audio extraction completed. Starting transcription...' });
          } catch (error) {
            throw new Error(`Audio extraction failed: ${error.message}`);
          }
        } else if (mediaInfo.hasAudio && !mediaInfo.hasVideo) {
          // It's already an audio file, but may need conversion
          if (needsAudioConversion(selectedFile)) {
            setStatusMessage({ type: 'info', message: 'Converting audio format...' });
            
            try {
              tempAudioFile = await window.electronAPI.convertAudio(selectedFile);
              fileToProcess = tempAudioFile;
              setStatusMessage({ type: 'info', message: 'Audio conversion completed. Starting transcription...' });
            } catch (error) {
              throw new Error(`Audio conversion failed: ${error.message}`);
            }
          } else {
            setStatusMessage({ type: 'info', message: 'Starting transcription...' });
          }
        } else {
          setStatusMessage({ type: 'info', message: 'Starting transcription...' });
        }
      }
      
      let result;
      
      if (fileType === 'transcription') {
        if (!transcriptionOptions.language || !transcriptionOptions.model) {
          throw new Error('Please select both language and model for transcription');
        }
        
        result = await initiateTranscription(fileToProcess, {
          language: transcriptionOptions.language,
          api: transcriptionOptions.model,
          returnContent: true
        });
      } else {
        setStatusMessage({ type: 'info', message: 'Starting translation...' });
        
        if (!translationOptions.sourceLanguage || !translationOptions.destinationLanguage || !translationOptions.model) {
          throw new Error('Please select source language, destination language, and model for translation');
        }
        
        result = await initiateTranslation(selectedFile, {
          translateFrom: translationOptions.sourceLanguage,
          translateTo: translationOptions.destinationLanguage,
          api: translationOptions.model,
          returnContent: true
        });
      }
      
      logger.info('MainScreen', `${fileType} result:`, result);
      
      if (result.status === 'ERROR') {
        // Extract error messages properly, handling both string and object errors
        const errorMessages = result.errors?.map(error =>
          typeof error === 'string' ? error : error.message || error.toString()
        ).join(', ') || `${fileType} failed`;

        throw new Error(errorMessages);
      }
      
      if (result.status === 'COMPLETED' && result.data) {
        // Calculate credits used and create message
        let message = `${fileType === 'transcription' ? 'Transcription' : 'Translation'} completed successfully!`;
        if (typeof result.data.total_price === 'number' && result.data.total_price > 0) {
          message += ` (${result.data.total_price} credits used)`;
        }
        
        setStatusMessage({ 
          type: 'success', 
          message: message
        });
        
        // Update credits from the response with animation trigger
        if (typeof result.data.credits_left === 'number') {
          const oldCredits = credits;
          const usedCredits = result.data.total_price || 0;
          
          // Update global config with credits
          onCreditsUpdate?.({
            used: usedCredits,
            remaining: result.data.credits_left
          });
          
          // Trigger animation if credits actually changed
          if (oldCredits !== null && oldCredits !== result.data.credits_left) {
            try {
              triggerCreditsAnimation();
            } catch (error) {
              logger.error('MainScreen', 'Credits animation error:', error);
            }
          }
        }
        
        // If we have content, show it in preview
        if (result.data.url) {
          // Download the result file content
          const downloadResult = await downloadFile(result.data.url);
          if (downloadResult.success && downloadResult.content) {
            setPreviewContent(downloadResult.content);
            setShowPreview(true);
          }
        }
      } else if (result.correlation_id) {
        // Task was created, need to poll for completion
        setStatusMessage({ type: 'info', message: 'Task created, waiting for completion...' });

        // Clean up temporary files before polling
        if (tempAudioFile && tempAudioFile !== selectedFile) {
          try {
            await window.electronAPI.deleteFile(tempAudioFile);
            logger.info('MainScreen', 'Cleaned up temporary audio file:', tempAudioFile);
          } catch (cleanupError) {
            logger.warn('MainScreen', 'Failed to clean up temporary file:', cleanupError);
          }
        }

        // Set flag to indicate we're entering polling mode
        isPollingMode = true;
        console.log('Entering polling mode - finally block will NOT reset isProcessing');

        // Start polling - this will handle resetting isProcessing when done
        await pollForCompletion(result.correlation_id, fileType);
        return; // Exit early to avoid finally block
      } else {
        throw new Error('Unexpected response format');
      }

    } catch (error: any) {
      logger.error('MainScreen', `${fileType} error:`, error);

      // Always show API error details, fallback to generic message for other errors
      let errorMessage = 'Processing failed. Please try again.';
      if (error.message && error.message !== 'An unexpected error occurred') {
        errorMessage = error.message;
      }

      setStatusMessage({
        type: 'error',
        message: `${fileType === 'transcription' ? 'Transcription' : 'Translation'} failed: ${errorMessage}`
      });
    } finally {
      // Clean up temporary audio files (only if not already done in polling path)
      if (!isPollingMode && tempAudioFile && tempAudioFile !== selectedFile) {
        try {
          await window.electronAPI.deleteFile(tempAudioFile);
          logger.info('MainScreen', 'Cleaned up temporary audio file:', tempAudioFile);
        } catch (cleanupError) {
          logger.warn('MainScreen', 'Failed to clean up temporary file:', cleanupError);
        }
      }

      // Only reset processing if we're NOT in polling mode
      if (!isPollingMode) {
        console.log('Finally block - resetting isProcessing to false (not polling mode)');
        setIsProcessing(false);
        setAppProcessing(false);

        // Allow system sleep when processing stops
        try {
          const sleepAllowed = await window.electronAPI.allowSystemSleep();
          if (sleepAllowed) {
            logger.debug(3, 'MainScreen', 'System sleep prevention deactivated');
          } else {
            logger.warn('MainScreen', 'Failed to allow system sleep');
          }
        } catch (error) {
          logger.warn('MainScreen', 'Error allowing system sleep:', error);
        }
      } else {
        console.log('Finally block - skipping isProcessing reset (polling mode active)');
      }
    }
  };

  const pollForCompletion = async (correlationId: string, type: 'transcription' | 'translation') => {
    const startTime = Date.now();
    const pollingInterval = (config.pollingIntervalSeconds || 10) * 1000; // Convert to milliseconds
    const timeoutMs = (config.pollingTimeoutSeconds || 7200) * 1000; // Default 2 hours

    const poll = async (): Promise<void> => {
      try {
        const elapsedMs = Date.now() - startTime;
        const elapsedSeconds = Math.floor(elapsedMs / 1000);

        // Update status with elapsed time
        setStatusMessage({
          type: 'info',
          message: `${type === 'transcription' ? 'Transcription' : 'Translation'} in progress... (${elapsedSeconds}s elapsed)`
        });

        const result = type === 'transcription'
          ? await checkTranscriptionStatus(correlationId)
          : await checkTranslationStatus(correlationId);

        logger.info('MainScreen', `${type} status check:`, result);

        if (result.status === 'COMPLETED' && result.data) {
          // Calculate credits used and create message
          let message = `${type === 'transcription' ? 'Transcription' : 'Translation'} completed successfully!`;
          if (typeof result.data.total_price === 'number' && result.data.total_price > 0) {
            message += ` (${result.data.total_price} credits used)`;
          }

          setStatusMessage({
            type: 'success',
            message: message
          });

          // Update credits from the response with animation trigger
          if (typeof result.data.credits_left === 'number') {
            const oldCredits = credits;
            const usedCredits = result.data.total_price || 0;

            // Update global config with credits
            onCreditsUpdate?.({
              used: usedCredits,
              remaining: result.data.credits_left
            });

            // Trigger animation if credits actually changed
            if (oldCredits !== null && oldCredits !== result.data.credits_left) {
              try {
                triggerCreditsAnimation();
              } catch (error) {
                logger.error('MainScreen', 'Credits animation error:', error);
              }
            }
          }

          // Download the result file content
          if (result.data.url) {
            const downloadResult = await downloadFile(result.data.url);
            if (downloadResult.success && downloadResult.content) {
              setPreviewContent(downloadResult.content);
              setShowPreview(true);
            }
          }

          // Clear the timeout reference on successful completion
          clearPollingTimeout();

          // Reset processing state on successful completion
          console.log('Polling completed successfully - resetting isProcessing to false');
          setIsProcessing(false);
          setAppProcessing(false);

          // Allow system sleep when processing completes successfully
          try {
            const sleepAllowed = await window.electronAPI.allowSystemSleep();
            if (sleepAllowed) {
              logger.debug(3, 'MainScreen', 'System sleep prevention deactivated after successful completion');
            } else {
              logger.warn('MainScreen', 'Failed to allow system sleep after completion');
            }
          } catch (error) {
            logger.warn('MainScreen', 'Error allowing system sleep after completion:', error);
          }
          return;
        } else if (result.status === 'ERROR') {
          throw new Error(result.errors?.join(', ') || `${type} failed`);
        } else if (result.status === 'PENDING' || result.status === 'CREATED') {
          if (elapsedMs >= timeoutMs) {
            const timeoutMinutes = Math.floor(timeoutMs / 60000);
            throw new Error(`${type} timed out after ${timeoutMinutes} minutes`);
          }

          // Wait before next check - store timeout ID for potential cancellation
          pollingTimeoutRef.current = setTimeout(poll, pollingInterval);
        }
      } catch (error: any) {
        logger.error('MainScreen', `${type} polling error:`, error);

        // Clear the timeout reference
        clearPollingTimeout();

        // Show detailed error only in debug mode, simple message otherwise
        let errorMessage = 'Processing failed. Please try again.';
        if (config.debugMode) {
          errorMessage = error.message || errorMessage;
        }

        setStatusMessage({
          type: 'error',
          message: `${type === 'transcription' ? 'Transcription' : 'Translation'} failed: ${errorMessage}`
        });
        console.log('Polling failed - resetting isProcessing to false');
        setIsProcessing(false);

        // Allow system sleep when processing fails
        try {
          const sleepAllowed = await window.electronAPI.allowSystemSleep();
          if (sleepAllowed) {
            logger.debug(3, 'MainScreen', 'System sleep prevention deactivated after failure');
          } else {
            logger.warn('MainScreen', 'Failed to allow system sleep after failure');
          }
        } catch (error) {
          logger.warn('MainScreen', 'Error allowing system sleep after failure:', error);
        }
        setAppProcessing(false);
      }
    };

    poll();
  };

  const handleSaveFile = async (content: string) => {
    if (!selectedFile || !fileType) return;

    try {
      // Generate filename suggestion with language code and same directory as source
      const originalFileName = await window.electronAPI.getBaseName(selectedFile);
      const originalDirectory = await window.electronAPI.getDirectoryName(selectedFile);

      let languageCode = '';
      let languageName = '';
      let format = '';

      if (fileType === 'translation') {
        languageCode = translationOptions.destinationLanguage;
        format = translationOptions.format;

        // Find language name from translation info using sync function
        if (translationOptions.api) {
          const syncLanguageName = getTranslationLanguageNameSync(translationOptions.api, languageCode);
          languageName = syncLanguageName || languageCode;
        } else {
          languageName = languageCode;
        }
      } else {
        languageCode = transcriptionOptions.language;
        format = transcriptionOptions.format;

        // Find language name from transcription info using sync function
        if (transcriptionOptions.api) {
          const syncLanguageName = getTranscriptionLanguageNameSync(transcriptionOptions.api, languageCode);
          languageName = syncLanguageName || languageCode;
        } else {
          languageName = languageCode;
        }
      }

      // Use custom filename format if available, otherwise fallback to default
      const filenamePattern = config.defaultFilenameFormat || '{filename}.{language_code}.{type}.{extension}';
      const newFileName = generateFilename(
        filenamePattern,
        originalFileName,
        languageCode,
        languageName,
        fileType,
        format
      );

      // Combine directory path with new filename
      const suggestedFullPath = originalDirectory ? `${originalDirectory}/${newFileName}` : newFileName;
      
      logger.info('MainScreen', `Saving file with suggested path: ${suggestedFullPath}`);
      
      const savedPath = await window.electronAPI.saveFile(content, suggestedFullPath);
      
      if (savedPath) {
        setStatusMessage({ 
          type: 'success', 
          message: `File saved successfully: ${savedPath}` 
        });
        setShowPreview(false);
      } else {
        logger.info('MainScreen', 'File save cancelled by user');
      }
    } catch (error: any) {
      logger.error('MainScreen', 'File save error:', error);
      
      // Show detailed error only in debug mode, simple message otherwise
      let errorMessage = 'Failed to save file. Please try again.';
      if (config.debugMode) {
        errorMessage = error.message || errorMessage;
      }
      
      setStatusMessage({ 
        type: 'error', 
        message: `Failed to save file: ${errorMessage}` 
      });
    }
  };

  return (
    <div className="main-screen" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: '20px',
      position: 'relative'
    }}>
      {/* Window-wide drag overlay */}
      {isDragOverWindow && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(52, 152, 219, 0.1)',
          border: '3px dashed #3498db',
          zIndex: 999,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{
            backgroundColor: 'rgba(52, 152, 219, 0.9)',
            color: 'white',
            padding: '20px 40px',
            borderRadius: '10px',
            fontSize: '18px',
            fontWeight: 'bold',
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
          }}>
            <i className="fas fa-upload" style={{ marginRight: '10px', fontSize: '24px' }}></i>
            Drop files here to process
          </div>
        </div>
      )}
      <h1>{appConfig.name}</h1>
      <p>Select a file to transcribe or translate:</p>

      <FileSelector 
        onFileSelect={handleFileSelect} 
        onMultipleFileSelect={handleMultipleFileSelect}
        disabled={isProcessing || isDetectingLanguage} 
      />

      {/* Welcome message when no file is selected */}
      {!selectedFile && (
        <div 
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: '12px',
            border: '2px dashed #dee2e6',
            margin: '20px 0',
            opacity: 1,
            transform: 'translateY(0)',
            transition: 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out'
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>
            <i className="fas fa-file-audio" style={{color: '#495057'}}></i>
          </div>
          <div style={{ fontSize: '28px', color: '#495057', marginBottom: '15px', fontWeight: '500' }}>
            Ready to Process Your Media
          </div>
          <div style={{ fontSize: '16px', color: '#6c757d', marginBottom: '25px', lineHeight: '1.5' }}>
            Select an audio, video, or subtitle file to get started
          </div>
          <div style={{ fontSize: '14px', color: '#adb5bd', marginBottom: '20px' }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>Transcription:</strong> Convert audio/video to text
            </div>
            <div>
              <strong>Translation:</strong> Translate existing subtitles
            </div>
          </div>
          <div style={{ 
            fontSize: '13px', 
            color: '#adb5bd',
            fontStyle: 'italic',
            borderTop: '1px solid #e9ecef',
            paddingTop: '20px',
            marginTop: '20px'
          }}>
            Supported formats: MP4, MP3, WAV, SRT, VTT, and more
          </div>
        </div>
      )}

      {selectedFile && fileType && (
        <div 
          className="file-info"
          style={{
            opacity: selectedFile ? 1 : 0,
            transform: selectedFile ? 'translateY(0)' : 'translateY(-10px)',
            transition: 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out'
          }}
        >
          <h3>Selected File:</h3>
          <p style={{ wordBreak: 'break-all', marginBottom: '8px' }}>{selectedFile}</p>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div>
              <strong>Type:</strong> {fileType === 'transcription' ? 'Audio/Video (Transcription)' : 'Subtitle (Translation)'}
            </div>
            
            {isLoadingFileInfo ? (
              <div style={{ color: '#666', fontStyle: 'italic' }}>
                Analyzing file...
              </div>
            ) : fileInfo ? (
              <>
                {/* Media file information */}
                {fileInfo.duration !== undefined && (
                  <div>
                    <strong>Duration:</strong> {formatDuration(fileInfo.duration)}
                  </div>
                )}
                
                {fileInfo.format && (
                  <div>
                    <strong>Format:</strong> {fileInfo.format.toUpperCase()}
                  </div>
                )}
                
                {fileInfo.hasAudio !== undefined && (
                  <div>
                    <strong>Audio:</strong> <i className={`fas ${fileInfo.hasAudio ? 'fa-check text-success' : 'fa-times text-danger'}`}></i>
                    {fileInfo.hasVideo !== undefined && (
                      <span style={{ marginLeft: '10px' }}>
                        <strong>Video:</strong> <i className={`fas ${fileInfo.hasVideo ? 'fa-check text-success' : 'fa-times text-danger'}`}></i>
                      </span>
                    )}
                  </div>
                )}
                
                {/* Subtitle file information */}
                {fileInfo.subtitleInfo && (
                  <>
                    <div>
                      <strong>Characters:</strong> {formatCharacterCount(fileInfo.subtitleInfo.characterCount)}
                    </div>
                    <div>
                      <strong>Words:</strong> {formatCharacterCount(fileInfo.subtitleInfo.wordCount)}
                    </div>
                    <div>
                      <strong>Subtitle Lines:</strong> {formatCharacterCount(fileInfo.subtitleInfo.lineCount)}
                    </div>
                  </>
                )}
              </>
            ) : null}
          </div>
          
          {/* Cost estimation for translation */}
          {fileType === 'translation' && fileInfo?.subtitleInfo && (
            <div style={{ 
              marginTop: '12px', 
              padding: '8px 12px', 
              backgroundColor: 'var(--info-color)', 
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              <strong>Estimated Cost:</strong> ~{Math.ceil(fileInfo.subtitleInfo.characterCount / 500)} credits 
              <span style={{ color: '#666', marginLeft: '8px' }}>
                (based on {fileInfo.subtitleInfo.characterCount} characters ÷ 500 chars per credit)
              </span>
            </div>
          )}
          
          {/* Duration estimate for transcription */}
          {fileType === 'transcription' && fileInfo?.duration && (
            <div style={{ 
              marginTop: '12px', 
              padding: '8px 12px', 
              backgroundColor: 'var(--bg-tertiary)', 
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              <strong>Processing Time:</strong> ~{Math.ceil(fileInfo.duration / 60)} minutes of audio
              <span style={{ color: '#666', marginLeft: '8px' }}>
                (cost varies by selected AI model)
              </span>
            </div>
          )}
        </div>
      )}

      {/* Language Detection Section */}
      {selectedFile && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          border: '1px solid var(--border-color)',
          borderRadius: '6px',
          backgroundColor: 'var(--bg-tertiary)',
          opacity: selectedFile ? 1 : 0,
          transform: selectedFile ? 'translateY(0)' : 'translateY(-10px)',
          transition: 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out',
          transitionDelay: '0.1s'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '10px' }}>
            <h4 style={{ margin: 0, color: 'var(--text-primary)' }}>Language Detection</h4>
            <button 
              onClick={detectLanguageForFile}
              disabled={isDetectingLanguage || isProcessing}
              style={{
                padding: '8px 16px',
                backgroundColor: isDetectingLanguage ? '#ccc' : '#4CAF50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isDetectingLanguage ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              {isDetectingLanguage ? (
                <>
                  <span style={{ 
                    display: 'inline-block', 
                    width: '12px', 
                    height: '12px', 
                    border: '2px solid white',
                    borderTop: '2px solid transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }}></span>
                  Detecting...
                </>
              ) : (
                <>
                  <i className="fas fa-search" style={{marginRight: '6px'}}></i>Detect Language
                </>
              )}
            </button>
          </div>
          
          <p style={{
            margin: '0 0 15px 0',
            color: 'var(--text-secondary)',
            fontSize: '14px'
          }}>
            Click "Detect Language" to automatically identify the source language and see which AI models support it.
          </p>

          {/* Language Detection Result */}
          {showLanguageDetectionResult && detectedLanguage && (
            <div style={{
              marginTop: '15px',
              padding: '12px',
              backgroundColor: 'var(--success-bg)',
              border: '1px solid var(--success-border)',
              borderRadius: '4px'
            }}>
              <h5 style={{ margin: '0 0 10px 0', color: 'var(--success-text)' }}>
                Language Detected: {detectedLanguage.name}
              </h5>
              
              <div style={{ display: 'flex', gap: '20px', marginBottom: '15px', fontSize: '14px', color: 'var(--success-text)' }}>
                <div><strong>Native Name:</strong> {detectedLanguage.native}</div>
                <div><strong>ISO Code:</strong> {detectedLanguage.ISO_639_1}</div>
                <div><strong>W3C Code:</strong> {detectedLanguage.W3C}</div>
              </div>
              
              {/* Only show relevant model compatibility based on file type */}
              {(() => {
                const fileName = typeof selectedFile === 'string' ? selectedFile : selectedFile?.name || '';
                const isSubtitle = isSubtitleFile(fileName);
                const isAudioVideo = isAudioVideoFile(fileName);
                
                return (
                  <div>
                    {/* Show translation models for subtitle files */}
                    {isSubtitle && (
                      <div style={{ marginBottom: '15px' }}>
                        <h6 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
                          Compatible Translation Models ({compatibleModels.translation.length})
                        </h6>
                        {compatibleModels.translation.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--success-text)' }}>
                            {compatibleModels.translation.map(model => (
                              <li key={model}>{model}</li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            No translation models support this language
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* Show transcription models for audio/video files */}
                    {isAudioVideo && (
                      <div style={{ marginBottom: '15px' }}>
                        <h6 style={{ margin: '0 0 8px 0', color: 'var(--text-primary)' }}>
                          Compatible Transcription Models ({compatibleModels.transcription.length})
                        </h6>
                        {compatibleModels.transcription.length > 0 ? (
                          <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--success-text)' }}>
                            {compatibleModels.transcription.map(model => (
                              <li key={model}>{model}</li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                            No transcription models support this language
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Auto-update notification */}
              {((fileType === 'translation' && translationOptions.sourceLanguage === detectedLanguage.ISO_639_1) ||
                (fileType === 'transcription' && transcriptionOptions.language === detectedLanguage.ISO_639_1)) && (
                <div style={{
                  marginTop: '10px',
                  padding: '8px',
                  backgroundColor: 'var(--success-bg)',
                  borderRadius: '3px',
                  fontSize: '12px',
                  color: 'var(--success-text)',
                  border: '1px solid var(--success-border)'
                }}>
                  <i className="fas fa-check-circle" style={{ color: 'var(--success-text)' }}></i> Language selection has been automatically updated below
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {fileType && (
        <div 
          className="options-section"
          style={{
            opacity: fileType ? 1 : 0,
            transform: fileType ? 'translateY(0)' : 'translateY(-10px)',
            transition: 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out',
            transitionDelay: '0.2s'
          }}
        >
          {isLoadingOptions ? (
            <div className="options-container">
              <p>Loading options...</p>
            </div>
          ) : fileType === 'transcription' ? (
            <ImprovedTranscriptionOptions
              options={transcriptionOptions}
              setOptions={setTranscriptionOptions}
              transcriptionInfo={contextTranscriptionInfo}
              disabled={isProcessing || isDetectingLanguage}
            />
          ) : (
            <ImprovedTranslationOptions 
              options={translationOptions}
              translationInfo={translationInfo}
              onModelChange={handleTranslationModelChange}
              onLanguageChange={handleTranslationLanguageChange}
              onFormatChange={(format) => setTranslationOptions(prev => ({ ...prev, format }))}
              disabled={isProcessing || isDetectingLanguage}
            />
          )}
        </div>
      )}

      {statusMessage && (
        <div className={`status-message ${statusMessage.type}`}>
          {statusMessage.message}
        </div>
      )}

      {selectedFile && fileType && (
        <div 
          className="action-section"
          style={{
            opacity: selectedFile && fileType ? 1 : 0,
            transform: selectedFile && fileType ? 'translateY(0)' : 'translateY(-10px)',
            transition: 'opacity 0.4s ease-in-out, transform 0.4s ease-in-out',
            transitionDelay: '0.3s'
          }}
        >
          <button
            className={`button ${isProcessing ? 'button-stop' : ''}`}
            onClick={isProcessing ? handleStopProcess : handleProcess}
            disabled={isDetectingLanguage}
          >
            {(() => {
              // Debug logging
              console.log('Button render - isDetectingLanguage:', isDetectingLanguage);
              console.log('Button render - isProcessing:', isProcessing);
              console.log('Button render - fileType:', fileType);

              if (isDetectingLanguage) {
                return 'Detecting Language...';
              } else if (isProcessing) {
                return `Stop ${fileType === 'transcription' ? 'Transcription' : 'Translation'}`;
              } else {
                return `Start ${fileType === 'transcription' ? 'Transcription' : 'Translation'}`;
              }
            })()}
          </button>
        </div>
      )}

      {showPreview && (
        <PreviewDialog 
          content={previewContent}
          onClose={() => setShowPreview(false)}
          onSave={handleSaveFile}
          fileType={fileType}
          selectedFile={selectedFile}
          translationOptions={translationOptions}
          transcriptionOptions={transcriptionOptions}
        />
      )}
      
      {/* Credit Warning Modal */}
      {showCreditModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            maxWidth: '500px',
            width: '90%',
            borderRadius: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '24px',
              backgroundColor: 'var(--danger-color)',
              color: 'white',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '48px', marginBottom: '12px' }}><i className="fas fa-exclamation-triangle" style={{color: 'white'}}></i></div>
              <h2 style={{ margin: 0, fontSize: '24px' }}>Insufficient Credits</h2>
            </div>
            
            <div style={{ padding: '24px' }}>
              <p style={{ 
                fontSize: '16px', 
                lineHeight: '1.5', 
                color: '#333',
                textAlign: 'center',
                margin: '0 0 20px 0'
              }}>
                You don't have enough credits to process this file. Credits are required to use AI transcription and translation services.
              </p>
              
              <div style={{
                backgroundColor: 'var(--bg-secondary)',
                padding: '16px',
                borderRadius: '8px',
                marginBottom: '20px',
                textAlign: 'center'
              }}>
                <strong style={{ color: 'var(--danger-text)', fontSize: '18px' }}>
                  Current Balance: {credits || 0} credits
                </strong>
              </div>
              
              <p style={{
                fontSize: '14px',
                color: '#6c757d',
                textAlign: 'center',
                margin: '0 0 24px 0'
              }}>
                Purchase credits to continue using transcription and translation features.
              </p>
            </div>

            <div style={{
              padding: '16px 24px',
              backgroundColor: 'var(--bg-secondary)',
              display: 'flex',
              gap: '12px',
              justifyContent: 'center'
            }}>
              <button
                onClick={() => setShowCreditModal(false)}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowCreditModal(false);
                  onNavigateToCredits?.();
                }}
                style={{
                  padding: '12px 20px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Buy Credits
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


interface PreviewDialogProps {
  content: string;
  onClose: () => void;
  onSave: (content: string) => void;
  fileType: 'transcription' | 'translation' | null;
  selectedFile: string | null;
  translationOptions: {
    sourceLanguage: string;
    destinationLanguage: string;
    model: string;
    format: string;
  };
  transcriptionOptions: {
    language: string;
    model: string;
    format: string;
  };
}

function PreviewDialog({ content, onClose, onSave }: PreviewDialogProps) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'var(--bg-primary)',
        padding: '20px',
        borderRadius: '8px',
        maxWidth: '80%',
        maxHeight: '80%',
        overflow: 'auto',
        minWidth: '500px',
        minHeight: '400px',
        border: '1px solid var(--border-color)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
          <h3 style={{ color: 'var(--text-primary)', margin: 0 }}>Result Preview</h3>
          <button
            onClick={onClose}
            style={{
              fontSize: '18px',
              padding: '5px 10px',
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <textarea
          value={content}
          readOnly
          style={{
            width: '100%',
            height: '300px',
            fontFamily: 'monospace',
            fontSize: '12px',
            border: '1px solid var(--border-color)',
            padding: '10px',
            resize: 'vertical',
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)'
          }}
        />

        <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
          <button
            onClick={() => onSave(content)}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--success-color)',
              color: 'var(--bg-primary)',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Save to File
          </button>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}



export default MainScreen;