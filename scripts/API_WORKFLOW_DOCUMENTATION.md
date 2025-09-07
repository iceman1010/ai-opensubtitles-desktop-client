# OpenSubtitles AI API - 2-Step Workflow Documentation

## Overview
The OpenSubtitles AI API uses a 2-step asynchronous process for both transcription and translation:

1. **Step 1**: Initiate the task (returns correlation_id)
2. **Step 2**: Poll for completion using correlation_id

## Transcription Workflow

### Step 1: Initiate Transcription
- **Endpoint**: `POST /transcribe`
- **Purpose**: Upload file and start transcription process
- **Returns**: `correlation_id` for polling

**Parameters:**
- `file`: Audio/video file to transcribe
- `language`: Language code (e.g., "en", "auto")
- `api`: AI model to use (e.g., "aws", "salad")
- `return_content`: Optional - returns content directly if completed immediately

**Response:**
```json
{
  "correlation_id": "67d9fe0ce53e2",
  "status": "CREATED" | "PENDING" | "COMPLETED" | "ERROR"
}
```

### Step 2: Check Transcription Status
- **Endpoint**: `POST /transcribe/{correlation_id}/`
- **Purpose**: Check if transcription is complete
- **Poll**: Every 5 seconds until status is COMPLETED or ERROR

**Possible Statuses:**
- `CREATED`: Task created
- `PENDING`: Processing in progress
- `COMPLETED`: Done - data available
- `ERROR`: Failed
- `TIMEOUT`: Timed out

**Completed Response:**
```json
{
  "correlation_id": "67d9fe0ce53e2",
  "status": "COMPLETED",
  "data": {
    "file_name": "test_archer_2min.srt",
    "return_content": "1\\r\\n00:00:00,082 --> 00:00:00,740\\r\\nTranscribed text...",
    "url": "https://api.opensubtitles.com/api/v1/ai/files/20550/test_archer_2min.srt",
    "duration": 121,
    "unit_price": 0.0054,
    "total_price": 1,
    "credits_left": 2026,
    "id": 20550,
    "complete": 1742339789
  }
}
```

## Translation Workflow

### Step 1: Initiate Translation
- **Endpoint**: `POST /translate`
- **Purpose**: Upload subtitle file and start translation
- **Returns**: `correlation_id` for polling

**Parameters:**
- `file`: Subtitle file to translate
- `translate_from`: Source language ("auto", "en", etc.)
- `translate_to`: Target language ("de", "fr", etc.)
- `api`: AI model (e.g., "deepl", "gemini-flash")
- `return_content`: Optional - returns content directly if completed immediately

### Step 2: Check Translation Status
- **Endpoint**: `POST /translation/{correlation_id}/`
- **Purpose**: Check if translation is complete
- **Poll**: Every 5 seconds until COMPLETED or ERROR

## Implementation in MainScreen.tsx

### API Methods Used:
1. `api.initiateTranscription(filePath, options)` - Step 1 for transcription
2. `api.checkTranscriptionStatus(correlationId)` - Step 2 for transcription
3. `api.initiateTranslation(filePath, options)` - Step 1 for translation
4. `api.checkTranslationStatus(correlationId)` - Step 2 for translation

### Polling Logic:
```typescript
const pollForCompletion = async (correlationId: string, type: 'transcription' | 'translation') => {
  const maxAttempts = 60; // 5 minutes with 5-second intervals
  let attempts = 0;
  
  const poll = async (): Promise<void> => {
    attempts++;
    
    const result = type === 'transcription' 
      ? await api.checkTranscriptionStatus(correlationId)
      : await api.checkTranslationStatus(correlationId);
      
    if (result.status === 'COMPLETED' && result.data) {
      // Success - handle result
      return;
    } else if (result.status === 'ERROR') {
      throw new Error(result.errors?.join(', ') || `${type} failed`);
    } else if (result.status === 'TIMEOUT') {
      throw new Error(`${type} timed out`);
    } else if (attempts >= maxAttempts) {
      throw new Error(`${type} polling timeout after ${maxAttempts} attempts`);
    } else {
      // Continue polling
      setTimeout(() => poll(), 5000);
    }
  };
  
  await poll();
};
```

### Key Points for Batch Processing:
1. **Always use 2-step process** - Never expect immediate results
2. **Poll with delays** - 5 second intervals to avoid overwhelming server
3. **Handle all statuses** - CREATED, PENDING, COMPLETED, ERROR, TIMEOUT
4. **Manage correlation_ids** - Store and track for each file
5. **Sequential processing** - Process one file at a time to avoid rate limits
6. **Credit tracking** - Update credits from response data
7. **File management** - Handle temporary files and cleanup

## Status Bar Integration Requirement:
**ALL API communications MUST be reflected in the status bar using `setAppProcessing(true, "message")` calls:**

- Authentication steps: `"Checking authentication..."`, `"Logging in..."`, `"Login successful!"`
- Task initiation: `"Initiating transcription for filename..."`, `"Initiating translation for filename..."`
- Polling progress: `"Transcription in progress... (attempt X/60)"`, `"Translation in progress... (attempt X/60)"`
- Success states: `"Transcription completed successfully!"`, `"Translation completed successfully!"`
- Error states: `"Transcription failed"`, `"Translation failed"`, `"API timeout"`
- Batch progress: `"Processing file X/Y: filename"`, `"Batch processing completed!"`

This ensures users have real-time visibility into all API operations and system state.

## Critical Mistakes to Avoid:
- ❌ Don't expect immediate results from initiate calls
- ❌ Don't call non-existent methods like `transcribe()` or `translate()`
- ❌ Don't skip the polling step
- ❌ Don't poll too frequently (respect rate limits)
- ❌ Don't process multiple files simultaneously
- ❌ Don't skip status bar updates for API communications