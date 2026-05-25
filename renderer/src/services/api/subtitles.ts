import CacheManager from '../cache';
import { logger } from '../../utils/errorLogger';
import { apiRequestWithRetry, getUserFriendlyErrorMessage } from '../../utils/networkUtils';
import { rethrowIfAuthError, getUserAgent, parseJsonResponse } from './helpers';
import {
  ApiState,
  SubtitleSearchParams,
  SubtitleDownloadParams,
  SubtitleLanguage,
  SubtitleLanguagesResponse,
  FeatureSearchParams,
  FeatureSearchResponse,
} from './types';

export async function searchSubtitles(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
  params: SubtitleSearchParams,
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!state.apiKey) {
    const error = 'API Key is required to search subtitles';
    logger.error('API', error);
    return { success: false, error };
  }

  try {
    const result = await apiRequestWithRetry(async () => {
      logger.debug(2, 'API', 'Searching subtitles with params:', params);

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Api-Key': state.apiKey || '',
        'User-Agent': getUserAgent(),
      };

      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }

      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });

      const queryString = queryParams.toString();
      const url = getAIUrl(`/proxy/subtitles${queryString ? `?${queryString}` : ''}`);

      logger.debug(2, 'API', 'Searching subtitles at URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('API', 'Subtitle search failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText,
        });

        const error = new Error(`Request failed: ${response.status} ${response.statusText} - ${errorText}`);
        (error as any).status = response.status;
        (error as any).responseText = errorText;
        throw error;
      }

      const responseData = await parseJsonResponse(response);
      logger.debug(3, 'API', 'Subtitle search response:', responseData);

      return responseData;
    }, 'Search Subtitles', 3);

    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    rethrowIfAuthError(error);
    logger.error('API', 'Subtitle search error after retries:', error);
    return {
      success: false,
      error: getUserFriendlyErrorMessage(error),
    };
  }
}

export async function searchForFeatures(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
  params: FeatureSearchParams,
): Promise<{ success: boolean; data?: FeatureSearchResponse; error?: string }> {
  if (!state.apiKey) {
    const error = 'API Key is required to search features';
    logger.error('API', error);
    return { success: false, error };
  }

  try {
    const result = await apiRequestWithRetry(async () => {
      logger.debug(2, 'API', 'Searching features with params:', params);

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Api-Key': state.apiKey || '',
        'User-Agent': getUserAgent(),
      };

      if (state.token) {
        headers['Authorization'] = `Bearer ${state.token}`;
      }

      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, String(value));
        }
      });

      const queryString = queryParams.toString();
      const url = getAIUrl(`/proxy/features${queryString ? `?${queryString}` : ''}`);

      logger.debug(2, 'API', 'Searching features at URL:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('API', 'Feature search failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText,
        });

        const error = new Error(`Request failed: ${response.status} ${response.statusText} - ${errorText}`);
        (error as any).status = response.status;
        (error as any).responseText = errorText;
        throw error;
      }

      const responseData = await parseJsonResponse(response);
      logger.debug(3, 'API', 'Feature search response:', responseData);

      return responseData;
    }, 'Search Features', 3);

    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    rethrowIfAuthError(error);
    logger.error('API', 'Feature search error after retries:', error);
    return {
      success: false,
      error: getUserFriendlyErrorMessage(error),
    };
  }
}

export async function downloadSubtitle(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
  params: SubtitleDownloadParams,
): Promise<{ success: boolean; data?: any; error?: string }> {
  if (!state.apiKey) {
    const error = 'API Key is required to download subtitles';
    logger.error('API', error);
    return { success: false, error };
  }

  if (!state.token) {
    const error = 'Authentication token is required to download subtitles';
    logger.error('API', error);
    return { success: false, error };
  }

  try {
    const result = await apiRequestWithRetry(async () => {
      logger.debug(2, 'API', 'Downloading subtitle with params:', params);

      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Api-Key': state.apiKey || '',
        'Content-Type': 'application/json',
        'User-Agent': getUserAgent(),
        'Authorization': `Bearer ${state.token}`,
      };

      const url = getAIUrl('/proxy/download');

      logger.debug(2, 'API', 'Downloading subtitle at URL:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('API', 'Subtitle download failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText,
        });

        const error = new Error(`Request failed: ${response.status} ${response.statusText} - ${errorText}`);
        (error as any).status = response.status;
        (error as any).responseText = errorText;
        throw error;
      }

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        const responseData = await parseJsonResponse(response);
        logger.debug(3, 'API', 'Subtitle download response (JSON):', responseData);
        return responseData;
      } else {
        const srtContent = await response.text();
        logger.debug(2, 'API', 'Subtitle download response (direct SRT)', { length: srtContent.length });
        return { file: srtContent };
      }
    }, 'Download Subtitle', 3);

    return {
      success: true,
      data: result,
    };
  } catch (error: any) {
    rethrowIfAuthError(error);
    logger.error('API', 'Subtitle download error after retries:', error);
    return {
      success: false,
      error: getUserFriendlyErrorMessage(error),
    };
  }
}

export async function getSubtitleSearchLanguages(
  state: ApiState,
): Promise<{ success: boolean; data?: SubtitleLanguage[]; error?: string }> {
  const cacheKey = 'subtitle_search_languages';
  const cacheExpiry = 24 * 60 * 60 * 1000;

  try {
    const cachedData = CacheManager.get<{ data: SubtitleLanguage[]; timestamp: number }>(cacheKey);
    if (cachedData && (Date.now() - cachedData.timestamp) < cacheExpiry) {
      logger.debug(2, 'API', 'Returning cached subtitle search languages');
      return { success: true, data: cachedData.data };
    }

    logger.debug(2, 'API', 'Fetching subtitle search languages from API');

    const result = await apiRequestWithRetry(async () => {
      const headers: Record<string, string> = {
        'Accept': 'application/json',
        'Api-Key': state.apiKey || '',
        'User-Agent': getUserAgent(),
      };

      const url = 'https://api.opensubtitles.com/api/v1/infos/languages';

      const response = await fetch(url, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('API', 'Subtitle search languages fetch failed:', {
          status: response.status,
          statusText: response.statusText,
          errorText: errorText,
        });

        const error = new Error(`Request failed: ${response.status} ${response.statusText} - ${errorText}`);
        (error as any).status = response.status;
        (error as any).responseText = errorText;
        throw error;
      }

      const responseData: SubtitleLanguagesResponse = await parseJsonResponse(response);
      logger.debug(3, 'API', 'Subtitle search languages response:', responseData);

      return responseData;
    }, 'Get Subtitle Search Languages', 3);

    const languages = result.data;
    CacheManager.set(cacheKey, { data: languages, timestamp: Date.now() });

    return {
      success: true,
      data: languages,
    };
  } catch (error: any) {
    rethrowIfAuthError(error);
    logger.error('API', 'Subtitle search languages fetch error after retries:', error);
    return {
      success: false,
      error: getUserFriendlyErrorMessage(error),
    };
  }
}
