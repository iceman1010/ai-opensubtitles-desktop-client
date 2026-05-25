import CacheManager from '../cache';
import { logger } from '../../utils/errorLogger';
import { apiRequestWithRetry, getUserFriendlyErrorMessage } from '../../utils/networkUtils';
import { rethrowIfAuthError, getUserAgent, parseJsonResponse } from './helpers';
import { ApiState, TranslationInfo, TranslationOptions, APIResponse, CompletedTaskData, LanguageInfo } from './types';

export async function getTranslationInfo(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
): Promise<{ success: boolean; data?: TranslationInfo; error?: string }> {
  const cacheKey = 'translation_info';
  const cached = CacheManager.get<TranslationInfo>(cacheKey);

  if (cached) {
    logger.debug(2, 'API', 'Using cached translation info');
    return { success: true, data: cached };
  }

  if (!state.apiKey) {
    const error = 'API Key is required to fetch translation info';
    logger.error('API', error);
    return { success: false, error };
  }

  try {
    const result = await apiRequestWithRetry(async () => {
      logger.debug(2, 'API', 'Fetching translation info from API...');

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Api-Key': state.apiKey || '',
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
      };

      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }

      const [apisResponse, languagesResponse] = await Promise.all([
        fetch(getAIUrl('/info/translation_apis'), {
          method: 'POST',
          headers,
        }),
        fetch(getAIUrl('/info/translation_languages'), {
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

      logger.debug(3, 'API', 'Translation APIs response', apisData);
      logger.debug(3, 'API', 'Translation languages response', languagesData);

      const data: TranslationInfo = {
        apis: apisData.data || apisData,
        languages: languagesData.data || languagesData,
      };

      CacheManager.set(cacheKey, data);
      logger.debug(2, 'API', 'Translation info cached successfully');

      return {
        success: true,
        data,
      };
    }, 'Get Translation Info', 3);

    return result;
  } catch (error: any) {
    rethrowIfAuthError(error);
    logger.error('API', 'Error fetching translation info after retries:', error);
    return {
      success: false,
      error: getUserFriendlyErrorMessage(error),
    };
  }
}

export async function initiateTranslation(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
  subtitleFile: File | string,
  options: TranslationOptions,
): Promise<APIResponse> {
  try {
    logger.info('API', 'Initiating translation', {
      fileType: typeof subtitleFile,
      fileName: typeof subtitleFile === 'string' ? subtitleFile.split(/[\\/]/).pop() : subtitleFile.name,
      api: options.api,
      translateFrom: options.translateFrom,
      translateTo: options.translateTo,
    });

    CacheManager.removeByPrefix('recent_media');
    CacheManager.removeByPrefix('recent_activities');

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

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Api-Key': state.apiKey || '',
        'User-Agent': getUserAgent(),
      };

      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }

      const response = await fetch(getAIUrl('/translate'), {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).responseText = await response.text().catch(() => '');
        throw error;
      }

      return await parseJsonResponse(response);
    }, 'Initiate Translation', 3);
  } catch (error: any) {
    rethrowIfAuthError(error);
    logger.error('API', 'Translation initiation failed:', error);

    let errorMessage = error.message || 'Translation failed';

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
        errorMessage = error.responseText || errorMessage;
      }
    }

    return {
      status: 'ERROR',
      errors: [errorMessage],
    };
  }
}

export async function checkTranslationStatus(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
  correlationId: string,
): Promise<APIResponse<CompletedTaskData>> {
  try {
    logger.debug(2, 'API', 'Checking translation status', { correlationId });
    return await apiRequestWithRetry(async () => {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Api-Key': state.apiKey || '',
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
      };

      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }

      const response = await fetch(getAIUrl(`/translation/${correlationId}`), {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
        (error as any).status = response.status;
        throw error;
      }

      return await parseJsonResponse(response);
    }, `Check Translation Status (${correlationId})`);
  } catch (error: any) {
    rethrowIfAuthError(error);
    return {
      status: 'ERROR',
      errors: [error.message || 'Failed to check translation status'],
    };
  }
}

export async function getTranslationLanguagesForApi(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
  apiId: string,
): Promise<{ success: boolean; data?: LanguageInfo[]; error?: string }> {
  const cacheKey = `translation_languages_${apiId}`;
  const cached = CacheManager.get<LanguageInfo[]>(cacheKey);

  if (cached) {
    return { success: true, data: cached };
  }

  try {
    const result = await apiRequestWithRetry(async () => {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Api-Key': state.apiKey || '',
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
      };

      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }

      logger.debug(2, 'API', `Fetching translation languages for API: ${apiId}`);

      const response = await fetch(getAIUrl('/info/translation_languages'), {
        method: 'POST',
        headers,
        body: JSON.stringify({ api: apiId }),
      });

      if (!response.ok) {
        const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).responseText = await response.text().catch(() => '');
        throw error;
      }

      const responseData = await parseJsonResponse(response);
      logger.debug(3, 'API', `Translation languages response for ${apiId}:`, responseData);

      let data: LanguageInfo[] = [];

      if (responseData.data) {
        if (typeof responseData.data === 'object' && !Array.isArray(responseData.data)) {
          data = responseData.data[apiId] || [];
        } else if (Array.isArray(responseData.data)) {
          data = responseData.data;
        }
      } else if (typeof responseData === 'object' && !Array.isArray(responseData)) {
        data = responseData[apiId] || [];
      } else if (Array.isArray(responseData)) {
        data = responseData;
      }

      logger.debug(2, 'API', `Processed ${data.length} languages for API ${apiId}`);

      CacheManager.set(cacheKey, data);

      return {
        success: true,
        data,
      };
    }, `Get Translation Languages for API (${apiId})`, 3);

    return result;
  } catch (error: any) {
    rethrowIfAuthError(error);
    logger.error('API', `Error fetching translation languages for ${apiId} after retries:`, error);
    return {
      success: false,
      error: getUserFriendlyErrorMessage(error),
    };
  }
}

export async function getTranslationApisForLanguage(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<{ success: boolean; data?: string[]; error?: string }> {
  const cacheKey = `translation_apis_${sourceLanguage}_${targetLanguage}`;
  const cached = CacheManager.get<string[]>(cacheKey);

  if (cached) {
    return { success: true, data: cached };
  }

  try {
    const result = await apiRequestWithRetry(async () => {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Api-Key': state.apiKey || '',
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
      };

      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }

      const response = await fetch(getAIUrl('/info/translation_apis'), {
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
      const allApis: string[] = responseData.data || responseData;

      CacheManager.set(cacheKey, allApis);

      return {
        success: true,
        data: allApis,
      };
    }, `Get Translation APIs for Language Pair (${sourceLanguage}-${targetLanguage})`, 3);

    return result;
  } catch (error: any) {
    rethrowIfAuthError(error);
    return {
      success: false,
      error: getUserFriendlyErrorMessage(error),
    };
  }
}
