import CacheManager from '../cache';
import { logger } from '../../utils/errorLogger';
import { apiRequestWithRetry, getUserFriendlyErrorMessage } from '../../utils/networkUtils';
import { rethrowIfAuthError, getUserAgent, parseJsonResponse } from './helpers';
import { ApiState, TranscriptionInfo, TranscriptionOptions, APIResponse, CompletedTaskData, LanguageInfo } from './types';

export async function getTranscriptionInfo(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
): Promise<{ success: boolean; data?: TranscriptionInfo; error?: string }> {
  const cacheKey = 'transcription_info';
  const cached = CacheManager.get<TranscriptionInfo>(cacheKey);

  if (cached) {
    logger.debug(2, 'API', 'Using cached transcription info');
    return { success: true, data: cached };
  }

  if (!state.apiKey) {
    const error = 'API Key is required to fetch transcription info';
    logger.error('API', error);
    return { success: false, error };
  }

  try {
    const result = await apiRequestWithRetry(async () => {
      logger.debug(2, 'API', 'Fetching transcription info from API...');

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Api-Key': state.apiKey || '',
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
      };

      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }

      const betaParam = state.betaTest ? '?beta=true' : '';
      const [apisResponse, languagesResponse] = await Promise.all([
        fetch(getAIUrl(`/info/transcription_apis${betaParam}`), {
          method: 'POST',
          headers,
        }),
        fetch(getAIUrl(`/info/transcription_languages${betaParam}`), {
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

      logger.debug(3, 'API', 'Transcription APIs response', apisData);
      logger.debug(3, 'API', 'Transcription languages response', languagesData);

      const data: TranscriptionInfo = {
        apis: apisData.data || apisData,
        languages: languagesData.data || languagesData,
      };

      CacheManager.set(cacheKey, data);
      logger.debug(2, 'API', 'Transcription info cached successfully');

      return {
        success: true,
        data,
      };
    }, 'Get Transcription Info', 3);

    return result;
  } catch (error: any) {
    rethrowIfAuthError(error);
    logger.error('API', 'Error fetching transcription info after retries:', error);
    return {
      success: false,
      error: getUserFriendlyErrorMessage(error),
    };
  }
}

export async function initiateTranscription(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
  audioFile: File | string,
  options: TranscriptionOptions,
): Promise<APIResponse> {
  try {
    logger.info('API', 'Initiating transcription', {
      fileType: typeof audioFile,
      fileName: typeof audioFile === 'string' ? audioFile.split(/[\\/]/).pop() : audioFile.name,
      api: options.api,
      language: options.language,
    });

    CacheManager.removeByPrefix('recent_media');
    CacheManager.removeByPrefix('recent_activities');

    return await apiRequestWithRetry(async () => {
      const formData = new FormData();

      if (typeof audioFile === 'string') {
        if (audioFile.includes('_converted.mp3') || audioFile.includes('_converted.wav')) {
          const fileData = await window.electronAPI.readAudioFile(audioFile);
          const buffer = new Uint8Array(fileData.buffer);
          formData.append('file', new Blob([buffer]), fileData.fileName);
        } else {
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
        'Api-Key': state.apiKey || '',
        'User-Agent': getUserAgent(),
      };

      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }

      logger.debug(2, 'API', 'Sending transcription request:', {
        url: getAIUrl('/transcribe'),
        headers: headers,
        language: options.language,
        api: options.api,
        returnContent: options.returnContent,
      });

      const response = await fetch(getAIUrl(`/transcribe${state.betaTest ? '?beta=true' : ''}`), {
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
          headers: Object.fromEntries(response.headers.entries()),
        });

        const error = new Error(`Request failed: ${response.status} ${response.statusText} - ${errorText}`);
        (error as any).status = response.status;
        (error as any).responseText = errorText;
        throw error;
      }

      return await parseJsonResponse(response);
    }, 'Initiate Transcription', 3);
  } catch (error: any) {
    rethrowIfAuthError(error);
    logger.error('API', 'Transcription initiation failed:', error);

    let errorMessage = error.message || 'Transcription failed';

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

export async function checkTranscriptionStatus(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
  correlationId: string,
): Promise<APIResponse<CompletedTaskData>> {
  try {
    logger.debug(2, 'API', 'Checking transcription status', { correlationId });
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

      const response = await fetch(getAIUrl(`/transcribe/${correlationId}${state.betaTest ? '?beta=true' : ''}`), {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
        (error as any).status = response.status;
        throw error;
      }

      return await parseJsonResponse(response);
    }, `Check Transcription Status (${correlationId})`);
  } catch (error: any) {
    rethrowIfAuthError(error);
    return {
      status: 'ERROR',
      errors: [error.message || 'Failed to check transcription status'],
    };
  }
}

export async function getTranscriptionLanguagesForApi(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
  apiId: string,
): Promise<{ success: boolean; data?: LanguageInfo[]; error?: string }> {
  const cacheKey = `transcription_languages_${apiId}`;
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

      const response = await fetch(getAIUrl(`/info/transcription_languages${state.betaTest ? '?beta=true' : ''}`), {
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

      const data: LanguageInfo[] = await parseJsonResponse(response);

      CacheManager.set(cacheKey, data);

      return {
        success: true,
        data,
      };
    }, `Get Transcription Languages for API (${apiId})`, 3);

    return result;
  } catch (error: any) {
    rethrowIfAuthError(error);
    return {
      success: false,
      error: getUserFriendlyErrorMessage(error),
    };
  }
}
