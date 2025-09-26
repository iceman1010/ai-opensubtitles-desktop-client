import CacheManager from './cache';
import { logger } from '../utils/errorLogger';
import { apiRequestWithRetry, getUserFriendlyErrorMessage } from '../utils/networkUtils';
import appConfig from '../config/appConfig.json';

// Fallback in case import fails
const getUserAgent = () => {
  if (appConfig && appConfig.userAgent) {
    return appConfig.userAgent;
  }
  console.error('AppConfig failed to load, using fallback User-Agent');
  return 'AI.Opensubtitles.com-Client v1.0.0';
};

export interface TranscriptionOptions {
  language: string;
  api: string;
  returnContent?: boolean;
}

export interface TranslationOptions {
  translateFrom: string;
  translateTo: string;
  api: string;
  returnContent?: boolean;
}

export interface APIResponse<T = any> {
  correlation_id?: string;
  status: 'CREATED' | 'PENDING' | 'COMPLETED' | 'ERROR' | 'TIMEOUT';
  data?: T;
  errors?: string[];
  translation?: string;
}

export interface LanguageInfo {
  language_code: string;
  language_name: string;
}

export interface TranscriptionInfo {
  apis: string[];
  languages: LanguageInfo[] | { [apiName: string]: LanguageInfo[] };
}

export interface TranslationInfo {
  apis: string[];
  languages: { [apiName: string]: LanguageInfo[] };
}

export interface ServiceModel {
  name: string;
  display_name: string;
  description: string;
  pricing: string;
  reliability: string;
  price: number;
  languages_supported: LanguageInfo[];
}

export interface ServicesInfo {
  Translation: ServiceModel[];
  Transcription: ServiceModel[];
}

export interface CreditPackage {
  name: string;
  value: string;
  discount_percent: number;
  checkout_url: string;
}

export interface CompletedTaskData {
  file_name: string;
  url: string;
  character_count: number;
  unit_price: number;
  total_price: number;
  credits_left: number;
  task: {
    login: string;
    loginid: string;
    id: string;
    api: string;
    language: string;
    translation?: string;
    start_time: number;
  };
  complete: number;
}

export interface DetectedLanguage {
  W3C: string;
  name: string;
  native: string;
  ISO_639_1: string;
  ISO_639_2b: string;
}

export interface LanguageDetectionResult {
  format?: string;
  type: 'text' | 'audio';
  language?: DetectedLanguage;
  duration?: number;
  media?: string;
}

export interface RecentMediaItem {
  id: number;
  time: number;
  time_str: string;
  files?: string[];
}

export class OpenSubtitlesAPI {
  private baseURL = 'https://api.opensubtitles.com/api/v1';
  private apiKey: string = '';
  private token: string = '';
  private apiUrlParameter: string = '';

  constructor(apiKey?: string, baseUrl?: string, apiUrlParameter?: string) {
    if (apiKey) {
      this.setApiKey(apiKey);
    }
    if (baseUrl) {
      this.setBaseUrl(baseUrl);
    }
    if (apiUrlParameter) {
      this.setApiUrlParameter(apiUrlParameter);
    }
  }

  setBaseUrl(baseUrl: string): void {
    // baseUrl should be like 'https://api.opensubtitles.com/api/v1'
    this.baseURL = baseUrl;
  }

  setApiUrlParameter(apiUrlParameter: string): void {
    this.apiUrlParameter = apiUrlParameter;
  }

  private getAIUrl(endpoint: string): string {
    const baseUrl = `${this.baseURL}/ai${endpoint}`;
    return this.apiUrlParameter ? `${baseUrl}${this.apiUrlParameter}` : baseUrl;
  }

  private getLoginUrl(endpoint: string): string {
    const baseUrl = `${this.baseURL}${endpoint}`;
    return this.apiUrlParameter ? `${baseUrl}${this.apiUrlParameter}` : baseUrl;
  }

  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
  }

  async loadCachedToken(): Promise<boolean> {
    try {
      const cachedToken = await window.electronAPI.getValidToken();
      if (cachedToken) {
        this.token = cachedToken;
        logger.info('API', 'Using cached authentication token');
        return true;
      }
      return false;
    } catch (error) {
      logger.error('API', 'Failed to load cached token', error);
      return false;
    }
  }

  private async saveToken(token: string): Promise<void> {
    try {
      await window.electronAPI.saveToken(token);
      logger.info('API', 'Token saved to cache');
    } catch (error) {
      logger.error('API', 'Failed to save token', error);
    }
  }

  async clearCachedToken(): Promise<void> {
    try {
      await window.electronAPI.clearToken();
      this.token = '';
      logger.info('API', 'Cached token cleared');
    } catch (error) {
      logger.error('API', 'Failed to clear token', error);
    }
  }


  async login(username: string, password: string): Promise<{ success: boolean; token?: string; error?: string }> {
    // Validate required parameters before attempting login
    if (!username || !password) {
      const error = 'Username and password are required';
      logger.error('API', error);
      return { success: false, error };
    }

    if (!this.apiKey) {
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

    try {
      const result = await apiRequestWithRetry(async () => {
        const userAgent = getUserAgent();
        logger.info('API', `Attempting login with username: ${username}`);
        logger.info('API', `Using User-Agent: ${userAgent}`);
        logger.info('API', `Using API Key: ${this.apiKey ? 'SET' : 'NOT SET'}`);
        
        const headers = {
          'Accept': 'application/json',
          'Api-Key': this.apiKey || '',
          'Content-Type': 'application/json',
          'User-Agent': userAgent,
        };
        
        logger.info('API', `Request headers:`, headers);
        
        // Use the main API login endpoint, not the /ai one
        const response = await fetch(this.getLoginUrl('/login'), {
          method: 'POST',
          headers,
          body: JSON.stringify({
            username,
            password,
          }),
        });
        
        logger.info('API', `Login response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
          const errorText = await response.text();
          logger.error('API', 'Login failed with status', {
            status: response.status,
            statusText: response.statusText,
            error: errorText
          });
          
          // Create error with status for better categorization
          const error = new Error(`HTTP ${response.status}: ${response.statusText} - ${errorText}`);
          (error as any).status = response.status;
          (error as any).responseText = errorText;
          throw error;
        }

        const responseData = await response.json();
        logger.info('API', 'Login response received', responseData);

        if (responseData.token) {
          this.token = responseData.token;
          await this.saveToken(this.token); // Cache the token
          logger.info('API', 'Login successful, token set and cached');
          return { success: true, token: this.token };
        }

        logger.error('API', 'Login failed: No token received');
        throw new Error('No token received from server');
      }, 'Login', 3);
      
      return result;
    } catch (error: any) {
      logger.error('API', 'Login error after retries', {
        error: error.message,
      });
      return {
        success: false,
        error: getUserFriendlyErrorMessage(error),
      };
    }
  }

  async getTranscriptionInfo(): Promise<{ success: boolean; data?: TranscriptionInfo; error?: string }> {
    const cacheKey = 'transcription_info';
    const cached = CacheManager.get<TranscriptionInfo>(cacheKey);

    if (cached) {
      logger.info('API', 'Using cached transcription info');
      return { success: true, data: cached };
    }

    if (!this.apiKey) {
      const error = 'API Key is required to fetch transcription info';
      logger.error('API', error);
      return { success: false, error };
    }

    try {
      const result = await apiRequestWithRetry(async () => {
        logger.info('API', 'Fetching transcription info from API...');

        const headers = {
          'Accept': 'application/json',
          'Api-Key': this.apiKey || '',
          'Content-Type': 'application/json',
          'User-Agent': getUserAgent(),
        };

        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }

        const [apisResponse, languagesResponse] = await Promise.all([
          fetch(this.getAIUrl('/info/transcription_apis'), {
            method: 'POST',
            headers,
          }),
          fetch(this.getAIUrl('/info/transcription_languages'), {
            method: 'POST',
            headers,
          }),
        ]);

        if (!apisResponse.ok) {
          const error = new Error(`APIs request failed: ${apisResponse.status} ${apisResponse.statusText}`);
          (error as any).status = apisResponse.status;
          (error as any).responseText = await apisResponse.text().catch(() => '');
          throw error;
        }
        if (!languagesResponse.ok) {
          const error = new Error(`Languages request failed: ${languagesResponse.status} ${languagesResponse.statusText}`);
          (error as any).status = languagesResponse.status;
          (error as any).responseText = await languagesResponse.text().catch(() => '');
          throw error;
        }

        const apisData = await apisResponse.json();
        const languagesData = await languagesResponse.json();

        logger.info('API', 'Transcription APIs response', apisData);
        logger.info('API', 'Transcription languages response', languagesData);

        const data: TranscriptionInfo = {
          apis: apisData.data || apisData,
          languages: languagesData.data || languagesData,
        };

        CacheManager.set(cacheKey, data);
        logger.info('API', 'Transcription info cached successfully');

        return {
          success: true,
          data,
        };
      }, 'Get Transcription Info', 3);

      return result;
    } catch (error: any) {
      logger.error('API', 'Error fetching transcription info after retries:', error);
      return {
        success: false,
        error: getUserFriendlyErrorMessage(error),
      };
    }
  }

  async getTranslationInfo(): Promise<{ success: boolean; data?: TranslationInfo; error?: string }> {
    const cacheKey = 'translation_info';
    const cached = CacheManager.get<TranslationInfo>(cacheKey);

    if (cached) {
      logger.info('API', 'Using cached translation info');
      return { success: true, data: cached };
    }

    if (!this.apiKey) {
      const error = 'API Key is required to fetch translation info';
      logger.error('API', error);
      return { success: false, error };
    }

    try {
      const result = await apiRequestWithRetry(async () => {
        logger.info('API', 'Fetching translation info from API...');

        const headers = {
          'Accept': 'application/json',
          'Api-Key': this.apiKey || '',
          'Content-Type': 'application/json',
          'User-Agent': getUserAgent(),
        };

        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }

        const [apisResponse, languagesResponse] = await Promise.all([
          fetch(this.getAIUrl('/info/translation_apis'), {
            method: 'POST',
            headers,
          }),
          fetch(this.getAIUrl('/info/translation_languages'), {
            method: 'POST',
            headers,
          }),
        ]);

        if (!apisResponse.ok) {
          const error = new Error(`APIs request failed: ${apisResponse.status} ${apisResponse.statusText}`);
          (error as any).status = apisResponse.status;
          (error as any).responseText = await apisResponse.text().catch(() => '');
          throw error;
        }
        if (!languagesResponse.ok) {
          const error = new Error(`Languages request failed: ${languagesResponse.status} ${languagesResponse.statusText}`);
          (error as any).status = languagesResponse.status;
          (error as any).responseText = await languagesResponse.text().catch(() => '');
          throw error;
        }

        const apisData = await apisResponse.json();
        const languagesData = await languagesResponse.json();

        logger.info('API', 'Translation APIs response', apisData);
        logger.info('API', 'Translation languages response', languagesData);

        const data: TranslationInfo = {
          apis: apisData.data || apisData,
          languages: languagesData.data || languagesData,
        };

        CacheManager.set(cacheKey, data);
        logger.info('API', 'Translation info cached successfully');

        return {
          success: true,
          data,
        };
      }, 'Get Translation Info', 3);

      return result;
    } catch (error: any) {
      logger.error('API', 'Error fetching translation info after retries:', error);
      return {
        success: false,
        error: getUserFriendlyErrorMessage(error),
      };
    }
  }

  async initiateTranscription(
    audioFile: File | string,
    options: TranscriptionOptions
  ): Promise<APIResponse> {
    try {
      logger.info('API', 'Initiating transcription', {
        fileType: typeof audioFile,
        fileName: typeof audioFile === 'string' ? audioFile.split('/').pop() : audioFile.name,
        api: options.api,
        language: options.language
      });

      // Clear recent media cache since we're creating new media
      CacheManager.remove('recent_media');

      return await apiRequestWithRetry(async () => {
        const formData = new FormData();

        if (typeof audioFile === 'string') {
          // Check if it's an extracted/converted audio file (temporary file)
          if (audioFile.includes('_converted.mp3') || audioFile.includes('_converted.wav')) {
            // Use the audio file reader for extracted/converted files
            const fileData = await window.electronAPI.readAudioFile(audioFile);
            const buffer = new Uint8Array(fileData.buffer);
            formData.append('file', new Blob([buffer]), fileData.fileName);
          } else {
            // Use the regular file reader for original files
            const fileData = await window.electronAPI.readFile(audioFile);
            const buffer = new Uint8Array(fileData.buffer);
            formData.append('file', new Blob([buffer]), fileData.fileName);
          }
        } else {
          formData.append('file', audioFile);
        }

        formData.append('language', options.language);
        formData.append('api', options.api);

        if (options.returnContent) {
          formData.append('return_content', 'true');
        }

        const headers: { [key: string]: string } = {
          'Api-Key': this.apiKey || '',
          'User-Agent': getUserAgent(),
        };

        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }

        // DO NOT set Content-Type for FormData - let browser set it automatically with boundary

        logger.info('API', 'Sending transcription request:', {
          url: this.getAIUrl('/transcribe'),
          headers: headers,
          language: options.language,
          api: options.api,
          returnContent: options.returnContent
        });

        const response = await fetch(this.getAIUrl('/transcribe'), {
          method: 'POST',
          headers,
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          logger.error('API', 'Transcription request failed:', {
            status: response.status,
            statusText: response.statusText,
            errorText: errorText,
            headers: Object.fromEntries(response.headers.entries())
          });


          // Create error with status for better categorization
          const error = new Error(`Request failed: ${response.status} ${response.statusText} - ${errorText}`);
          (error as any).status = response.status;
          (error as any).responseText = errorText;
          throw error;
        }

        return await response.json();
      }, 'Initiate Transcription', 3);
    } catch (error: any) {
      logger.error('API', 'Transcription initiation failed:', error);

      // Try to get more specific error details from response
      let errorMessage = error.message || 'Transcription failed';

      // If we have response text, try to parse it for more details
      if (error.responseText) {
        try {
          const parsed = JSON.parse(error.responseText);
          if (parsed.error) {
            errorMessage = parsed.error;
          } else if (parsed.message) {
            errorMessage = parsed.message;
          } else if (parsed.errors && Array.isArray(parsed.errors)) {
            errorMessage = parsed.errors.join(', ');
          }
        } catch (parseError) {
          // If parsing fails, use the original error message
          errorMessage = error.responseText || errorMessage;
        }
      }

      return {
        status: 'ERROR',
        errors: [errorMessage],
      };
    }
  }

  async initiateTranslation(
    subtitleFile: File | string,
    options: TranslationOptions
  ): Promise<APIResponse> {
    try {
      logger.info('API', 'Initiating translation', {
        fileType: typeof subtitleFile,
        fileName: typeof subtitleFile === 'string' ? subtitleFile.split('/').pop() : subtitleFile.name,
        api: options.api,
        sourceLanguage: options.source_language,
        targetLanguage: options.target_language
      });

      // Clear recent media cache since we're creating new media
      CacheManager.remove('recent_media');

      return await apiRequestWithRetry(async () => {
        const formData = new FormData();

        if (typeof subtitleFile === 'string') {
          const fileData = await window.electronAPI.readFile(subtitleFile);
          const buffer = new Uint8Array(fileData.buffer);
          formData.append('file', new Blob([buffer]), fileData.fileName);
        } else {
          formData.append('file', subtitleFile);
        }

        formData.append('translate_from', options.translateFrom);
        formData.append('translate_to', options.translateTo);
        formData.append('api', options.api);

        if (options.returnContent) {
          formData.append('return_content', 'true');
        }

        const headers = {
          'Accept': 'application/json',
          'Api-Key': this.apiKey || '',
          'User-Agent': getUserAgent(),
        };

        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(this.getAIUrl('/translate'), {
          method: 'POST',
          headers,
          body: formData,
        });

        if (!response.ok) {

          // Create error with status for better categorization
          const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
          (error as any).status = response.status;
          (error as any).responseText = await response.text().catch(() => '');
          throw error;
        }

        return await response.json();
      }, 'Initiate Translation', 3);
    } catch (error: any) {
      logger.error('API', 'Translation initiation failed:', error);

      // Try to get more specific error details from response
      let errorMessage = error.message || 'Translation failed';

      // If we have response text, try to parse it for more details
      if (error.responseText) {
        try {
          const parsed = JSON.parse(error.responseText);
          if (parsed.error) {
            errorMessage = parsed.error;
          } else if (parsed.message) {
            errorMessage = parsed.message;
          } else if (parsed.errors && Array.isArray(parsed.errors)) {
            errorMessage = parsed.errors.join(', ');
          }
        } catch (parseError) {
          // If parsing fails, use the original error message
          errorMessage = error.responseText || errorMessage;
        }
      }

      return {
        status: 'ERROR',
        errors: [errorMessage],
      };
    }
  }

  async checkTranscriptionStatus(correlationId: string): Promise<APIResponse<CompletedTaskData>> {
    try {
      logger.info('API', 'Checking transcription status', { correlationId });
      return await apiRequestWithRetry(async () => {
        const headers = {
          'Accept': 'application/json',
          'Api-Key': this.apiKey || '',
          'Content-Type': 'application/json',
          'User-Agent': getUserAgent(),
        };
        
        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        const response = await fetch(this.getAIUrl(`/transcribe/${correlationId}`), {
          method: 'POST',
          headers,
        });
        
        if (!response.ok) {
          const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
          (error as any).status = response.status;
          throw error;
        }
        
        return await response.json();
      }, `Check Transcription Status (${correlationId})`);
    } catch (error: any) {
      return {
        status: 'ERROR',
        errors: [error.message || 'Failed to check transcription status'],
      };
    }
  }

  async checkTranslationStatus(correlationId: string): Promise<APIResponse<CompletedTaskData>> {
    try {
      logger.info('API', 'Checking translation status', { correlationId });
      return await apiRequestWithRetry(async () => {
        const headers = {
          'Accept': 'application/json',
          'Api-Key': this.apiKey || '',
          'Content-Type': 'application/json',
          'User-Agent': getUserAgent(),
        };
        
        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        const response = await fetch(this.getAIUrl(`/translation/${correlationId}`), {
          method: 'POST',
          headers,
        });
        
        if (!response.ok) {
          const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
          (error as any).status = response.status;
          throw error;
        }
        
        return await response.json();
      }, `Check Translation Status (${correlationId})`);
    } catch (error: any) {
      return {
        status: 'ERROR',
        errors: [error.message || 'Failed to check translation status'],
      };
    }
  }

  async detectLanguage(file: File | string, duration?: number): Promise<APIResponse<LanguageDetectionResult>> {
    try {
      return await apiRequestWithRetry(async () => {
        const formData = new FormData();

        // Follow the exact pattern from detect_Language_initial.sh: --form "file=@$FILE"
        if (typeof file === 'string') {
          const fileData = await window.electronAPI.readFile(file);
          const buffer = new Uint8Array(fileData.buffer);
          formData.append('file', new Blob([buffer]), fileData.fileName);
        } else {
          formData.append('file', file);
        }

        // Add duration parameter if provided
        if (duration) {
          formData.append('duration', duration.toString());
        }

        const headers = {
          'Api-Key': this.apiKey || '',
          'User-Agent': getUserAgent(),
        };

        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }

        logger.info('API', 'Initiating language detection', {
          fileType: typeof file,
          fileName: typeof file === 'string' ? file : file.name
        });

        const response = await fetch(this.getAIUrl('/detect_language'), {
          method: 'POST',
          headers,
          body: formData,
        });

        if (!response.ok) {
          const errorBody = await response.text();
          logger.error('API', 'Language detection failed', {
            status: response.status,
            statusText: response.statusText,
            body: errorBody
          });


          // Create error with status for better categorization
          const error = new Error(`Request failed: ${response.status} ${response.statusText} - ${errorBody}`);
          (error as any).status = response.status;
          (error as any).responseText = errorBody;
          throw error;
        }

        const data = await response.json();
        logger.info('API', 'Language detection response received', data);
        return data;
      }, 'Detect Language', 3);
    } catch (error: any) {
      logger.error('API', 'Language detection error after retries:', error);

      // Try to get more specific error details from response
      let errorMessage = error.message || 'Language detection failed';

      // If we have response text, try to parse it for more details
      if (error.responseText) {
        try {
          const parsed = JSON.parse(error.responseText);
          if (parsed.error) {
            errorMessage = parsed.error;
          } else if (parsed.message) {
            errorMessage = parsed.message;
          } else if (parsed.errors && Array.isArray(parsed.errors)) {
            errorMessage = parsed.errors.join(', ');
          }
        } catch (parseError) {
          // If parsing fails, use the original error message
          errorMessage = error.responseText || errorMessage;
        }
      }

      return {
        status: 'ERROR',
        errors: [errorMessage],
      };
    }
  }

  async checkLanguageDetectionStatus(correlationId: string): Promise<APIResponse<LanguageDetectionResult>> {
    try {
      return await apiRequestWithRetry(async () => {
        const headers = {
          'Accept': 'application/json',
          'Api-Key': this.apiKey || '',
          'Content-Type': 'application/json',
          'User-Agent': getUserAgent(),
        };

        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }

        logger.info('API', `Checking language detection status for correlation ID: ${correlationId}`);

        const response = await fetch(this.getAIUrl(`/detectLanguage/${correlationId}`), {
          method: 'POST',
          headers,
        });

        if (!response.ok) {

          // Create error with status for better categorization
          const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
          (error as any).status = response.status;
          (error as any).responseText = await response.text().catch(() => '');
          throw error;
        }

        const data = await response.json();
        logger.info('API', 'Language detection status response', data);
        return data;
      }, `Check Language Detection Status (${correlationId})`);
    } catch (error: any) {
      logger.error('API', 'Language detection status check error:', error);

      // Try to get more specific error details from response
      let errorMessage = error.message || 'Language detection status check failed';

      // If we have response text, try to parse it for more details
      if (error.responseText) {
        try {
          const parsed = JSON.parse(error.responseText);
          if (parsed.error) {
            errorMessage = parsed.error;
          } else if (parsed.message) {
            errorMessage = parsed.message;
          } else if (parsed.errors && Array.isArray(parsed.errors)) {
            errorMessage = parsed.errors.join(', ');
          }
        } catch (parseError) {
          // If parsing fails, use the original error message
          errorMessage = error.responseText || errorMessage;
        }
      }

      return {
        status: 'ERROR',
        errors: [errorMessage],
      };
    }
  }

  async getTranscriptionLanguagesForApi(apiId: string): Promise<{ success: boolean; data?: LanguageInfo[]; error?: string }> {
    const cacheKey = `transcription_languages_${apiId}`;
    const cached = CacheManager.get<LanguageInfo[]>(cacheKey);
    
    if (cached) {
      return { success: true, data: cached };
    }

    try {
      const result = await apiRequestWithRetry(async () => {
        const headers = {
          'Accept': 'application/json',
          'Api-Key': this.apiKey || '',
          'Content-Type': 'application/json',
          'User-Agent': getUserAgent(),
        };

        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(this.getAIUrl('/info/transcription_languages'), {
          method: 'POST',
          headers,
          body: JSON.stringify({ api: apiId }),
        });

        if (!response.ok) {

          // Create error with status for better categorization
          const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
          (error as any).status = response.status;
          (error as any).responseText = await response.text().catch(() => '');
          throw error;
        }

        const data: LanguageInfo[] = await response.json();

        CacheManager.set(cacheKey, data);

        return {
          success: true,
          data,
        };
      }, `Get Transcription Languages for API (${apiId})`, 3);

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: getUserFriendlyErrorMessage(error),
      };
    }
  }

  async getTranslationLanguagesForApi(apiId: string): Promise<{ success: boolean; data?: LanguageInfo[]; error?: string }> {
    const cacheKey = `translation_languages_${apiId}`;
    const cached = CacheManager.get<LanguageInfo[]>(cacheKey);
    
    if (cached) {
      return { success: true, data: cached };
    }

    try {
      const result = await apiRequestWithRetry(async () => {
        const headers = {
          'Accept': 'application/json',
          'Api-Key': this.apiKey || '',
          'Content-Type': 'application/json',
          'User-Agent': getUserAgent(),
        };

        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }

        logger.info('API', `Fetching translation languages for API: ${apiId}`);

        const response = await fetch(this.getAIUrl('/info/translation_languages'), {
          method: 'POST',
          headers,
          body: JSON.stringify({ api: apiId }),
        });

        if (!response.ok) {

          // Create error with status for better categorization
          const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
          (error as any).status = response.status;
          (error as any).responseText = await response.text().catch(() => '');
          throw error;
        }

        const responseData = await response.json();
        logger.info('API', `Translation languages response for ${apiId}:`, responseData);

        let data: LanguageInfo[] = [];

        // Handle different response structures
        if (responseData.data) {
          // If response has a data property, check if it's grouped by API or a direct array
          if (typeof responseData.data === 'object' && !Array.isArray(responseData.data)) {
            // It's grouped by API, extract the specific API's languages
            data = responseData.data[apiId] || [];
          } else if (Array.isArray(responseData.data)) {
            // It's a direct array
            data = responseData.data;
          }
        } else if (typeof responseData === 'object' && !Array.isArray(responseData)) {
          // Response is grouped by API at the root level
          data = responseData[apiId] || [];
        } else if (Array.isArray(responseData)) {
          // Response is a direct array
          data = responseData;
        }

        logger.info('API', `Processed ${data.length} languages for API ${apiId}`);

        CacheManager.set(cacheKey, data);

        return {
          success: true,
          data,
        };
      }, `Get Translation Languages for API (${apiId})`, 3);

      return result;
    } catch (error: any) {
      logger.error('API', `Error fetching translation languages for ${apiId} after retries:`, error);
      return {
        success: false,
        error: getUserFriendlyErrorMessage(error),
      };
    }
  }

  async getTranslationApisForLanguage(sourceLanguage: string, targetLanguage: string): Promise<{ success: boolean; data?: string[]; error?: string }> {
    const cacheKey = `translation_apis_${sourceLanguage}_${targetLanguage}`;
    const cached = CacheManager.get<string[]>(cacheKey);
    
    if (cached) {
      return { success: true, data: cached };
    }

    try {
      const result = await apiRequestWithRetry(async () => {
        // For now, we'll get all APIs and filter client-side
        // In the future, the API might support filtering by language pair
        const headers = {
          'Accept': 'application/json',
          'Api-Key': this.apiKey || '',
          'Content-Type': 'application/json',
          'User-Agent': getUserAgent(),
        };

        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(this.getAIUrl('/info/translation_apis'), {
          method: 'POST',
          headers,
        });

        if (!response.ok) {

          // Create error with status for better categorization
          const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
          (error as any).status = response.status;
          (error as any).responseText = await response.text().catch(() => '');
          throw error;
        }

        const responseData = await response.json();
        const allApis: string[] = responseData.data || responseData;

        // TODO: Implement proper filtering based on language support
        // For now, return all APIs (this should be improved with actual API filtering)
        CacheManager.set(cacheKey, allApis);

        return {
          success: true,
          data: allApis,
        };
      }, `Get Translation APIs for Language Pair (${sourceLanguage}-${targetLanguage})`, 3);

      return result;
    } catch (error: any) {
      return {
        success: false,
        error: getUserFriendlyErrorMessage(error),
      };
    }
  }

  async downloadFile(url: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const result = await apiRequestWithRetry(async () => {
        const headers = {
          'Accept': 'application/json',
          'Api-Key': this.apiKey || '',
          'User-Agent': getUserAgent(),
        };

        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(url, {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
          (error as any).status = response.status;
          (error as any).responseText = await response.text().catch(() => '');
          throw error;
        }

        return await response.text();
      }, 'Download File', 3);

      return {
        success: true,
        content: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: getUserFriendlyErrorMessage(error),
      };
    }
  }

  async getCredits(): Promise<{ success: boolean; credits?: number; error?: string }> {
    try {
      const result = await apiRequestWithRetry(async () => {
        const headers = {
          'Accept': 'application/json',
          'Api-Key': this.apiKey || '',
          'Content-Type': 'application/json',
          'User-Agent': getUserAgent(),
        };
        
        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        const response = await fetch(this.getAIUrl('/credits'), {
          method: 'POST',
          headers,
        });
        
        if (!response.ok) {
          
          // Create error with status for better categorization
          const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
          (error as any).status = response.status;
          (error as any).responseText = await response.text().catch(() => '');
          throw error;
        }
        
        const responseData = await response.json();
        logger.info('API', 'Credits response:', responseData);
        
        return {
          success: true,
          credits: responseData.data?.credits || responseData.credits || 0,
        };
      }, 'Get Credits', 3);
      
      return result;
    } catch (error: any) {
      logger.error('API', 'Error fetching credits after retries:', error);
      return {
        success: false,
        error: getUserFriendlyErrorMessage(error),
      };
    }
  }

  async getServicesInfo(): Promise<{ success: boolean; data?: ServicesInfo; error?: string }> {
    const cacheKey = 'services_info';
    const cached = CacheManager.get<ServicesInfo>(cacheKey);
    
    if (cached) {
      logger.info('API', 'Using cached services info');
      return { success: true, data: cached };
    }

    if (!this.apiKey) {
      const error = 'API Key is required to fetch services info';
      logger.error('API', error);
      return { success: false, error };
    }

    try {
      const result = await apiRequestWithRetry(async () => {
        logger.info('API', 'Fetching services info from API...');
        
        const headers = {
          'Accept': 'application/json',
          'Api-Key': this.apiKey || '',
          'Content-Type': 'application/json',
          'User-Agent': getUserAgent(),
        };
        
        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        const response = await fetch(this.getAIUrl('/info/services'), {
          method: 'GET',
          headers,
        });
        
        if (!response.ok) {
          
          const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
          (error as any).status = response.status;
          (error as any).responseText = await response.text().catch(() => '');
          throw error;
        }
        
        const responseData = await response.json();
        logger.info('API', 'Services info response:', responseData);
        
        const data: ServicesInfo = responseData.data || responseData;
        
        CacheManager.set(cacheKey, data);
        logger.info('API', 'Services info cached successfully');

        return {
          success: true,
          data,
        };
      }, 'Get Services Info', 3);
      
      return result;
    } catch (error: any) {
      logger.error('API', 'Error fetching services info after retries:', error);
      return {
        success: false,
        error: getUserFriendlyErrorMessage(error),
      };
    }
  }

  async getCreditPackages(email?: string): Promise<{ success: boolean; data?: CreditPackage[]; error?: string }> {
    const cacheKey = `credit_packages_${email || 'default'}`;
    const cached = CacheManager.get<CreditPackage[]>(cacheKey);

    if (cached) {
      logger.info('API', 'Using cached credit packages');
      return { success: true, data: cached };
    }

    try {
      logger.info('API', 'Fetching credit packages');
      const result = await apiRequestWithRetry(async () => {
        const headers = {
          'Accept': 'application/json',
          'Api-Key': this.apiKey || '',
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': getUserAgent(),
        };
        
        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }
        
        const body = new URLSearchParams();
        if (email) {
          body.append('email', email);
        }
        
        const response = await fetch(this.getAIUrl('/credits/buy'), {
          method: 'POST',
          headers,
          body: body.toString()
        });
        
        if (!response.ok) {
          
          const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
          (error as any).status = response.status;
          (error as any).responseText = await response.text().catch(() => '');
          throw error;
        }
        
        const responseData = await response.json();
        logger.info('API', 'Credit packages response:', responseData);
        
        if (responseData.data && Array.isArray(responseData.data)) {
          const data = responseData.data;
          // Cache the credit packages data
          CacheManager.set(cacheKey, data);
          logger.info('API', 'Credit packages cached successfully');

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
      logger.error('API', 'Error fetching credit packages after retries:', error);
      return {
        success: false,
        error: getUserFriendlyErrorMessage(error),
      };
    }
  }

  async getRecentMedia(): Promise<{ success: boolean; data?: RecentMediaItem[]; error?: string }> {
    const cacheKey = 'recent_media';
    const cached = CacheManager.get<RecentMediaItem[]>(cacheKey);

    if (cached) {
      logger.info('API', 'Using cached recent media data');
      return { success: true, data: cached };
    }

    if (!this.apiKey) {
      const error = 'API Key is required to fetch recent media';
      logger.error('API', error);
      return { success: false, error };
    }

    try {
      const result = await apiRequestWithRetry(async () => {
        logger.info('API', 'Fetching recent media from API...');

        const headers = {
          'Accept': 'application/json',
          'Api-Key': this.apiKey || '',
          'Content-Type': 'application/json',
          'User-Agent': getUserAgent(),
        };

        if (this.token) {
          headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(this.getAIUrl('/recent_media'), {
          method: 'POST',
          headers,
        });

        if (!response.ok) {
          const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
          (error as any).status = response.status;
          (error as any).responseText = await response.text().catch(() => '');
          throw error;
        }

        const responseData = await response.json();
        logger.info('API', 'Recent media response:', responseData);

        const data: RecentMediaItem[] = responseData.data || responseData;

        CacheManager.set(cacheKey, data);
        logger.info('API', 'Recent media cached successfully');

        return {
          success: true,
          data,
        };
      }, 'Get Recent Media', 3);

      return result;
    } catch (error: any) {
      logger.error('API', 'Error fetching recent media after retries:', error);
      return {
        success: false,
        error: getUserFriendlyErrorMessage(error),
      };
    }
  }

  clearCache(): void {
    CacheManager.clear();
  }
}