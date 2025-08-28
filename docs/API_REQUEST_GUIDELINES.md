# API Request Guidelines

## ⚠️ MANDATORY: Use apiRequestWithRetry for ALL API Requests

All API requests MUST use the `apiRequestWithRetry` wrapper to handle:
- **CloudFlare errors** (520-530 status codes)
- **Proxy errors** (502, 503, 504 - Varnish, Kong, etc.)
- **Network connectivity issues**
- **Rate limiting** (429 errors)
- **Server errors** (5xx codes)

## Usage Pattern

```typescript
import { apiRequestWithRetry, getUserFriendlyErrorMessage } from '../utils/networkUtils';

// ✅ CORRECT - Use wrapper for all API calls
async someApiMethod(): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const result = await apiRequestWithRetry(async () => {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        // Create error with status for better categorization
        const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
        (error as any).status = response.status;
        (error as any).responseText = await response.text().catch(() => '');
        throw error;
      }
      
      return await response.json();
    }, 'Operation Name', 3); // maxRetries = 3
    
    return { success: true, data: result };
  } catch (error: any) {
    return {
      success: false,
      error: getUserFriendlyErrorMessage(error)
    };
  }
}

// ❌ WRONG - Direct fetch without retry wrapper
async badApiMethod() {
  const response = await fetch(url, options); // No retry handling!
  return await response.json();
}
```

## Error Categorization & Retry Delays

The wrapper automatically handles different error types with appropriate delays:

| Error Type | Retry Delays | Max Retries |
|------------|--------------|-------------|
| **Rate Limit (429)** | 30s → 60s → 120s | 3 |
| **CloudFlare (520-530)** | 5s → 10s → 20s | 3 |
| **Proxy (502,503,504)** | 2s → 4s → 8s | 3 |
| **Server (5xx)** | 3s → 6s → 12s | 3 |
| **Timeout** | 2s → 5s → 10s | 3 |
| **Offline** | 1s → 2s → 4s | 3 |

## Implementation Checklist

When adding new API methods:

### ✅ Required Steps:
1. **Import the wrapper**: `import { apiRequestWithRetry, getUserFriendlyErrorMessage } from '../utils/networkUtils';`
2. **Wrap fetch call**: Use `apiRequestWithRetry(() => { /* your fetch logic */ }, 'Method Name', 3)`
3. **Add status to errors**: Set `error.status` and `error.responseText` for proper categorization
4. **Return user-friendly errors**: Use `getUserFriendlyErrorMessage(error)` in catch blocks
5. **Add context name**: Provide meaningful operation name for logging

### ✅ Error Object Structure:
```typescript
if (!response.ok) {
  const error = new Error(`Request failed: ${response.status} ${response.statusText}`);
  (error as any).status = response.status;
  (error as any).responseText = await response.text().catch(() => '');
  throw error;
}
```

## Current Status

### ✅ Already Updated:
- `login()` - Authentication with CloudFlare/proxy retry
- `getCredits()` - Credits fetching with error handling

### ⚠️ TODO: Update These Methods:
- `getTranscriptionInfo()`
- `getTranslationInfo()` 
- `transcribe()`
- `translate()`
- `uploadFile()`
- Any other fetch() calls in the codebase

## Configuration

All retry behavior is configurable via `shared/networkConfig.json`:

```json
{
  "retry": {
    "enabled": true,
    "maxAttempts": 3
  },
  "errorTypes": {
    "cloudflareErrors": {
      "enabled": true,
      "statusCodes": [520, 521, 522, ...],
      "delays": [5000, 10000, 20000]
    }
  }
}
```

### Error Simulation (Development Only)

For testing, enable error simulation:

```json
{
  "development": {
    "simulateErrors": true,
    "errorSimulation": {
      "cloudflare": {
        "enabled": true,
        "probability": 0.1
      }
    }
  }
}
```

**Development Panel**: In development mode, click the 🔧 button to control error simulation in real-time.

## Testing

### Automated Testing with Error Simulation:
1. **Enable simulation** in development panel or config
2. **Set error probabilities** for different error types
3. **Test retry logic** without real network issues
4. **Verify error handling** and user messages

### Manual Testing:
1. **Disconnecting internet** - Should retry and show offline message
2. **Using invalid API keys** - Should not retry auth errors
3. **Rate limiting simulation** - Should use longer delays between retries

## Benefits

✅ **Automatic proxy error recovery**  
✅ **CloudFlare protection bypass**  
✅ **Network resilience**  
✅ **User-friendly error messages**  
✅ **Intelligent retry delays**  
✅ **Comprehensive logging**  
✅ **Configurable behavior**  
✅ **Development error simulation**  
✅ **Real-time testing tools**