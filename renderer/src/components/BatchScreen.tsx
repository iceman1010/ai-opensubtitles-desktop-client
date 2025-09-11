import React, { useState, useEffect, useCallback, useRef } from 'react';
import FileSelector from './FileSelector';
import { OpenSubtitlesAPI, LanguageInfo, TranscriptionInfo, TranslationInfo, DetectedLanguage } from '../services/api';
import { logger } from '../utils/errorLogger';
import { isOnline } from '../utils/networkUtils';
import * as fileFormatsConfig from '../../../shared/fileFormats.json';

// Utility functions for file type checking using shared/fileFormats.json
const isVideoFile = (fileName: string): boolean => {
  const ext = fileName.toLowerCase().split('.').pop();
  const result = ext ? fileFormatsConfig.video.includes(ext) : false;
  console.log('BatchScreen: isVideoFile check:', { fileName, ext, result, videoFormats: fileFormatsConfig.video });
  return result;
};

const isAudioFile = (fileName: string): boolean => {
  const ext = fileName.toLowerCase().split('.').pop();
  const result = ext ? fileFormatsConfig.audio.includes(ext) : false;
  console.log('BatchScreen: isAudioFile check:', { fileName, ext, result, audioFormats: fileFormatsConfig.audio });
  return result;
};

const isSubtitleFile = (fileName: string): boolean => {
  const ext = fileName.toLowerCase().split('.').pop();
  const result = ext ? fileFormatsConfig.subtitle.includes(ext) : false;
  console.log('BatchScreen: isSubtitleFile check:', { fileName, ext, result, subtitleFormats: fileFormatsConfig.subtitle });
  return result;
};

const isAudioVideoFile = (fileName: string): boolean => {
  return isVideoFile(fileName) || isAudioFile(fileName);
};

const isSupportedFile = (fileName: string): boolean => {
  return isAudioVideoFile(fileName) || isSubtitleFile(fileName);
};


interface BatchFile {
  id: string;
  path: string;
  name: string;
  type: 'transcription' | 'translation';
  status: 'pending' | 'detecting' | 'processing' | 'completed' | 'error' | 'skipped';
  detectedLanguage?: DetectedLanguage;
  selectedSourceLanguage?: string; // Specific language variant for translation (e.g., 'en-US' instead of 'en')
  progress?: number;
  error?: string;
  outputPath?: string;
  creditsUsed?: number;
}

interface BatchSettings {
  transcriptionModel: string;
  translationModel: string;
  targetLanguage: string;
  outputFormat: string;
  outputDirectory: string;
  useCustomOutputDirectory: boolean;
  enableChaining: boolean;
  abortOnError: boolean;
  keepIntermediateFiles: boolean;
}

interface AppConfig {
  username: string;
  password: string;
  apiKey?: string;
  lastUsedLanguage?: string;
  debugMode?: boolean;
  checkUpdatesOnStart?: boolean;
  autoRemoveCompletedFiles?: boolean;
}

interface BatchScreenProps {
  config: AppConfig;
  setAppProcessing: (processing: boolean, task?: string) => void;
  pendingFiles?: string[];
  onFilesPending?: () => void;
}

const BatchScreen: React.FC<BatchScreenProps> = ({ config, setAppProcessing, pendingFiles, onFilesPending }) => {
  const [queue, setQueue] = useState<BatchFile[]>([]);
  const [batchSettings, setBatchSettings] = useState<BatchSettings>({
    transcriptionModel: '',
    translationModel: '',
    targetLanguage: '',
    outputFormat: fileFormatsConfig.subtitle[0] || 'srt',
    outputDirectory: '',
    useCustomOutputDirectory: false,
    enableChaining: false,
    abortOnError: true,
    keepIntermediateFiles: true,
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentFileIndex, setCurrentFileIndex] = useState(-1);
  const [overallProgress, setOverallProgress] = useState(0);
  const [isDetectingLanguages, setIsDetectingLanguages] = useState(false);
  
  // Credit tracking states
  const [batchCreditStats, setBatchCreditStats] = useState({
    totalCreditsUsed: 0,
    creditsPerFile: new Map<string, number>()
  });

  // Batch processing tracking states
  const [batchStats, setBatchStats] = useState<{
    startTime: Date | null;
    endTime: Date | null;
    totalFilesProcessed: number;
    successfulFiles: number;
    outputFiles: string[];
  }>({
    startTime: null,
    endTime: null,
    totalFilesProcessed: 0,
    successfulFiles: 0,
    outputFiles: []
  });

  const [showCompletionSummary, setShowCompletionSummary] = useState(false);
  
  // API and data states
  const [transcriptionInfo, setTranscriptionInfo] = useState<TranscriptionInfo | null>(null);
  const [translationInfo, setTranslationInfo] = useState<TranslationInfo | null>(null);
  const [availableTranslationLanguages, setAvailableTranslationLanguages] = useState<LanguageInfo[]>([]);
  const [isLoadingLanguages, setIsLoadingLanguages] = useState(false);
  
  const apiRef = useRef<OpenSubtitlesAPI | null>(null);
  const processingRef = useRef<boolean>(false);
  const shouldStopRef = useRef<boolean>(false);
  const processedPendingFilesRef = useRef<string[]>([]);

  // Initialize API
  useEffect(() => {
    if (config.apiKey) {
      apiRef.current = new OpenSubtitlesAPI(config.apiKey);
      
      // Set API key first (like MainScreen does)
      if (config.apiKey) {
        apiRef.current.setApiKey(config.apiKey);
        logger.info('BatchScreen', 'API Key set successfully');
      }
      
      initializeAPI();
    }
  }, [config.apiKey]);

  // Handle pending files from MainScreen redirect
  useEffect(() => {
    if (pendingFiles && pendingFiles.length > 0) {
      // Check if we've already processed these exact files
      const filesKey = pendingFiles.join('|');
      const lastProcessedKey = processedPendingFilesRef.current.join('|');
      
      if (filesKey !== lastProcessedKey) {
        logger.info('BatchScreen', `Processing ${pendingFiles.length} pending files from MainScreen redirect`);
        processedPendingFilesRef.current = [...pendingFiles];
        
        // Add all pending files to queue
        const processPendingFiles = async () => {
          for (const filePath of pendingFiles) {
            await addFileToQueue(filePath);
          }
          // Clear pending files after processing
          if (onFilesPending) {
            onFilesPending();
          }
        };
        
        processPendingFiles();
      }
    }
  }, [pendingFiles]);

  const initializeAPI = async () => {
    if (!apiRef.current) return;

    try {
      setAppProcessing(true, 'Checking authentication...');
      
      // First try to load cached token (like MainScreen does)
      const hasCachedToken = await apiRef.current.loadCachedToken();
      if (hasCachedToken) {
        logger.info('BatchScreen', 'Using cached authentication token, skipping login');
        setAppProcessing(true, 'Using cached authentication token...');
        // Proceed directly to loading API info
        loadApiInfo();
        return;
      }
      
      // No valid cached token, proceed with fresh login (like MainScreen does)
      logger.info('BatchScreen', 'No valid cached token, performing fresh login');
      setAppProcessing(true, 'Logging in to OpenSubtitles API...');
      const result = await apiRef.current.login(config.username, config.password);
      if (!result.success) {
        logger.error('BatchScreen', 'Login failed', result.error);
        setAppProcessing(true, 'Login failed - please check credentials');
        setTimeout(() => setAppProcessing(false), 3000);
        return;
      }
      logger.info('BatchScreen', 'Fresh login successful');
      setAppProcessing(true, 'Login successful!');
      // Only load API info after successful login
      loadApiInfo();
      
    } catch (error) {
      logger.error('BatchScreen', 'API initialization failed:', error);
      setAppProcessing(true, 'API initialization failed');
      setTimeout(() => setAppProcessing(false), 3000);
    }
  };

  const loadApiInfo = async () => {
    if (!apiRef.current) return;

    try {
      setAppProcessing(true, 'Loading API information...');
      
      // Load transcription and translation info
      const [transcriptionResult, translationResult] = await Promise.all([
        apiRef.current.getTranscriptionInfo(),
        apiRef.current.getTranslationInfo()
      ]);

      if (transcriptionResult.success && transcriptionResult.data) {
        setTranscriptionInfo(transcriptionResult.data);
        
        // Set default transcription model and load its languages
        if (transcriptionResult.data.apis && transcriptionResult.data.apis.length > 0) {
          const defaultModel = transcriptionResult.data.apis[0];
          setBatchSettings(prev => ({ ...prev, transcriptionModel: defaultModel }));
          // Load languages for the default transcription model
          loadLanguagesForTranscriptionModel(defaultModel, transcriptionResult.data);
        }
      }

      if (translationResult.success && translationResult.data) {
        setTranslationInfo(translationResult.data);
        
        // Set default translation model and load its languages
        if (translationResult.data.apis && translationResult.data.apis.length > 0) {
          const defaultModel = translationResult.data.apis[0];
          setBatchSettings(prev => ({ ...prev, translationModel: defaultModel }));
          // Load languages for the default translation model
          loadLanguagesForTranslationModel(defaultModel, translationResult.data);
        }
      }

    } catch (error) {
      logger.error('BatchScreen', 'Failed to load API info', error);
    } finally {
      setAppProcessing(false);
    }
  };

  const loadLanguagesForTranscriptionModel = async (modelId: string, transcriptionData?: TranscriptionInfo) => {
    setIsLoadingLanguages(true);
    try {
      logger.info('BatchScreen', `Loading languages for transcription model: ${modelId}`);
      
      // Use provided data or fall back to state
      const dataToUse = transcriptionData || transcriptionInfo;
      
      // Check if we already have the languages data from the initial load
      if (dataToUse && dataToUse.languages && dataToUse.languages[modelId]) {
        const modelLanguages = dataToUse.languages[modelId];
        logger.info('BatchScreen', `Using cached languages for transcription model ${modelId}: ${modelLanguages.length} languages`);
      } else {
        // Fetch languages for this specific model
        logger.info('BatchScreen', `Fetching languages for transcription model: ${modelId}`);
        const result = await apiRef.current?.getTranscriptionLanguagesForApi(modelId);
        if (result?.success && result.data) {
          const languagesArray = Array.isArray(result.data) ? result.data : [];
        }
      }
    } catch (error) {
      logger.error('BatchScreen', 'Exception loading transcription languages for model', error);
    } finally {
      setIsLoadingLanguages(false);
    }
  };

  const loadLanguagesForTranslationModel = async (modelId: string, translationData?: TranslationInfo) => {
    setIsLoadingLanguages(true);
    try {
      logger.info('BatchScreen', `Loading languages for translation model: ${modelId}`);
      
      // Use provided data or fall back to state
      const dataToUse = translationData || translationInfo;
      
      // Check if we already have the languages data from the initial load
      if (dataToUse && dataToUse.languages && dataToUse.languages[modelId]) {
        const modelLanguages = dataToUse.languages[modelId];
        logger.info('BatchScreen', `Using cached languages for translation model ${modelId}: ${modelLanguages.length} languages`);
        setAvailableTranslationLanguages(Array.isArray(modelLanguages) ? modelLanguages : []);
        
        // Set default target language if current selection is not available
        const currentTargetLang = batchSettings.targetLanguage;
        const isCurrentLangAvailable = Array.isArray(modelLanguages) && 
          modelLanguages.some(lang => lang.language_code === currentTargetLang);
        
        if (!isCurrentLangAvailable && Array.isArray(modelLanguages) && modelLanguages.length > 0) {
          const defaultLang = modelLanguages.find(lang => lang.language_code === 'en') || modelLanguages[0];
          setBatchSettings(prev => ({ ...prev, targetLanguage: defaultLang.language_code }));
        }
      } else {
        // Fetch languages for this specific model
        logger.info('BatchScreen', `Fetching languages for translation model: ${modelId}`);
        const result = await apiRef.current?.getTranslationLanguagesForApi(modelId);
        if (result?.success && result.data) {
          const languagesArray = Array.isArray(result.data) ? result.data : [];
          setAvailableTranslationLanguages(languagesArray);
          
          // Set default target language
          if (languagesArray.length > 0) {
            const defaultLang = languagesArray.find(lang => lang.language_code === 'en') || languagesArray[0];
            setBatchSettings(prev => ({ ...prev, targetLanguage: defaultLang.language_code }));
          }
        }
      }
    } catch (error) {
      logger.error('BatchScreen', 'Exception loading translation languages for model', error);
    } finally {
      setIsLoadingLanguages(false);
    }
  };

  // Model change handlers
  const handleTranscriptionModelChange = (newModel: string) => {
    setBatchSettings(prev => ({ ...prev, transcriptionModel: newModel }));
    loadLanguagesForTranscriptionModel(newModel);
    // Update source language selections for all transcription files when model changes
    updateSourceLanguageSelectionsForTranscriptionModel(newModel);
  };

  const handleTranslationModelChange = (newModel: string) => {
    setBatchSettings(prev => ({ ...prev, translationModel: newModel }));
    loadLanguagesForTranslationModel(newModel);
    // Update source language selections for all files when model changes
    updateSourceLanguageSelectionsForModel(newModel);
  };

  // Get available source languages that match the detected language prefix, or all if no detection
  const getMatchingSourceLanguages = (detectedLanguageCode: string | null, apiLanguages: LanguageInfo[]): LanguageInfo[] => {
    if (!apiLanguages) return [];
    
    let matching: LanguageInfo[];
    
    if (!detectedLanguageCode) {
      // No language detection result - show all available languages
      matching = [...apiLanguages];
    } else {
      // Find languages that start with the detected language code (e.g., 'en' matches 'en-US', 'en-GB')
      matching = apiLanguages.filter(lang => 
        lang.language_code.toLowerCase().startsWith(detectedLanguageCode.toLowerCase())
      );
    }
    
    // Remove duplicates based on language_name (keep first occurrence with unique language_code)
    const seen = new Set<string>();
    const uniqueByName = matching.filter(lang => {
      const key = lang.language_name.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
    
    // Sort alphabetically by language name
    return uniqueByName.sort((a, b) => a.language_name.localeCompare(b.language_name));
  };

  // Auto-select the first matching source language for a detected language
  // If only one language remains after filtering, auto-select it regardless of detection status
  const autoSelectSourceLanguage = (detectedLanguageCode: string | null, apiLanguages: LanguageInfo[]): string | undefined => {
    const matching = getMatchingSourceLanguages(detectedLanguageCode, apiLanguages);
    
    // Auto-select if there's exactly one matching language (the key improvement)
    if (matching.length === 1) {
      return matching[0].language_code;
    }
    
    // Auto-select first match if we have detection results (existing behavior)
    if (detectedLanguageCode && matching.length > 0) {
      return matching[0].language_code;
    }
    
    return undefined;
  };

  // Update source language selections when translation model changes
  const updateSourceLanguageSelectionsForModel = (newModel: string) => {
    if (!translationInfo?.languages[newModel]) return;
    
    const apiLanguages = translationInfo.languages[newModel];
    
    setQueue(prev => prev.map(file => {
      if (file.type === 'translation') {
        const detectedCode = file.detectedLanguage?.ISO_639_1 || null;
        const selectedSource = autoSelectSourceLanguage(detectedCode, apiLanguages);
        return { ...file, selectedSourceLanguage: selectedSource };
      }
      return file;
    }));
  };

  // Update source language selections when transcription model changes
  const updateSourceLanguageSelectionsForTranscriptionModel = (newModel: string) => {
    if (!transcriptionInfo?.languages[newModel]) return;
    
    const apiLanguages = transcriptionInfo.languages[newModel];
    
    setQueue(prev => prev.map(file => {
      if (file.type === 'transcription') {
        const detectedCode = file.detectedLanguage?.ISO_639_1 || null;
        const selectedSource = autoSelectSourceLanguage(detectedCode, apiLanguages);
        return { ...file, selectedSourceLanguage: selectedSource };
      }
      return file;
    }));
  };

  // Handle source language selection change for a specific file
  const handleSourceLanguageChange = (fileId: string, selectedLanguage: string) => {
    setQueue(prev => prev.map(file => 
      file.id === fileId ? { ...file, selectedSourceLanguage: selectedLanguage } : file
    ));
  };

  // Helper function to set detected language and auto-select source language
  const setDetectedLanguageForFile = (fileId: string, detectedLanguage: DetectedLanguage) => {
    setQueue(prev => prev.map(file => {
      if (file.id === fileId) {
        // Auto-select source language if this is a translation file and we have translation model info
        let selectedSourceLanguage = file.selectedSourceLanguage;
        console.log('BatchScreen: Auto-selection check for file:', file.name, {
          fileType: file.type,
          hasTranslationInfo: !!translationInfo,
          translationModel: batchSettings.translationModel,
          detectedLanguage: detectedLanguage.ISO_639_1
        });
        
        if (file.type === 'translation' && translationInfo && batchSettings.translationModel) {
          const apiLanguages = translationInfo.languages[batchSettings.translationModel];
          if (apiLanguages) {
            const languageCode = detectedLanguage.ISO_639_1;
            const matching = getMatchingSourceLanguages(languageCode, apiLanguages);
            selectedSourceLanguage = autoSelectSourceLanguage(languageCode, apiLanguages);
            console.log('BatchScreen: Auto-selection result (translation):', {
              detectedLanguage: languageCode,
              matchingCount: matching.length,
              selectedSourceLanguage,
              matchingLanguages: matching.map(l => l.language_code)
            });
          } else {
            console.log('BatchScreen: No API languages found for translation model:', batchSettings.translationModel);
          }
        } else if (file.type === 'transcription' && transcriptionInfo && batchSettings.transcriptionModel) {
          const apiLanguages = transcriptionInfo.languages[batchSettings.transcriptionModel];
          if (apiLanguages) {
            const languageCode = detectedLanguage.ISO_639_1;
            const matching = getMatchingSourceLanguages(languageCode, apiLanguages);
            selectedSourceLanguage = autoSelectSourceLanguage(languageCode, apiLanguages);
            console.log('BatchScreen: Auto-selection result (transcription):', {
              detectedLanguage: languageCode,
              matchingCount: matching.length,
              selectedSourceLanguage,
              matchingLanguages: matching.map(l => l.language_code)
            });
          } else {
            console.log('BatchScreen: No API languages found for transcription model:', batchSettings.transcriptionModel);
          }
        } else {
          console.log('BatchScreen: Auto-selection conditions not met');
        }
        
        return {
          ...file,
          status: 'pending' as const,
          detectedLanguage,
          selectedSourceLanguage
        };
      }
      return file;
    }));
  };

  // Poll for language detection completion (similar to MainScreen)
  const pollLanguageDetection = async (correlationId: string, fileId: string, tempAudioFile: string | null = null): Promise<DetectedLanguage | null> => {
    const maxAttempts = 24; // 2 minutes with 5-second intervals
    let attempts = 0;

    return new Promise((resolve) => {
      const poll = async () => {
        try {
          attempts++;
          if (!apiRef.current) {
            resolve(null);
            return;
          }

          const result = await apiRef.current.checkLanguageDetectionStatus(correlationId);
          logger.info('BatchScreen', `Polling attempt ${attempts} for correlation ${correlationId}:`, result);
          setAppProcessing(true, `Language detection in progress... (attempt ${attempts}/${maxAttempts})`);
          
          if (result.status === 'COMPLETED' && result.data?.language) {
            logger.info('BatchScreen', `Language detection completed:`, result.data.language);
            setAppProcessing(true, `Language detected: ${result.data.language.name}`);
            
            // Clean up temp audio file if it exists
            if (tempAudioFile) {
              try {
                await window.electronAPI.deleteFile(tempAudioFile);
              } catch (cleanupError) {
                logger.warn('BatchScreen', 'Failed to cleanup temp audio file after polling:', cleanupError);
              }
            }
            
            resolve(result.data.language);
          } else if (result.status === 'ERROR') {
            logger.error('BatchScreen', 'Language detection error:', result.errors);
            setQueue(prev => prev.map(f => 
              f.id === fileId ? { 
                ...f, 
                status: 'pending' as const,
                error: result.errors?.join(', ') || 'Language detection failed'
              } : f
            ));
            resolve(null);
          } else if (result.status === 'TIMEOUT') {
            logger.error('BatchScreen', 'Language detection timed out');
            setQueue(prev => prev.map(f => 
              f.id === fileId ? { 
                ...f, 
                status: 'pending' as const,
                error: 'Language detection timed out'
              } : f
            ));
            resolve(null);
          } else if (attempts >= maxAttempts) {
            logger.error('BatchScreen', 'Language detection polling timeout after 2 minutes');
            setQueue(prev => prev.map(f => 
              f.id === fileId ? { 
                ...f, 
                status: 'pending' as const,
                error: 'Language detection timed out after 2 minutes'
              } : f
            ));
            resolve(null);
          } else {
            // Still processing, poll again
            setTimeout(poll, 5000);
          }
        } catch (error) {
          logger.error('BatchScreen', 'Language detection polling error:', error);
          setQueue(prev => prev.map(f => 
            f.id === fileId ? { 
              ...f, 
              status: 'pending' as const,
              error: `Language detection error: ${error instanceof Error ? error.message : 'Unknown error'}`
            } : f
          ));
          resolve(null);
        }
      };

      poll();
    });
  };

  // Sequential language detection to avoid server overload
  const processLanguageDetectionQueue = useCallback(async (currentQueue?: BatchFile[]) => {
    console.log('BatchScreen: processLanguageDetectionQueue called');
    console.log('BatchScreen: isDetectingLanguages:', isDetectingLanguages, 'isProcessing:', isProcessing);
    
    // Use the provided queue or get current queue from state
    const queueToProcess = currentQueue || queue;
    console.log('BatchScreen: queue length:', queueToProcess.length);
    console.log('BatchScreen: apiRef.current exists:', !!apiRef.current);
    
    if (isDetectingLanguages || isProcessing) {
      console.log('BatchScreen: Skipping language detection - already in progress');
      return;
    }

    setIsDetectingLanguages(true);
    
    try {
      // Get ALL files that need language detection - just like main panel
      const filesToDetect = queueToProcess.filter(file => 
        file.status === 'pending' && !file.detectedLanguage
      );

      console.log('BatchScreen: Files that need detection:', filesToDetect.length);

      if (filesToDetect.length === 0) {
        console.log('BatchScreen: No files need language detection');
        setAppProcessing(true, 'All files already have language detection complete');
        setTimeout(() => setAppProcessing(false), 2000);
        setIsDetectingLanguages(false);
        return;
      }

      logger.info('BatchScreen', `Starting sequential language detection for ${filesToDetect.length} files`);
      setAppProcessing(true, `Detecting languages for ${filesToDetect.length} files...`);

      // Process files one by one to avoid server overload
      for (const file of filesToDetect) {
        if (!apiRef.current) break;
        
        logger.info('BatchScreen', `Detecting language for: ${file.name}`);
        setAppProcessing(true, `Detecting language for ${file.name}...`);
        
        // Update file status to detecting
        setQueue(prev => prev.map(f => 
          f.id === file.id ? { ...f, status: 'detecting' as const } : f
        ));

        try {
          // Implement full MainScreen logic: audio extraction + polling
          logger.info('BatchScreen', `Starting language detection for ${file.name} at path: ${file.path}`);
          
          let fileToProcess = file.path;
          let tempAudioFile: string | null = null;
          
          // Check if it's a video/audio file that needs audio extraction
          const isVideoOrAudio = isAudioVideoFile(file.name);
          
          if (isVideoOrAudio) {
            logger.info('BatchScreen', `Extracting audio for ${file.name}`);
            setAppProcessing(true, `Extracting audio from ${file.name} for language detection...`);
            
            // Extract first 3 minutes (180 seconds) as MP3
            const extractedPath = await window.electronAPI.extractAudio(
              file.path,
              undefined, // Let system choose temp path
              undefined, // No progress callback for now
              180        // Duration: first 3 minutes
            );
            
            if (extractedPath) {
              fileToProcess = extractedPath;
              tempAudioFile = extractedPath;
              logger.info('BatchScreen', `Audio extracted for ${file.name}: ${extractedPath}`);
              setAppProcessing(true, `Audio extracted, detecting language for ${file.name}...`);
            } else {
              throw new Error('Failed to extract audio from video file');
            }
          }
          
          const result = await apiRef.current.detectLanguage(fileToProcess);
          logger.info('BatchScreen', `Detection result for ${file.name}:`, result);
          
          if (result.data?.language) {
            // Text file - immediate result
            logger.info('BatchScreen', `Language detected immediately for ${file.name}:`, result.data.language);
            
            setDetectedLanguageForFile(file.id, result.data.language);
            
            // Clean up temp audio file
            if (tempAudioFile) {
              try {
                await window.electronAPI.deleteFile(tempAudioFile);
              } catch (cleanupError) {
                logger.warn('BatchScreen', 'Failed to cleanup temp audio file:', cleanupError);
              }
            }
          } else if (result.correlation_id) {
            // Audio file - poll for completion
            logger.info('BatchScreen', `Language detection needs polling for ${file.name}, correlation ID: ${result.correlation_id}`);
            setAppProcessing(true, `Processing audio for ${file.name}, please wait...`);
            
            const detectedLanguage = await pollLanguageDetection(result.correlation_id, file.id, tempAudioFile);
            
            if (detectedLanguage) {
              setDetectedLanguageForFile(file.id, detectedLanguage);
            }
          } else if (result.status === 'ERROR') {
            logger.warn('BatchScreen', `Language detection failed for ${file.name}:`, result.errors);
            
            setQueue(prev => prev.map(f => 
              f.id === file.id ? { 
                ...f, 
                status: 'pending' as const,
                error: result.errors?.[0] || 'Language detection failed'
              } : f
            ));
          } else {
            logger.warn('BatchScreen', `Unexpected result for ${file.name}:`, result);
            
            setQueue(prev => prev.map(f => 
              f.id === file.id ? { 
                ...f, 
                status: 'pending' as const,
                error: 'Unexpected detection result'
              } : f
            ));
          }
        } catch (error) {
          logger.error('BatchScreen', `Language detection error for ${file.name}:`, error);
          
          setQueue(prev => prev.map(f => 
            f.id === file.id ? { 
              ...f, 
              status: 'pending' as const,
              error: `Language detection error: ${error.message}`
            } : f
          ));
        }

        // Add delay between requests to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      logger.info('BatchScreen', 'Sequential language detection completed');
      setAppProcessing(true, 'Language detection completed for all files');
      
      // Clear status after a brief moment
      setTimeout(() => setAppProcessing(false), 1500);
      
    } catch (error) {
      logger.error('BatchScreen', 'Error in language detection queue processing:', error);
      setAppProcessing(true, 'Language detection failed');
      setTimeout(() => setAppProcessing(false), 3000);
    } finally {
      setIsDetectingLanguages(false);
    }
  }, [isDetectingLanguages, isProcessing]);

  // File selection handlers
  const handleSingleFileSelect = async (filePath: string) => {
    if (filePath) {
      await addFileToQueue(filePath);
    }
  };

  const handleMultipleFileSelect = async (filePaths: string[]) => {
    for (const filePath of filePaths) {
      await addFileToQueue(filePath);
    }
  };

  const handleFileSelect = async () => {
    try {
      console.log('BatchScreen: Attempting multiple file selection...');
      console.log('BatchScreen: selectMultipleFiles method exists:', typeof window.electronAPI.selectMultipleFiles);
      
      const filePaths = await window.electronAPI.selectMultipleFiles();
      console.log('BatchScreen: Selected file paths:', filePaths);
      
      if (filePaths && filePaths.length > 0) {
        console.log(`BatchScreen: Adding ${filePaths.length} files to queue`);
        for (const filePath of filePaths) {
          await addFileToQueue(filePath);
        }
      } else {
        console.log('BatchScreen: No files selected');
      }
    } catch (error) {
      logger.error('BatchScreen', 'Multiple file selection failed, falling back to single file', error);
      console.error('BatchScreen: Multiple file selection error:', error);
      
      // Fallback to single file selection
      try {
        console.log('BatchScreen: Falling back to single file selection');
        const filePath = await window.electronAPI.selectFile();
        console.log('BatchScreen: Single file selected:', filePath);
        
        if (filePath) {
          await addFileToQueue(filePath);
        }
      } catch (fallbackError) {
        logger.error('BatchScreen', 'File selection failed completely', fallbackError);
        console.error('BatchScreen: Single file selection also failed:', fallbackError);
      }
    }
  };


  const addFileToQueue = async (filePath: string) => {
    const fileName = filePath.split('/').pop() || filePath;
    
    if (!isSupportedFile(fileName)) {
      logger.warn('BatchScreen', `Unsupported file format: ${fileName}`);
      return;
    }

    const fileType = isSubtitleFile(fileName) ? 'translation' : 'transcription';
    console.log('BatchScreen: File type detection:', {
      fileName,
      isSubtitle: isSubtitleFile(fileName),
      isAudioVideo: isAudioVideoFile(fileName),
      detectedType: fileType
    });

    const newFile: BatchFile = {
      id: `${Date.now()}-${Math.random()}`,
      path: filePath,
      name: fileName,
      type: fileType,
      status: 'pending'
    };

    setQueue(prev => {
      const updatedQueue = [...prev, newFile];
      console.log('BatchScreen: File added to queue:', newFile);
      console.log('BatchScreen: Updated queue length:', updatedQueue.length);
      
      // Trigger sequential language detection after a short delay, passing the current queue
      setTimeout(() => {
        console.log('BatchScreen: Triggering language detection queue processing');
        processLanguageDetectionQueue(updatedQueue);
      }, 100);
      return updatedQueue;
    });
  };


  // Queue management
  const removeFromQueue = (fileId: string) => {
    setQueue(prev => prev.filter(file => file.id !== fileId));
  };

  const clearQueue = () => {
    if (!isProcessing) {
      setQueue([]);
    }
  };

  const moveFileUp = (index: number) => {
    if (index > 0 && !isProcessing) {
      setQueue(prev => {
        const newQueue = [...prev];
        [newQueue[index - 1], newQueue[index]] = [newQueue[index], newQueue[index - 1]];
        return newQueue;
      });
    }
  };

  const moveFileDown = (index: number) => {
    if (index < queue.length - 1 && !isProcessing) {
      setQueue(prev => {
        const newQueue = [...prev];
        [newQueue[index], newQueue[index + 1]] = [newQueue[index + 1], newQueue[index]];
        return newQueue;
      });
    }
  };

  // Determine what file types are in the queue to enable/disable UI sections
  const queueAnalysis = {
    hasTranscriptionFiles: queue.some(f => f.type === 'transcription'),
    hasTranslationFiles: queue.some(f => f.type === 'translation'),
    totalFiles: queue.length
  };

  // UI logic based on queue content
  const uiState = {
    // Transcription settings enabled when we have transcription files
    transcriptionEnabled: queueAnalysis.hasTranscriptionFiles,
    // Translation enabled when we have translation files OR when chaining is enabled with transcription files
    translationEnabled: queueAnalysis.hasTranslationFiles || (batchSettings.enableChaining && queueAnalysis.hasTranscriptionFiles),
    // Chaining checkbox only relevant when we have transcription files
    chainingEnabled: queueAnalysis.hasTranscriptionFiles,
    // Chaining checkbox should be disabled (and unchecked) when we only have translation files
    shouldDisableChaining: queueAnalysis.hasTranslationFiles && !queueAnalysis.hasTranscriptionFiles
  };

  // Auto-disable chaining when we only have translation files
  React.useEffect(() => {
    if (uiState.shouldDisableChaining && batchSettings.enableChaining) {
      setBatchSettings(prev => ({ ...prev, enableChaining: false }));
    }
  }, [uiState.shouldDisableChaining, batchSettings.enableChaining]);

  // Credit tracking helper functions
  const updateFileCredits = (fileId: string, creditsUsed: number) => {
    // Update file-level credit tracking
    setQueue(prev => prev.map(f => 
      f.id === fileId ? { ...f, creditsUsed } : f
    ));

    // Update batch-level credit tracking
    setBatchCreditStats(prev => {
      const newCreditsPerFile = new Map(prev.creditsPerFile);
      const previousCredits = newCreditsPerFile.get(fileId) || 0;
      newCreditsPerFile.set(fileId, creditsUsed);
      
      const totalCreditsUsed = Array.from(newCreditsPerFile.values()).reduce((sum, credits) => sum + credits, 0);
      
      return {
        totalCreditsUsed,
        creditsPerFile: newCreditsPerFile
      };
    });
  };

  const resetCreditTracking = () => {
    setBatchCreditStats({
      totalCreditsUsed: 0,
      creditsPerFile: new Map()
    });
    
    // Clear credits from all files
    setQueue(prev => prev.map(f => ({ ...f, creditsUsed: undefined })));
  };

  const resetBatchStats = () => {
    setBatchStats({
      startTime: null,
      endTime: null,
      totalFilesProcessed: 0,
      successfulFiles: 0,
      outputFiles: []
    });
  };

  const addOutputFile = (filePath: string) => {
    setBatchStats(prev => ({
      ...prev,
      outputFiles: [...prev.outputFiles, filePath]
    }));
  };

  // Batch processing functions
  const startBatchProcessing = async () => {
    if (queue.length === 0 || !apiRef.current) return;

    setIsProcessing(true);
    setIsPaused(false);
    setCurrentFileIndex(0);
    setOverallProgress(0);
    processingRef.current = true;
    shouldStopRef.current = false;
    resetCreditTracking(); // Reset credit tracking for new batch
    resetBatchStats(); // Reset batch statistics
    const originalQueue = [...queue]; // Capture original queue to avoid issues with queue changes
    const totalFiles = originalQueue.length; // Store original queue length for progress calculation
    
    // Initialize batch stats
    setBatchStats(prev => ({
      ...prev,
      startTime: new Date(),
      totalFilesProcessed: totalFiles
    }));
    
    setAppProcessing(true, `Starting batch processing of ${totalFiles} files...`);

    logger.info('BatchScreen', 'Starting batch processing', {
      queueLength: totalFiles,
      transcriptionModel: batchSettings.transcriptionModel,
      translationModel: batchSettings.translationModel,
      enableChaining: batchSettings.enableChaining
    });

    try {
      for (let i = 0; i < originalQueue.length; i++) {
        if (shouldStopRef.current) break;

        while (isPaused && !shouldStopRef.current) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (shouldStopRef.current) break;

        setCurrentFileIndex(i);
        const file = originalQueue[i];

        // Update file status to processing
        setQueue(prev => prev.map(f => 
          f.id === file.id ? { ...f, status: 'processing' as const, progress: 0 } : f
        ));

        await processFile(file, i);

        // Update overall progress
        const progress = Math.round(((i + 1) / totalFiles) * 100);
        setOverallProgress(progress);
        setAppProcessing(true, `Batch processing: ${i + 1}/${totalFiles} files completed (${progress}%)`);
      }

      logger.info('BatchScreen', 'Batch processing completed');
      
      // Finalize batch stats
      setBatchStats(prev => ({
        ...prev,
        endTime: new Date(),
        successfulFiles: queue.filter(f => f.status === 'completed').length
      }));
      
      const completionMessage = batchCreditStats.totalCreditsUsed > 0 
        ? `Batch processing completed successfully! (${batchCreditStats.totalCreditsUsed} credits used)`
        : 'Batch processing completed successfully!';
      setAppProcessing(true, completionMessage);
      
      // Show completion summary popup
      setShowCompletionSummary(true);
      
      setTimeout(() => setAppProcessing(false), 3000);
    } catch (error) {
      logger.error('BatchScreen', 'Batch processing failed', error);
      setAppProcessing(true, 'Batch processing failed');
      setTimeout(() => setAppProcessing(false), 3000);
    } finally {
      setIsProcessing(false);
      setIsPaused(false);
      setCurrentFileIndex(-1);
      processingRef.current = false;
    }
  };

  const processFile = async (file: BatchFile, index: number) => {
    try {
      logger.info('BatchScreen', `Processing file ${index + 1}/${queue.length}: ${file.name}`);
      setAppProcessing(true, `Processing file ${index + 1}/${queue.length}: ${file.name}`);

      if (file.type === 'transcription') {
        await processTranscriptionFile(file, index);
      } else if (file.type === 'translation') {
        await processTranslationFile(file, index);
      }

      // Mark file as completed
      setQueue(prev => prev.map(f => 
        f.id === file.id ? { ...f, status: 'completed' as const, progress: 100 } : f
      ));

      // Remove completed file after a short delay to let user see the completion (if enabled)
      if (config.autoRemoveCompletedFiles) {
        setTimeout(() => {
          setQueue(prev => prev.filter(f => f.id !== file.id));
        }, 2000); // 2 second delay
      }

    } catch (error) {
      logger.error('BatchScreen', `Failed to process file: ${file.name}`, error);
      
      setQueue(prev => prev.map(f => 
        f.id === file.id ? { 
          ...f, 
          status: 'error' as const, 
          error: error instanceof Error ? error.message : 'Processing failed'
        } : f
      ));

      if (batchSettings.abortOnError) {
        throw error;
      }
    }
  };

  const processTranscriptionFile = async (file: BatchFile, index: number) => {
    if (!apiRef.current) throw new Error('API not available');

    // Step 1: Initiate transcription
    setQueue(prev => prev.map(f => 
      f.id === file.id ? { ...f, status: 'processing' as const, progress: 10 } : f
    ));
    setAppProcessing(true, `Initiating transcription for ${file.name}...`);

    const transcriptionInitResult = await apiRef.current.initiateTranscription(file.path, {
      language: file.selectedSourceLanguage || file.detectedLanguage?.ISO_639_1 || 'auto',
      api: batchSettings.transcriptionModel,
      returnContent: true
    });

    if (transcriptionInitResult.status === 'ERROR') {
      setAppProcessing(true, `Transcription initiation failed for ${file.name}`);
      throw new Error(transcriptionInitResult.errors?.join(', ') || 'Transcription initiation failed');
    }

    // Step 2: Poll for transcription completion
    let transcriptionResult;
    if (transcriptionInitResult.status === 'COMPLETED' && transcriptionInitResult.translation) {
      // Immediate completion - extract credits
      if (transcriptionInitResult.data && typeof transcriptionInitResult.data.total_price === 'number' && transcriptionInitResult.data.total_price > 0) {
        updateFileCredits(file.id, transcriptionInitResult.data.total_price);
        logger.info('BatchScreen', `Credits used for immediate transcription of ${file.name}: ${transcriptionInitResult.data.total_price}`);
      }
      
      setAppProcessing(true, `Transcription completed instantly for ${file.name}`);
      transcriptionResult = transcriptionInitResult;
    } else if (transcriptionInitResult.correlation_id) {
      // Need to poll
      setQueue(prev => prev.map(f => 
        f.id === file.id ? { ...f, progress: 25 } : f
      ));
      setAppProcessing(true, `Transcription in progress for ${file.name}, polling for results...`);
      
      transcriptionResult = await pollForCompletion(transcriptionInitResult.correlation_id, 'transcription', file);
    } else {
      throw new Error('No correlation ID received for transcription');
    }

    let outputContent = transcriptionResult.translation || transcriptionResult.data?.return_content;
    
    // Step 3: Translation (if chaining enabled)
    if (batchSettings.enableChaining && outputContent) {
      setQueue(prev => prev.map(f => 
        f.id === file.id ? { ...f, progress: 60 } : f
      ));
      setAppProcessing(true, `Starting translation chain for ${file.name}...`);

      // Save transcription result to temporary file for translation
      const tempFileName = await generateOutputFileName(file.path, 'temp', 'transcription');
      await writeFileDirectly(outputContent, tempFileName);
      setAppProcessing(true, `Initiating translation for ${file.name}...`);
      
      const translationInitResult = await apiRef.current.initiateTranslation(tempFileName, {
        translateFrom: file.selectedSourceLanguage || file.detectedLanguage?.ISO_639_1 || 'auto',
        translateTo: batchSettings.targetLanguage,
        api: batchSettings.translationModel,
        returnContent: true
      });

      if (translationInitResult.status === 'ERROR') {
        setAppProcessing(true, `Translation initiation failed for ${file.name}`);
        throw new Error(translationInitResult.errors?.join(', ') || 'Translation initiation failed');
      }

      // Poll for translation completion
      let translationResult;
      if (translationInitResult.status === 'COMPLETED' && translationInitResult.translation) {
        // Immediate completion - extract credits for translation
        if (translationInitResult.data && typeof translationInitResult.data.total_price === 'number' && translationInitResult.data.total_price > 0) {
          // For chained operations, add to existing credits rather than replace
          const existingCredits = batchCreditStats.creditsPerFile.get(file.id) || 0;
          updateFileCredits(file.id, existingCredits + translationInitResult.data.total_price);
          logger.info('BatchScreen', `Credits used for immediate translation of ${file.name}: ${translationInitResult.data.total_price}`);
        }
        
        setAppProcessing(true, `Translation completed instantly for ${file.name}`);
        translationResult = translationInitResult;
      } else if (translationInitResult.correlation_id) {
        setQueue(prev => prev.map(f => 
          f.id === file.id ? { ...f, progress: 80 } : f
        ));
        setAppProcessing(true, `Translation in progress for ${file.name}, polling for results...`);
        
        translationResult = await pollForCompletion(translationInitResult.correlation_id, 'translation', file);
      } else {
        throw new Error('No correlation ID received for translation');
      }

      outputContent = translationResult.translation || translationResult.data?.return_content;
        
      // Clean up intermediate file if not keeping them
      if (!batchSettings.keepIntermediateFiles) {
        try {
          await window.electronAPI.deleteFile(tempFileName);
          logger.info('BatchScreen', `Cleaned up temporary file: ${tempFileName}`);
        } catch (cleanupError) {
          logger.warn('BatchScreen', 'Failed to cleanup intermediate file', cleanupError);
        }
      }
    }

    // Save final output
    if (outputContent) {
      const suffix = batchSettings.enableChaining ? 'translated' : 'transcribed';
      const targetLang = batchSettings.enableChaining ? batchSettings.targetLanguage : undefined;
      const outputPath = await generateOutputFileName(file.path, suffix, targetLang);
      const savedPath = await writeFileDirectly(outputContent, outputPath);
      
      logger.info('BatchScreen', `File saved: ${savedPath}`);
      addOutputFile(savedPath); // Track output file for summary
      
      // Update file with final output path
      setQueue(prev => prev.map(f => 
        f.id === file.id ? { ...f, outputPath: savedPath, progress: 100 } : f
      ));
    }
  };

  const processTranslationFile = async (file: BatchFile, index: number) => {
    if (!apiRef.current) throw new Error('API not available');

    // Step 1: Initiate translation
    setQueue(prev => prev.map(f => 
      f.id === file.id ? { ...f, status: 'processing' as const, progress: 10 } : f
    ));
    setAppProcessing(true, `Initiating translation for ${file.name}...`);

    const translationInitResult = await apiRef.current.initiateTranslation(file.path, {
      translateFrom: file.selectedSourceLanguage || file.detectedLanguage?.ISO_639_1 || 'auto',
      translateTo: batchSettings.targetLanguage,
      api: batchSettings.translationModel,
      returnContent: true
    });

    if (translationInitResult.status === 'ERROR') {
      setAppProcessing(true, `Translation initiation failed for ${file.name}`);
      throw new Error(translationInitResult.errors?.join(', ') || 'Translation initiation failed');
    }

    // Step 2: Poll for completion or handle immediate result
    let translationResult;
    if (translationInitResult.status === 'COMPLETED' && translationInitResult.translation) {
      // Immediate completion - extract credits
      if (translationInitResult.data && typeof translationInitResult.data.total_price === 'number' && translationInitResult.data.total_price > 0) {
        updateFileCredits(file.id, translationInitResult.data.total_price);
        logger.info('BatchScreen', `Credits used for immediate standalone translation of ${file.name}: ${translationInitResult.data.total_price}`);
      }
      
      setAppProcessing(true, `Translation completed instantly for ${file.name}`);
      translationResult = translationInitResult;
    } else if (translationInitResult.correlation_id) {
      // Need to poll
      setQueue(prev => prev.map(f => 
        f.id === file.id ? { ...f, progress: 50 } : f
      ));
      setAppProcessing(true, `Translation in progress for ${file.name}, polling for results...`);
      
      translationResult = await pollForCompletion(translationInitResult.correlation_id, 'translation', file);
    } else {
      throw new Error('No correlation ID received for translation');
    }

    // Save output
    const outputContent = translationResult.translation || translationResult.data?.return_content;
    if (outputContent) {
      const outputPath = await generateOutputFileName(file.path, 'translated', batchSettings.targetLanguage);
      const savedPath = await writeFileDirectly(outputContent, outputPath);
      
      logger.info('BatchScreen', `File saved: ${savedPath}`);
      addOutputFile(savedPath); // Track output file for summary
      
      // Update file with output path
      setQueue(prev => prev.map(f => 
        f.id === file.id ? { ...f, outputPath: savedPath, progress: 100 } : f
      ));
    }
  };

  const pollForCompletion = async (correlationId: string, type: 'transcription' | 'translation', file: BatchFile): Promise<any> => {
    const maxAttempts = 60; // 5 minutes with 5-second intervals
    let attempts = 0;
    
    return new Promise((resolve, reject) => {
      const poll = async () => {
        if (shouldStopRef.current) {
          reject(new Error('Processing stopped by user'));
          return;
        }

        attempts++;
        
        try {
          const result = type === 'transcription' 
            ? await apiRef.current!.checkTranscriptionStatus(correlationId)
            : await apiRef.current!.checkTranslationStatus(correlationId);
            
          logger.info('BatchScreen', `${type} status check (attempt ${attempts}):`, result);
          setAppProcessing(true, `${type.charAt(0).toUpperCase() + type.slice(1)} in progress... (attempt ${attempts}/${maxAttempts})`);
          
          if (result.status === 'COMPLETED') {
            // Extract credits used from the completed result
            if (result.data && typeof result.data.total_price === 'number' && result.data.total_price > 0) {
              // For chained operations (translation after transcription), add to existing credits
              if (type === 'translation' && batchSettings.enableChaining) {
                const existingCredits = batchCreditStats.creditsPerFile.get(file.id) || 0;
                updateFileCredits(file.id, existingCredits + result.data.total_price);
              } else {
                updateFileCredits(file.id, result.data.total_price);
              }
              logger.info('BatchScreen', `Credits used for ${type} of ${file.name}: ${result.data.total_price}`);
            }
            
            setAppProcessing(true, `${type.charAt(0).toUpperCase() + type.slice(1)} completed successfully!`);
            resolve(result);
          } else if (result.status === 'ERROR') {
            setAppProcessing(true, `${type.charAt(0).toUpperCase() + type.slice(1)} failed`);
            reject(new Error(result.errors?.join(', ') || `${type} failed`));
          } else if (result.status === 'TIMEOUT') {
            setAppProcessing(true, `${type.charAt(0).toUpperCase() + type.slice(1)} timed out`);
            reject(new Error(`${type} timed out`));
          } else if (attempts >= maxAttempts) {
            setAppProcessing(true, `${type.charAt(0).toUpperCase() + type.slice(1)} polling timeout`);
            reject(new Error(`${type} polling timeout after ${maxAttempts} attempts (${attempts * 5} seconds)`));
          } else {
            // Update progress during polling
            const progressBase = type === 'transcription' ? 25 : 50;
            const progressIncrement = (attempts / maxAttempts) * 30; // 30% of progress during polling
            setQueue(prev => prev.map(f => 
              f.id === file.id ? { ...f, progress: Math.min(90, progressBase + progressIncrement) } : f
            ));
            
            // Continue polling after 5 seconds
            setTimeout(() => poll(), 5000);
          }
        } catch (error) {
          reject(error);
        }
      };
      
      poll();
    });
  };

  const stopBatchProcessing = () => {
    shouldStopRef.current = true;
    setIsProcessing(false);
    setIsPaused(false);
    setCurrentFileIndex(-1);
    processingRef.current = false;
  };

  // Helper function to generate output file name with language code and duplicate checking
  const generateOutputFileName = async (originalFilePath: string, suffix: string, targetLanguage?: string): Promise<string> => {
    // Determine output directory
    const outputDir = batchSettings.useCustomOutputDirectory && batchSettings.outputDirectory 
      ? batchSettings.outputDirectory 
      : await window.electronAPI.getDirectoryName(originalFilePath);
    
    // Generate base name with language code
    const originalName = originalFilePath.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'file';
    const languageCode = targetLanguage || batchSettings.targetLanguage;
    const baseName = `${originalName}_${suffix}${languageCode ? `_${languageCode}` : ''}`;
    
    // Create full base path for unique name generation
    const fullBasePath = `${outputDir}/${baseName}`;
    
    // Generate unique filename using IPC
    const uniquePath = await window.electronAPI.generateUniqueFileName(fullBasePath, batchSettings.outputFormat);
    
    return uniquePath;
  };

  // Helper function to write file directly to determined path
  const writeFileDirectly = async (content: string, outputPath: string): Promise<string> => {
    return await window.electronAPI.writeFileDirectly(content, outputPath);
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      padding: '20px',
      gap: '20px'
    }}>
      <h1>Batch Processing</h1>
      <p>Select multiple files to transcribe or translate:</p>

      <FileSelector 
        onFileSelect={handleSingleFileSelect} 
        onMultipleFileSelect={handleMultipleFileSelect}
        disabled={isProcessing} 
      />
      
      {/* File Queue Display - Only show when there are files */}
      {queue.length > 0 && (
        <div style={{
          border: '1px solid #ddd',
          borderRadius: '4px',
          padding: '15px',
          backgroundColor: '#ffffff'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '15px' }}>
            <h3>File Queue ({queue.length} files)</h3>
            {isDetectingLanguages && (
              <p style={{ color: '#007bff', fontSize: '14px', fontStyle: 'italic' }}>
                Detecting languages sequentially... ({queue.filter(f => f.status === 'detecting').length} in progress)
              </p>
            )}
            <button 
              onClick={clearQueue}
              disabled={isProcessing}
              style={{
                padding: '8px 16px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isProcessing ? 'not-allowed' : 'pointer'
              }}
            >
              Clear Queue
            </button>
          </div>

          {/* Queue List */}
          <div style={{
            maxHeight: '300px',
            overflowY: 'auto',
            border: '1px solid #ddd',
            borderRadius: '4px',
            backgroundColor: 'white'
          }}>
            {queue.map((file, index) => (
              <div key={file.id} style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px',
                borderBottom: index < queue.length - 1 ? '1px solid #eee' : 'none',
                backgroundColor: index === currentFileIndex ? '#e3f2fd' : 'transparent'
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold' }}>{file.name}</div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    Type: {file.type} | Status: {file.status}
                    {file.detectedLanguage && ` | Language: ${file.detectedLanguage.native || file.detectedLanguage.name}`}
                    {file.progress !== undefined && ` | Progress: ${file.progress}%`}
                    {file.creditsUsed !== undefined && file.creditsUsed > 0 && ` | Credits: ${file.creditsUsed}`}
                  </div>
                  
                  {/* Source Language Selector for Translation Files */}
                  {file.type === 'translation' && translationInfo && batchSettings.translationModel && (
                    <div style={{ marginTop: '8px' }}>
                      <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '4px' }}>
                        Source Language:
                      </label>
                      <select
                        value={file.selectedSourceLanguage || ''}
                        onChange={(e) => handleSourceLanguageChange(file.id, e.target.value)}
                        disabled={isProcessing}
                        style={{
                          fontSize: '11px',
                          padding: '2px 4px',
                          border: '1px solid #ddd',
                          borderRadius: '3px',
                          backgroundColor: 'white',
                          maxWidth: '200px'
                        }}
                      >
                        {!file.selectedSourceLanguage && <option value="">{file.detectedLanguage ? 'Select variant...' : 'Select language...'}</option>}
                        {(() => {
                          const apiLanguages = translationInfo.languages[batchSettings.translationModel] || [];
                          const matching = getMatchingSourceLanguages(file.detectedLanguage?.ISO_639_1 || null, apiLanguages);
                          return matching.map(lang => (
                            <option key={lang.language_code} value={lang.language_code}>
                              {lang.language_name}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>
                  )}
                  
                  {/* Source Language Selector for Transcription Files */}
                  {file.type === 'transcription' && transcriptionInfo && batchSettings.transcriptionModel && (
                    <div style={{ marginTop: '8px' }}>
                      <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '4px' }}>
                        Source Language:
                      </label>
                      <select
                        value={file.selectedSourceLanguage || ''}
                        onChange={(e) => handleSourceLanguageChange(file.id, e.target.value)}
                        disabled={isProcessing}
                        style={{
                          fontSize: '11px',
                          padding: '2px 4px',
                          border: '1px solid #ddd',
                          borderRadius: '3px',
                          backgroundColor: 'white',
                          maxWidth: '200px'
                        }}
                      >
                        {!file.selectedSourceLanguage && <option value="">{file.detectedLanguage ? 'Select variant...' : 'Select language...'}</option>}
                        {(() => {
                          const apiLanguages = transcriptionInfo.languages[batchSettings.transcriptionModel] || [];
                          const matching = getMatchingSourceLanguages(file.detectedLanguage?.ISO_639_1 || null, apiLanguages);
                          return matching.map(lang => (
                            <option key={lang.language_code} value={lang.language_code}>
                              {lang.language_name}
                            </option>
                          ));
                        })()}
                      </select>
                    </div>
                  )}
                  
                  {file.error && <div style={{ fontSize: '12px', color: '#dc3545' }}>Error: {file.error}</div>}
                </div>
                
                {!isProcessing && (
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button onClick={() => moveFileUp(index)} disabled={index === 0} title="Move Up">↑</button>
                    <button onClick={() => moveFileDown(index)} disabled={index === queue.length - 1} title="Move Down">↓</button>
                    <button onClick={() => removeFromQueue(file.id)} title="Remove">×</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Welcome message when no files are selected */}
      {queue.length === 0 && (
        <div 
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: '#f8f9fa',
            borderRadius: '12px',
            border: '2px dashed #dee2e6',
            margin: '20px 0',
            opacity: 1,
            transform: 'translateY(0)',
            transition: 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out'
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>
            ⚡
          </div>
          <div style={{ fontSize: '28px', color: '#495057', marginBottom: '15px', fontWeight: '500' }}>
            Batch Processing Power
          </div>
          <div style={{ fontSize: '16px', color: '#6c757d', marginBottom: '25px', lineHeight: '1.5' }}>
            Process multiple files automatically with advanced workflow control
          </div>
          <div style={{ fontSize: '14px', color: '#adb5bd', marginBottom: '20px' }}>
            <div style={{ marginBottom: '8px' }}>
              <strong>Bulk Transcription:</strong> Convert multiple audio/video files to text
            </div>
            <div style={{ marginBottom: '8px' }}>
              <strong>Bulk Translation:</strong> Translate multiple subtitle files
            </div>
            <div>
              <strong>Smart Chaining:</strong> Auto-transcribe then translate in sequence
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
            Use "Select Files" above or drag & drop multiple files to get started
          </div>
        </div>
      )}

      {/* Settings Panel */}
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '20px',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px',
          border: '1px solid #dee2e6',
          opacity: queue.length > 0 ? 1 : 0,
          transform: queue.length > 0 ? 'translateY(0)' : 'translateY(-10px)',
          transition: 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out',
          pointerEvents: queue.length > 0 ? 'auto' : 'none',
          visibility: queue.length > 0 ? 'visible' : 'hidden'
        }}
      >
        <div>
          <h4 style={{ opacity: uiState.transcriptionEnabled ? 1 : 0.5 }}>
            Transcription Settings
            {!uiState.transcriptionEnabled && <span style={{ fontSize: '12px', fontWeight: 'normal' }}> (No audio/video files)</span>}
          </h4>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Model:</label>
            <select
              value={batchSettings.transcriptionModel}
              onChange={(e) => handleTranscriptionModelChange(e.target.value)}
              disabled={isProcessing || !uiState.transcriptionEnabled}
              style={{ width: '100%', padding: '5px', opacity: uiState.transcriptionEnabled ? 1 : 0.5 }}
            >
              {!transcriptionInfo?.apis?.length ? (
                <option value="">Loading models...</option>
              ) : (
                transcriptionInfo.apis.map(api => (
                  <option key={api} value={api}>{api}</option>
                ))
              )}
            </select>
          </div>
        </div>

        <div>
          <h4 style={{ opacity: uiState.translationEnabled ? 1 : 0.5 }}>
            Translation Settings
            {!uiState.translationEnabled && <span style={{ fontSize: '12px', fontWeight: 'normal' }}> (Enable chaining or add subtitle files)</span>}
          </h4>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Model:</label>
            <select
              value={batchSettings.translationModel}
              onChange={(e) => handleTranslationModelChange(e.target.value)}
              disabled={isProcessing || !uiState.translationEnabled}
              style={{ width: '100%', padding: '5px', opacity: uiState.translationEnabled ? 1 : 0.5 }}
            >
              {!translationInfo?.apis?.length ? (
                <option value="">Loading models...</option>
              ) : (
                translationInfo.apis.map(api => (
                  <option key={api} value={api}>{api}</option>
                ))
              )}
            </select>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Target Language:</label>
            <select
              value={batchSettings.targetLanguage}
              onChange={(e) => setBatchSettings(prev => ({ ...prev, targetLanguage: e.target.value }))}
              disabled={isProcessing || !uiState.translationEnabled}
              style={{ width: '100%', padding: '5px', opacity: uiState.translationEnabled ? 1 : 0.5 }}
            >
              {isLoadingLanguages ? (
                <option value="">Loading languages...</option>
              ) : (
                availableTranslationLanguages
                  .filter((lang, index, arr) => arr.findIndex(l => l.language_code === lang.language_code) === index)
                  .map(lang => (
                    <option key={lang.language_code} value={lang.language_code}>{lang.language_name} ({lang.language_code})</option>
                  ))
              )}
            </select>
          </div>
        </div>

        <div>
          <h4>Output Settings</h4>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px' }}>Format:</label>
            <select
              value={batchSettings.outputFormat}
              onChange={(e) => setBatchSettings(prev => ({ ...prev, outputFormat: e.target.value }))}
              disabled={isProcessing}
              style={{ width: '100%', padding: '5px' }}
            >
              {fileFormatsConfig.subtitle.map(format => (
                <option key={format} value={format}>{format.toUpperCase()}</option>
              ))}
            </select>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              marginBottom: '10px'
            }}>
              <input
                type="checkbox"
                checked={batchSettings.useCustomOutputDirectory}
                onChange={(e) => setBatchSettings(prev => ({ 
                  ...prev, 
                  useCustomOutputDirectory: e.target.checked,
                  outputDirectory: e.target.checked ? prev.outputDirectory : ''
                }))}
                disabled={isProcessing}
              />
              Use custom output directory
            </label>
            {batchSettings.useCustomOutputDirectory && (
              <div style={{ display: 'flex', gap: '5px', marginLeft: '25px' }}>
                <input
                  type="text"
                  value={batchSettings.outputDirectory}
                  onChange={(e) => setBatchSettings(prev => ({ ...prev, outputDirectory: e.target.value }))}
                  disabled={isProcessing}
                  placeholder="Select output directory"
                  style={{ flex: 1, padding: '5px' }}
                />
                <button
                  onClick={async () => {
                    try {
                      const directory = await window.electronAPI.selectDirectory();
                      if (directory) {
                        setBatchSettings(prev => ({ ...prev, outputDirectory: directory }));
                      }
                    } catch (error) {
                      console.error('Directory selection failed:', error);
                    }
                  }}
                  disabled={isProcessing}
                  style={{ padding: '5px 10px' }}
                >
                  Browse
                </button>
              </div>
            )}
            {!batchSettings.useCustomOutputDirectory && (
              <div style={{ 
                fontSize: '12px', 
                color: '#666', 
                fontStyle: 'italic',
                marginLeft: '25px'
              }}>
                Files will be saved in the same directory as source files
              </div>
            )}
          </div>
        </div>

        <div>
          <h4>Processing Options</h4>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              opacity: uiState.chainingEnabled ? 1 : 0.5
            }}>
              <input
                type="checkbox"
                checked={batchSettings.enableChaining}
                onChange={(e) => setBatchSettings(prev => ({ ...prev, enableChaining: e.target.checked }))}
                disabled={isProcessing || !uiState.chainingEnabled}
              />
              Enable Transcription → Translation Chaining
              {!uiState.chainingEnabled && <span style={{ fontSize: '12px', fontStyle: 'italic' }}>(No audio/video files)</span>}
            </label>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                checked={batchSettings.abortOnError}
                onChange={(e) => setBatchSettings(prev => ({ ...prev, abortOnError: e.target.checked }))}
                disabled={isProcessing}
              />
              Abort batch processing on first error
            </label>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              opacity: uiState.transcriptionEnabled ? 1 : 0.5
            }}>
              <input
                type="checkbox"
                checked={batchSettings.keepIntermediateFiles}
                onChange={(e) => setBatchSettings(prev => ({ ...prev, keepIntermediateFiles: e.target.checked }))}
                disabled={isProcessing || !uiState.transcriptionEnabled}
              />
              Keep intermediate transcription files
              {!uiState.transcriptionEnabled && <span style={{ fontSize: '12px', fontStyle: 'italic' }}>(No transcription involved)</span>}
            </label>
          </div>
        </div>
      </div>

      {/* Processing Controls */}
      <div 
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '20px',
          backgroundColor: '#e9ecef',
          borderRadius: '8px',
          border: '1px solid #ced4da',
          opacity: queue.length > 0 ? 1 : 0,
          transform: queue.length > 0 ? 'translateY(0)' : 'translateY(-10px)',
          transition: 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out',
          pointerEvents: queue.length > 0 ? 'auto' : 'none',
          visibility: queue.length > 0 ? 'visible' : 'hidden'
        }}
      >
        <div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>
            Overall Progress: {overallProgress}%
            {batchCreditStats.totalCreditsUsed > 0 && (
              <span style={{ marginLeft: '20px', fontSize: '16px', color: '#2196F3' }}>
                Credits Used: {batchCreditStats.totalCreditsUsed}
              </span>
            )}
          </div>
          <div style={{ fontSize: '14px', color: '#666' }}>
            {isProcessing ? (
              currentFileIndex >= 0 ? 
                `Processing: ${queue[currentFileIndex]?.name} (${currentFileIndex + 1}/${queue.length})` :
                'Starting batch processing...'
            ) : (
              `Ready to process ${queue.length} files`
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={!isProcessing ? startBatchProcessing : stopBatchProcessing}
            disabled={!isProcessing && (queue.length === 0 || !isOnline() || (!batchSettings.transcriptionModel && !batchSettings.translationModel))}
            style={{
              padding: '10px 20px',
              backgroundColor: isProcessing ? '#dc3545' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (!isProcessing && (queue.length === 0 || !isOnline() || (!batchSettings.transcriptionModel && !batchSettings.translationModel))) ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              minWidth: '180px'
            }}
          >
            {isProcessing ? 'Stop Batch Processing' : 'Start Batch Processing'}
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      {isProcessing && (
        <div style={{
          width: '100%',
          height: '10px',
          backgroundColor: '#e9ecef',
          borderRadius: '5px',
          overflow: 'hidden',
          border: '1px solid #ced4da'
        }}>
          <div
            style={{
              width: `${overallProgress}%`,
              height: '100%',
              backgroundColor: '#007bff',
              transition: 'width 0.3s ease'
            }}
          />
        </div>
      )}

      {/* Batch Completion Summary Popup */}
      {showCompletionSummary && (
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
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
          }}>
            <h2 style={{ 
              margin: '0 0 20px 0', 
              color: '#333',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '24px' }}>🎉</span>
              Batch Processing Complete
            </h2>
            
            {/* Summary Stats */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '16px',
              marginBottom: '20px',
              padding: '16px',
              backgroundColor: '#f8f9fa',
              borderRadius: '6px'
            }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#28a745' }}>
                  {batchStats.successfulFiles}
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>Files Processed</div>
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#2196F3' }}>
                  {batchCreditStats.totalCreditsUsed}
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>Credits Used</div>
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#ff6b35' }}>
                  {batchStats.startTime && batchStats.endTime ? 
                    Math.round((batchStats.endTime.getTime() - batchStats.startTime.getTime()) / 1000) : 0
                  }s
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>Duration</div>
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#6f42c1' }}>
                  {batchStats.outputFiles.length}
                </div>
                <div style={{ fontSize: '14px', color: '#666' }}>Output Files</div>
              </div>
            </div>

            {/* Output Files List */}
            {batchStats.outputFiles.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <h3 style={{ 
                  margin: '0 0 12px 0', 
                  fontSize: '16px', 
                  color: '#333' 
                }}>
                  Output Files:
                </h3>
                <div style={{
                  maxHeight: '200px',
                  overflow: 'auto',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  backgroundColor: '#f8f9fa'
                }}>
                  {batchStats.outputFiles.map((filePath, index) => (
                    <div 
                      key={index}
                      style={{
                        padding: '8px 12px',
                        borderBottom: index < batchStats.outputFiles.length - 1 ? '1px solid #eee' : 'none',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        color: '#333',
                        cursor: 'pointer'
                      }}
                      onClick={() => {
                        // Copy to clipboard
                        navigator.clipboard.writeText(filePath);
                      }}
                      title="Click to copy path"
                    >
                      {filePath}
                    </div>
                  ))}
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: '#666', 
                  marginTop: '8px',
                  fontStyle: 'italic'
                }}>
                  💡 Click any file path to copy it to clipboard
                </div>
              </div>
            )}

            {/* Close Button */}
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={() => setShowCompletionSummary(false)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BatchScreen;