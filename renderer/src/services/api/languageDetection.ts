import { logger } from '../../utils/errorLogger';
import { apiRequestWithRetry } from '../../utils/networkUtils';
import { rethrowIfAuthError, getUserAgent, parseJsonResponse, parseErrorResponse } from './helpers';
import { ApiState, APIResponse, LanguageDetectionResult } from './types';

export async function detectLanguage(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
  file: File | string,
  duration?: number,
): Promise<APIResponse<LanguageDetectionResult>> {
  try {
    return await apiRequestWithRetry(async () => {
      const formData = new FormData();

      if (typeof file === 'string') {
        const fileData = await window.electronAPI.readFile(file);
        const buffer = new Uint8Array(fileData.buffer);
        formData.append('file', new Blob([buffer]), fileData.fileName);
      } else {
        formData.append('file', file);
      }

      if (duration) {
        formData.append('duration', duration.toString());
      }

      const headers: Record<string, string> = {
        'Api-Key': state.apiKey || '',
        'User-Agent': getUserAgent(),
      };

      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }

      logger.info('API', 'Initiating language detection', {
        fileType: typeof file,
        fileName: typeof file === 'string' ? file : file.name,
      });

      const response = await fetch(getAIUrl('/detect_language'), {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        const errorBody = await response.text();
        logger.error('API', 'Language detection failed', {
          status: response.status,
          statusText: response.statusText,
          body: errorBody,
        });

        const error = new Error(`Request failed: ${response.status} ${response.statusText} - ${errorBody}`);
        (error as any).status = response.status;
        (error as any).responseText = errorBody;
        throw error;
      }

      const data = await parseJsonResponse(response);
      logger.debug(3, 'API', 'Language detection response received', data);
      return data;
    }, 'Detect Language', 3);
  } catch (error: any) {
    rethrowIfAuthError(error);
    logger.error('API', 'Language detection error after retries:', error);

    return {
      status: 'ERROR',
      errors: [parseErrorResponse(error)],
    };
  }
}

export async function checkLanguageDetectionStatus(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
  correlationId: string,
): Promise<APIResponse<LanguageDetectionResult>> {
  try {
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

      logger.debug(2, 'API', `Checking language detection status for correlation ID: ${correlationId}`);

      const response = await fetch(getAIUrl(`/detectLanguage/${correlationId}`), {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).responseText = await response.text().catch(() => '');
        throw error;
      }

      const data = await parseJsonResponse(response);
      logger.debug(3, 'API', 'Language detection status response', data);
      return data;
    }, `Check Language Detection Status (${correlationId})`);
  } catch (error: any) {
    rethrowIfAuthError(error);
    logger.error('API', 'Language detection status check error:', error);

    return {
      status: 'ERROR',
      errors: [parseErrorResponse(error)],
    };
  }
}
