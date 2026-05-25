import { logger } from '../../utils/errorLogger';
import appConfig from '../../config/appConfig.json';

export function rethrowIfAuthError(error: any): void {
  const status = error?.status || error?.originalError?.status || 0;
  if (status === 401 || status === 403) throw error;
}

export const getFileNameFromPath = (filePath: string): string => {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  return lastSlash >= 0 ? filePath.substring(lastSlash + 1) : filePath;
};

export const getUserAgent = () => {
  if (appConfig && appConfig.userAgent) {
    return appConfig.userAgent;
  }
  logger.warn('Helpers', 'AppConfig failed to load, using fallback User-Agent');
  return 'AI.Opensubtitles.com-Client v1.0.0';
};

export async function parseJsonResponse(response: Response): Promise<any> {
  const data = await response.json();
  if (data && typeof data.message === 'string' &&
      data.message.toLowerCase().includes('invalid token')) {
    logger.warn('API', 'Received invalid token response, will trigger re-authentication');
    const error = new Error('Invalid token');
    (error as any).status = 401;
    (error as any).invalidToken = true;
    throw error;
  }
  return data;
}

export function parseErrorResponse(error: any): string {
  let errorMessage = error.message || 'Request failed';

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

  return errorMessage;
}
