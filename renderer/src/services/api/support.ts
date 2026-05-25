import { logger } from '../../utils/errorLogger';
import { apiRequestWithRetry } from '../../utils/networkUtils';
import { rethrowIfAuthError, getUserAgent } from './helpers';
import { ApiState } from './types';

export async function createSupportTicket(
  state: ApiState,
  getAIUrl: (endpoint: string) => string,
  problem_description: string,
  email: string,
  name: string,
): Promise<{ success: boolean; ticket_id?: number; error?: string }> {
  if (!state.apiKey) return { success: false, error: 'API Key is required' };

  const trimmedDescription = problem_description.trim();
  if (!trimmedDescription) {
    return { success: false, error: 'Problem description is required' };
  }

  const trimmedEmail = email.trim();
  if (!trimmedEmail) {
    return { success: false, error: 'Email is required' };
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmedEmail)) {
    return { success: false, error: 'Invalid email format' };
  }

  const trimmedName = name.trim();
  if (!trimmedName) {
    return { success: false, error: 'Name is required' };
  }

  try {
    return await apiRequestWithRetry(async () => {
      const formData = new FormData();
      formData.append('problem_description', trimmedDescription);
      formData.append('email', trimmedEmail);
      formData.append('name', trimmedName);

      const headers: Record<string, string> = {
        'Api-Key': state.apiKey,
      };
      if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

      const response = await fetch(getAIUrl('/osticket'), {
        method: 'POST',
        headers,
        body: formData,
      });

      const responseText = await response.text();

      if (!response.ok) {
        const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).responseText = responseText;
        throw error;
      }

      try {
        const responseData = JSON.parse(responseText);

        if (responseData.status === 'error' || responseData.error) {
          const errorMsg = responseData.error ||
            (Array.isArray(responseData.errors) && responseData.errors[0]) ||
            (responseData.error_details?.response_body) ||
            'Failed to create support ticket';
          const err = new Error(errorMsg);
          (err as any).status = 400;
          throw err;
        }

        return {
          success: true,
          ticket_id: responseData.ticket_id || responseData.data?.ticket_id,
        };
      } catch (parseError: any) {
        if (parseError.status === 400) {
          throw parseError;
        }
        if (responseText.includes('missing key parameter')) {
          const match = responseText.match(/missing key parameter: (\w+)/);
          if (match) {
            throw new Error(`Missing required field: ${match[1]}`);
          }
        }
        return { success: true };
      }
    }, 'Create Support Ticket', 3);
  } catch (error: any) {
    rethrowIfAuthError(error);

    let errorMessage = 'Failed to create support ticket';

    if (error.responseText) {
      try {
        const parsed = JSON.parse(error.responseText);
        if (parsed.error) errorMessage = parsed.error;
        else if (Array.isArray(parsed.errors) && parsed.errors.length > 0) errorMessage = parsed.errors[0];
        else if (parsed.error_details?.response_body) errorMessage = parsed.error_details.response_body;
      } catch {
        const match = error.responseText.match(/Error: ([^<]+)</);
        if (match) errorMessage = match[1];
      }
    } else if (error.message) {
      errorMessage = error.message;
    }

    return { success: false, error: errorMessage };
  }
}
