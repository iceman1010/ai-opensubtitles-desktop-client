import { logger } from '../../utils/errorLogger';
import { apiRequestWithRetry, getUserFriendlyErrorMessage } from '../../utils/networkUtils';
import { rethrowIfAuthError, getUserAgent, parseJsonResponse } from './helpers';
import { ApiState } from './types';

export async function downloadFile(
  state: ApiState,
  url: string,
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    const result = await apiRequestWithRetry(async () => {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Api-Key': state.apiKey || '',
        'User-Agent': getUserAgent(),
      };

      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
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
    rethrowIfAuthError(error);
    return {
      success: false,
      error: getUserFriendlyErrorMessage(error),
    };
  }
}

export async function downloadFileByMediaId(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
  mediaId: string,
  fileName: string,
): Promise<{ success: boolean; content?: string; error?: string }> {
  try {
    logger.debug(2, 'API', 'Downloading file by media ID', { mediaId, fileName });

    const result = await apiRequestWithRetry(async () => {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Api-Key': state.apiKey || '',
        'User-Agent': getUserAgent(),
      };

      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }

      const url = getAIUrl(`/files/${mediaId}/${fileName}`);

      logger.debug(2, 'API', 'Downloading file from URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('API', 'File download failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText,
        });

        const error = new Error(`Request failed: ${response.status} ${response.statusText} - ${errorText}`);
        (error as any).status = response.status;
        (error as any).responseText = errorText;
        throw error;
      }

      const content = await response.text();
      logger.info('API', 'File downloaded successfully', {
        mediaId,
        fileName,
        contentLength: content.length,
      });

      return content;
    }, `Download File (${mediaId}/${fileName})`, 3);

    return {
      success: true,
      content: result,
    };
  } catch (error: any) {
    rethrowIfAuthError(error);
    logger.error('API', 'File download error after retries:', error);
    return {
      success: false,
      error: getUserFriendlyErrorMessage(error),
    };
  }
}
