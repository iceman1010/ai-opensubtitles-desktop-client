import React, { useState, useEffect } from 'react';

interface AppConfig {
  username: string;
  password: string;
  apiKey?: string;
  lastUsedLanguage?: string;
  debugMode?: boolean;
  checkUpdatesOnStart?: boolean;
  credits?: {
    used: number;
    remaining: number;
  };
}

interface PreferencesProps {
  config: AppConfig;
  onSave: (config: Partial<AppConfig>) => Promise<boolean>;
  onCancel: () => void;
  setAppProcessing: (processing: boolean, task?: string) => void;
}

function Preferences({ config, onSave, onCancel, setAppProcessing }: PreferencesProps) {
  const [username, setUsername] = useState(config.username || '');
  const [password, setPassword] = useState(config.password || '');
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [debugMode, setDebugMode] = useState(config.debugMode || false);
  const [checkUpdatesOnStart, setCheckUpdatesOnStart] = useState(config.checkUpdatesOnStart ?? true);
  const [isLoading, setIsLoading] = useState(false);
  const [updateStatus, setUpdateStatus] = useState<string>('');
  const [error, setError] = useState('');

  useEffect(() => {
    const handleUpdateStatus = (_event: any, status: { event: string, message: string }) => {
      setUpdateStatus(status.message);
    };

    window.electronAPI.onUpdateStatus(handleUpdateStatus);

    return () => {
      window.electronAPI.removeUpdateStatusListener(handleUpdateStatus);
    };
  }, []);

  const handleCheckForUpdates = async () => {
    setUpdateStatus('Checking for updates...');
    try {
      await window.electronAPI.checkForUpdates();
    } catch (error) {
      setUpdateStatus('Failed to check for updates');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !apiKey) {
      return;
    }

    setIsLoading(true);
    setError('');
    setAppProcessing(true, 'Validating credentials...');
    try {
      const success = await onSave({ username, password, apiKey, debugMode, checkUpdatesOnStart });
      if (!success) {
        setError('Failed to save preferences. Please check your credentials.');
      }
    } catch (error) {
      setError('Failed to save preferences. Please check your credentials and try again.');
    } finally {
      setIsLoading(false);
      setAppProcessing(false);
    }
  };


  return (
    <>
      <div className="preferences-container">
      <h1>Preferences</h1>
      
      {error && (
        <div className="status-message error">
          {error}
        </div>
      )}
      
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

        <div className="form-group">
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            padding: '8px 0'
          }}>
            <input
              type="checkbox"
              id="check-updates-on-start"
              checked={checkUpdatesOnStart}
              onChange={(e) => setCheckUpdatesOnStart(e.target.checked)}
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
                htmlFor="check-updates-on-start" 
                style={{ 
                  margin: 0, 
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'block',
                  marginBottom: '4px'
                }}
              >
                Check for updates on startup
              </label>
              <div style={{ 
                fontSize: '12px', 
                color: '#666', 
                lineHeight: '1.4',
                maxWidth: '400px'
              }}>
                Automatically check for application updates when the app starts.
              </div>
            </div>
          </div>
        </div>

        <div className="form-group">
          <div style={{
            padding: '15px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            marginBottom: '15px'
          }}>
            <h3 style={{ marginBottom: '15px', fontSize: '16px', color: '#2c3e50' }}>Updates</h3>
            <div style={{ marginBottom: '15px' }}>
              <button
                type="button"
                className="button"
                onClick={handleCheckForUpdates}
                disabled={isLoading}
                style={{ marginRight: '10px' }}
              >
                Check for Updates
              </button>
              {updateStatus && (
                <div style={{ 
                  marginTop: '10px',
                  padding: '8px 12px',
                  backgroundColor: '#d1ecf1',
                  color: '#0c5460',
                  border: '1px solid #bee5eb',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}>
                  {updateStatus}
                </div>
              )}
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
    </>
  );
}

export default Preferences;