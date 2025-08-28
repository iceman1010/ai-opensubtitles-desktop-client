import React, { useState } from 'react';

interface AppConfig {
  username: string;
  password: string;
  apiKey?: string;
  lastUsedLanguage?: string;
  debugMode?: boolean;
  credits?: {
    used: number;
    remaining: number;
  };
}

interface PreferencesProps {
  config: AppConfig;
  onSave: (config: Partial<AppConfig>) => void;
  onCancel: () => void;
}

function Preferences({ config, onSave, onCancel }: PreferencesProps) {
  const [username, setUsername] = useState(config.username || '');
  const [password, setPassword] = useState(config.password || '');
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [debugMode, setDebugMode] = useState(config.debugMode || false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !apiKey) {
      return;
    }

    setIsLoading(true);
    try {
      await onSave({ username, password, apiKey, debugMode });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="preferences-container">
      <h1>Preferences</h1>
      
      <form onSubmit={handleSubmit} className="preferences-form">
        <div className="form-group">
          <label htmlFor="username">Username:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="apiKey">API Key:</label>
          <input
            type="password"
            id="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
            disabled={isLoading}
            placeholder="Your OpenSubtitles API Key"
          />
        </div>

        <div className="form-group">
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            padding: '8px 0'
          }}>
            <input
              type="checkbox"
              id="debug-mode"
              checked={debugMode}
              onChange={(e) => setDebugMode(e.target.checked)}
              disabled={isLoading}
              style={{ 
                width: '18px',
                height: '18px',
                flexShrink: 0,
                cursor: 'pointer'
              }}
            />
            <div style={{ flex: 1 }}>
              <label 
                htmlFor="debug-mode" 
                style={{ 
                  margin: 0, 
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'block',
                  marginBottom: '4px'
                }}
              >
                Enable Debug Mode (requires restart)
              </label>
              <div style={{ 
                fontSize: '12px', 
                color: '#666', 
                lineHeight: '1.4',
                maxWidth: '400px'
              }}>
                When enabled, developer tools will automatically open for debugging.
              </div>
            </div>
          </div>
        </div>

        {config.credits && (
          <div className="credits-info">
            <label>Current Credits:</label>
            <p>Remaining: {config.credits.remaining}</p>
            <p>Used: {config.credits.used}</p>
          </div>
        )}

        <div className="button-group">
          <button
            type="submit"
            className="button"
            disabled={isLoading || !username || !password || !apiKey}
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

export default Preferences;