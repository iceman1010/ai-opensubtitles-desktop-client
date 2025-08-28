import CacheManager from './cache';
import { logger } from '../utils/errorLogger';
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

export class OpenSubtitlesAPI {
  private baseURL = 'https://api.opensubtitles.com/api/v1/ai';
  private apiKey: string = '';
  private token: string = '';

  constructor(apiKey?: string) {
    if (apiKey) {
      this.setApiKey(apiKey);
    }
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

  private async handleAuthError(): Promise<void> {
    logger.warn('API', 'Authentication error detected, clearing cached token');
    await this.clearCachedToken();
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
      const userAgent = getUserAgent();
      logger.info('API', `Attempting login with username: ${username}`);
      logger.info('API', `Using User-Agent: ${userAgent}`);
      logger.info('API', `Using API Key: ${this.apiKey ? 'SET' : 'NOT SET'}`);
      logger.info('API', `App config object:`, appConfig);
      
      const headers = {
        'Accept': 'application/json',
        'Api-Key': this.apiKey || '',
        'Content-Type': 'application/json',
        'User-Agent': userAgent,
      };
      
      logger.info('API', `Request headers:`, headers);
      
      // Use the main API login endpoint, not the /ai one
      const response = await fetch('https://api.opensubtitles.com/api/v1/login', {
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
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText} - ${errorText}`,
        };
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
      return { success: false, error: 'No token received' };
    } catch (error: any) {
      logger.error('API', 'Login error', {
        error: error.message,
      });
      return {
        success: false,
        error: error.message || 'Login failed',
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
        fetch(`${this.baseURL}/info/transcription_apis`, {
          method: 'POST',
          headers,
        }),
        fetch(`${this.baseURL}/info/transcription_languages`, {
          method: 'POST',
          headers,
        }),
      ]);
      
      if (!apisResponse.ok) {
        if (apisResponse.status === 401 || apisResponse.status === 403) {
          await this.handleAuthError();
        }
        throw new Error(`APIs request failed: ${apisResponse.status} ${apisResponse.statusText}`);
      }
      if (!languagesResponse.ok) {
        if (languagesResponse.status === 401 || languagesResponse.status === 403) {
          await this.handleAuthError();
        }
        throw new Error(`Languages request failed: ${languagesResponse.status} ${languagesResponse.statusText}`);
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
    } catch (error: any) {
      logger.error('API', 'Error fetching transcription info', {
        error: error.message,
      });
      return {
        success: false,
        error: error.message || 'Failed to get transcription info',
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
        fetch(`${this.baseURL}/info/translation_apis`, {
          method: 'POST',
          headers,
        }),
        fetch(`${this.baseURL}/info/translation_languages`, {
          method: 'POST',
          headers,
        }),
      ]);
      
      if (!apisResponse.ok) {
        throw new Error(`APIs request failed: ${apisResponse.status} ${apisResponse.statusText}`);
      }
      if (!languagesResponse.ok) {
        throw new Error(`Languages request failed: ${languagesResponse.status} ${languagesResponse.statusText}`);
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
    } catch (error: any) {
      logger.error('API', 'Error fetching translation info', {
        error: error.message,
      });
      return {
        success: false,
        error: error.message || 'Failed to get translation info',
      };
    }
  }

  async initiateTranscription(
    audioFile: File | string,
    options: TranscriptionOptions
  ): Promise<APIResponse> {
    try {
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
        url: `${this.baseURL}/transcribe`,
        headers: headers,
        language: options.language,
        api: options.api,
        returnContent: options.returnContent
      });

      const response = await fetch(`${this.baseURL}/transcribe`, {
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
        
        if (response.status === 401 || response.status === 403) {
          await this.handleAuthError();
        }
        throw new Error(`Request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error: any) {
      return {
        status: 'ERROR',
        errors: [error.message || 'Transcription initiation failed'],
      };
    }
  }

  async initiateTranslation(
    subtitleFile: File | string,
    options: TranslationOptions
  ): Promise<APIResponse> {
    try {
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

      const response = await fetch(`${this.baseURL}/translate`, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          await this.handleAuthError();
        }
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }

      return await response.json();
    } catch (error: any) {
      return {
        status: 'ERROR',
        errors: [error.message || 'Translation initiation failed'],
      };
    }
  }

  async checkTranscriptionStatus(correlationId: string): Promise<APIResponse<CompletedTaskData>> {
    try {
      const headers = {
        'Accept': 'application/json',
        'Api-Key': this.apiKey || '',
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
      };
      
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      
      const response = await fetch(`${this.baseURL}/transcribe/${correlationId}`, {
        method: 'POST',
        headers,
      });
      
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error: any) {
      return {
        status: 'ERROR',
        errors: [error.message || 'Failed to check transcription status'],
      };
    }
  }

  async checkTranslationStatus(correlationId: string): Promise<APIResponse<CompletedTaskData>> {
    try {
      const headers = {
        'Accept': 'application/json',
        'Api-Key': this.apiKey || '',
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
      };
      
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      
      const response = await fetch(`${this.baseURL}/translation/${correlationId}`, {
        method: 'POST',
        headers,
      });
      
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error: any) {
      return {
        status: 'ERROR',
        errors: [error.message || 'Failed to check translation status'],
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
      const headers = {
        'Accept': 'application/json',
        'Api-Key': this.apiKey || '',
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
      };
      
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      
      const response = await fetch(`${this.baseURL}/info/transcription_languages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ api: apiId }),
      });
      
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }
      
      const data: LanguageInfo[] = await response.json();
      
      CacheManager.set(cacheKey, data);

      return {
        success: true,
        data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to get transcription languages',
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
      
      const response = await fetch(`${this.baseURL}/info/translation_languages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ api: apiId }),
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          await this.handleAuthError();
        }
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
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
    } catch (error: any) {
      logger.error('API', `Error fetching translation languages for ${apiId}:`, error);
      return {
        success: false,
        error: error.message || 'Failed to get translation languages',
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
      
      const response = await fetch(`${this.baseURL}/info/translation_apis`, {
        method: 'POST',
        headers,
      });
      
      if (!response.ok) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
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
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Failed to get translation APIs',
      };
    }
  }

  async downloadFile(url: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
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
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }
      
      const content = await response.text();
      
      return {
        success: true,
        content,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Download failed',
      };
    }
  }

  async getCredits(): Promise<{ success: boolean; credits?: number; error?: string }> {
    try {
      const headers = {
        'Accept': 'application/json',
        'Api-Key': this.apiKey || '',
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
      };
      
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      
      const response = await fetch(`${this.baseURL}/credits`, {
        method: 'POST',
        headers,
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          await this.handleAuthError();
        }
        throw new Error(`Request failed: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      logger.info('API', 'Credits response:', responseData);
      
      return {
        success: true,
        credits: responseData.data?.credits || responseData.credits || 0,
      };
    } catch (error: any) {
      logger.error('API', 'Error fetching credits:', error);
      return {
        success: false,
        error: error.message || 'Failed to get credits',
      };
    }
  }

  clearCache(): void {
    CacheManager.clear();
  }
}