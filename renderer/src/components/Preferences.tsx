import React, { useState, useEffect } from 'react';
import CacheManager from '../services/cache';
import { logger } from '../utils/errorLogger';

interface AppConfig {
  username: string;
  password: string;
  apiKey?: string;
  lastUsedLanguage?: string;
  debugMode?: boolean;
  debugLevel?: number;
  checkUpdatesOnStart?: boolean;
  autoRemoveCompletedFiles?: boolean;
  cacheExpirationHours?: number;
  betaTest?: boolean;
  ffmpegPath?: string;
  audio_language_detection_time?: number;
  apiBaseUrl?: string;
  apiUrlParameter?: string;
  autoLanguageDetection?: boolean;
  darkMode?: boolean;
  pollingIntervalSeconds?: number;
  pollingTimeoutSeconds?: number;
  defaultFilenameFormat?: string;
  credits?: {
    used: number;
    remaining: number;
  };
}

interface PreferencesProps {
  config: AppConfig;
  onSave: (config: Partial<AppConfig>) => Promise<boolean>;
  setAppProcessing: (processing: boolean, task?: string) => void;
}

function Preferences({ config, onSave, setAppProcessing }: PreferencesProps) {
  const [username, setUsername] = useState(config.username || '');
  const [password, setPassword] = useState(config.password || '');
  const [apiKey, setApiKey] = useState(config.apiKey || '');
  const [debugMode, setDebugMode] = useState(config.debugMode || false);
  const [debugLevel, setDebugLevel] = useState(config.debugLevel ?? 0);
  const [checkUpdatesOnStart, setCheckUpdatesOnStart] = useState(config.checkUpdatesOnStart ?? true);
  const [autoRemoveCompletedFiles, setAutoRemoveCompletedFiles] = useState(config.autoRemoveCompletedFiles ?? false);
  const [cacheExpirationHours, setCacheExpirationHours] = useState(config.cacheExpirationHours ?? 24);
  const [betaTest, setBetaTest] = useState(config.betaTest ?? false);
  const [ffmpegPath, setFfmpegPath] = useState(config.ffmpegPath || '');
  const [audioLanguageDetectionTime, setAudioLanguageDetectionTime] = useState(config.audio_language_detection_time ?? 240);
  const [pollingIntervalSeconds, setPollingIntervalSeconds] = useState(config.pollingIntervalSeconds ?? 10);
  const [pollingTimeoutSeconds, setPollingTimeoutSeconds] = useState(config.pollingTimeoutSeconds ?? 7200);
  const [apiBaseUrl, setApiBaseUrl] = useState(config.apiBaseUrl || 'https://api.opensubtitles.com/api/v1');
  const [apiUrlParameter, setApiUrlParameter] = useState(config.apiUrlParameter || '');
  const [autoLanguageDetection, setAutoLanguageDetection] = useState(config.autoLanguageDetection ?? false);
  const [defaultFilenameFormat, setDefaultFilenameFormat] = useState(config.defaultFilenameFormat || '{filename}.{language_code}.{type}.{extension}');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isTestingFfmpeg, setIsTestingFfmpeg] = useState(false);
  const [ffmpegTestResult, setFfmpegTestResult] = useState<{success: boolean, message: string} | null>(null);
  const [fileAssociationStatus, setFileAssociationStatus] = useState<{registered: boolean, associatedFormats: string[]}>({ registered: false, associatedFormats: [] });
  const [isCheckingAssociations, setIsCheckingAssociations] = useState(false);
  const [isRegisteringAssociations, setIsRegisteringAssociations] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);



  const handleResetSettings = async () => {
    if (window.confirm('Are you sure you want to reset all settings? This will clear your login credentials and all preferences. This action cannot be undone.')) {
      try {
        logger.debug(2, 'Preferences', '=== FRONTEND RESET DEBUG ===');
        logger.debug(2, 'Preferences', 'Calling resetAllSettings...');
        const success = await window.electronAPI.resetAllSettings();
        logger.debug(2, 'Preferences', `resetAllSettings returned: ${success}`);
        logger.debug(2, 'Preferences', `Success type: ${typeof success}`);
        
        if (success) {
          logger.debug(2, 'Preferences', 'Reset successful, updating UI...');
          // Reset local state to match cleared config
          setUsername('');
          setPassword('');
          setApiKey('');
          setDebugMode(false);
          setDebugLevel(0);
          setCheckUpdatesOnStart(true);
          setAutoRemoveCompletedFiles(false);
          setFfmpegPath('');
          setAudioLanguageDetectionTime(240);
          setAutoLanguageDetection(true);
          setError('');
          alert('All settings have been reset successfully.');
        } else {
          logger.debug(2, 'Preferences', 'Reset failed, showing error...');
          setError('Failed to reset settings. Please try again.');
        }
        logger.debug(2, 'Preferences', '=== END FRONTEND RESET DEBUG ===');
      } catch (error) {
        console.error('=== FRONTEND RESET ERROR ===');
        console.error('Reset settings error:', error);
        console.error('Error details:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : 'No stack trace'
        });
        console.error('=== END FRONTEND RESET ERROR ===');
        setError('Failed to reset settings. Please try again.');
      }
    }
  };

  useEffect(() => {
    checkFileAssociationStatus();
  }, []);

  const checkFileAssociationStatus = async () => {
    setIsCheckingAssociations(true);
    try {
      const status = await window.electronAPI.checkFileAssociations();
      setFileAssociationStatus(status);
    } catch (error) {
      console.error('Failed to check file associations:', error);
    } finally {
      setIsCheckingAssociations(false);
    }
  };

  const handleRegisterFileTypes = async () => {
    setIsRegisteringAssociations(true);
    try {
      const result = await window.electronAPI.registerFileAssociations();
      if (result.success) {
        alert(`Success: ${result.message}`);
        // Refresh status after successful registration
        await checkFileAssociationStatus();
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      console.error('Failed to register file associations:', error);
      alert('Error: Failed to register file types. Please try running the application as administrator/root.');
    } finally {
      setIsRegisteringAssociations(false);
    }
  };

  const handleCredentialsSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !apiKey) {
      return;
    }

    setIsLoading(true);
    setError('');
    setAppProcessing(true, 'Validating credentials...');
    try {
      const success = await onSave({ username, password, apiKey });
      if (!success) {
        setError('Failed to save credentials. Please check your login information.');
      } else {
        setError('');
        // Show success message briefly
        const successDiv = document.createElement('div');
        successDiv.className = 'status-message success';
        successDiv.textContent = 'Credentials saved successfully!';
        successDiv.style.cssText = 'margin-bottom: 15px; padding: 10px; background: #d4edda; color: #155724; border: 1px solid #c3e6cb; border-radius: 4px;';
        const form = document.querySelector('.preferences-form');
        if (form) {
          form.insertBefore(successDiv, form.firstChild);
          setTimeout(() => successDiv.remove(), 3000);
        }
      }
    } catch (error) {
      setError('Failed to save credentials. Please check your information and try again.');
    } finally {
      setIsLoading(false);
      setAppProcessing(false);
    }
  };

  // Helper function to get user-friendly setting names
  const getSettingDisplayName = (settingKey: keyof AppConfig): string => {
    const nameMap: Record<string, string> = {
      debugMode: 'debug mode',
      debugLevel: 'debug level',
      checkUpdatesOnStart: 'update checking',
      autoRemoveCompletedFiles: 'auto-remove completed files',
      cacheExpirationHours: 'cache expiration',
      betaTest: 'beta testing',
      ffmpegPath: 'FFmpeg path',
      apiBaseUrl: 'API base URL',
      apiUrlParameter: 'API parameters',
      autoLanguageDetection: 'auto language detection',
      darkMode: 'dark mode'
    };
    return nameMap[settingKey] || settingKey;
  };

  // Generic handler for instant save settings (no credential validation)
  const handleInstantSave = async (settingKey: keyof AppConfig, value: any) => {
    const displayName = getSettingDisplayName(settingKey);

    try {
      // Show saving message in status bar
      setAppProcessing(true, `Saving ${displayName}...`);

      // Use onSave prop to properly update parent component state
      const success = await onSave({ [settingKey]: value });
      if (success) {
        // Show success message briefly
        setAppProcessing(true, `${displayName} saved`);
        setTimeout(() => {
          setAppProcessing(false);
        }, 1500);

        logger.debug(1, 'Preferences', `Instantly saved ${settingKey}:`, value);
      } else {
        // Show error message
        setAppProcessing(true, `Failed to save ${displayName}`);
        setTimeout(() => {
          setAppProcessing(false);
        }, 2000);
      }
    } catch (error) {
      logger.debug(1, 'Preferences', `Failed to instantly save ${settingKey}:`, error);
      // Show error message
      setAppProcessing(true, `Error saving ${displayName}`);
      setTimeout(() => {
        setAppProcessing(false);
      }, 2000);
    }
  };

  const handleClearCache = async () => {
    if (window.confirm('Clear all cached API data? This will force fresh data to be fetched from the server on next use.')) {
      setIsClearingCache(true);
      try {
        CacheManager.clear();
        alert('Cache cleared successfully! Fresh data will be loaded on next API call.');
      } catch (error) {
        console.error('Failed to clear cache:', error);
        alert('Failed to clear cache. Please try again.');
      } finally {
        setIsClearingCache(false);
      }
    }
  };

  const handleTestFfmpeg = async () => {
    setIsTestingFfmpeg(true);
    setFfmpegTestResult(null);
    
    try {
      const result = await window.electronAPI.testFfmpegPath(ffmpegPath);
      setFfmpegTestResult(result);
      logger.debug(1, 'Preferences', 'FFmpeg test result:', result);
    } catch (error) {
      console.error('Failed to test FFmpeg path:', error);
      setFfmpegTestResult({ success: false, message: 'Failed to test FFmpeg path' });
    } finally {
      setIsTestingFfmpeg(false);
    }
  };

  const handleBrowseForFfmpeg = async () => {
    try {
      const result = await window.electronAPI.openFfmpegDialog();
      if (result.filePath) {
        setFfmpegPath(result.filePath);
        setFfmpegTestResult(null);
      }
    } catch (error) {
      console.error('Failed to open FFmpeg dialog:', error);
    }
  };

  const handleAudioLanguageDetectionTimeChange = async (newValue: number) => {
    setAudioLanguageDetectionTime(newValue);
    // Use a more user-friendly name for the status message
    try {
      setAppProcessing(true, 'Saving audio detection time...');

      // Use onSave prop to properly update parent component state
      const success = await onSave({ audio_language_detection_time: newValue });
      if (success) {
        setAppProcessing(true, 'Audio detection time saved');
        setTimeout(() => {
          setAppProcessing(false);
        }, 1500);

        logger.debug(1, 'Preferences', `Instantly saved audio_language_detection_time:`, newValue);
      } else {
        setAppProcessing(true, 'Failed to save audio detection time');
        setTimeout(() => {
          setAppProcessing(false);
        }, 2000);
      }
    } catch (error) {
      logger.debug(1, 'Preferences', `Failed to instantly save audio_language_detection_time:`, error);
      setAppProcessing(true, 'Error saving audio detection time');
      setTimeout(() => {
        setAppProcessing(false);
      }, 2000);
    }
  };

  return (
    <>
      <div className="preferences-container" style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        gap: '20px'
      }}>
      <h1>Preferences</h1>
      
      {error && (
        <div className="status-message error">
          {error}
        </div>
      )}
      
      <form onSubmit={handleCredentialsSave} className="preferences-form">
        {/* Credentials Section - Requires Save Button */}
        <div style={{
          padding: '20px',
          backgroundColor: 'var(--bg-tertiary)',
          border: '2px solid #007bff',
          borderRadius: '8px',
          marginBottom: '25px'
        }}>
          <h3 style={{
            marginTop: '0',
            marginBottom: '16px',
            fontSize: '16px',
            color: '#007bff',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <i className="fas fa-key"></i>
            Account Credentials
          </h3>
          <p style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            marginBottom: '20px',
            lineHeight: '1.4'
          }}>
            These settings require the "Save Credentials" button and will validate your login information.
          </p>

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
              type="text"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              required
              disabled={isLoading}
              placeholder="Your OpenSubtitles API Key"
            />
          </div>

          <div className="button-group">
            <button
              type="submit"
              className="button"
              disabled={isLoading || !username || !password || !apiKey}
              style={{
                backgroundColor: '#007bff',
                borderColor: '#007bff',
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '600'
              }}
            >
              <i className="fas fa-save" style={{ marginRight: '6px' }}></i>
              {isLoading ? 'Saving...' : 'Save Credentials'}
            </button>
          </div>
        </div>

        {/* Application Settings Section Divider */}
        <div style={{
          margin: '30px 0',
          height: '1px',
          background: 'linear-gradient(to right, transparent, var(--border-color) 20%, var(--border-color) 80%, transparent)',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            top: '-10px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--bg-primary)',
            padding: '0 15px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            <i className="fas fa-cog" style={{marginRight: '6px'}}></i>
            Application Settings
          </div>
        </div>

        <p style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          marginBottom: '20px',
          lineHeight: '1.4',
          textAlign: 'center'
        }}>
          These settings save automatically when changed - no save button required.
        </p>

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
              onChange={(e) => {
                const newValue = e.target.checked;
                setDebugMode(newValue);
                handleInstantSave('debugMode', newValue);
              }}
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
                color: 'var(--text-secondary)', 
                lineHeight: '1.4',
                maxWidth: '400px'
              }}>
                When enabled, developer tools will automatically open for debugging.
              </div>
            </div>
          </div>
        </div>

        {debugMode && (
          <>
            <div className="form-group">
              <label htmlFor="api-base-url" style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                API Base URL
              </label>
              <input
                id="api-base-url"
                type="text"
                value={apiBaseUrl}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setApiBaseUrl(newValue);
                  handleInstantSave('apiBaseUrl', newValue);
                }}
                disabled={isLoading}
                placeholder="https://api.opensubtitles.com/api/v1"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '2px solid var(--input-border)',
                  borderRadius: '6px',
                  backgroundColor: isLoading ? 'var(--bg-tertiary)' : 'var(--input-bg)',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  boxSizing: 'border-box',
                  outline: 'none',
                  fontFamily: 'monospace'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--button-bg)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--input-border)'}
              />
              <div style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: '1.4',
                marginTop: '6px',
                maxWidth: '500px'
              }}>
                Base URL for API calls. Only visible in debug mode. Use this to point to a test server for automated testing. Default: https://api.opensubtitles.com/api/v1
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="api-url-parameter" style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                API URL Parameter
              </label>
              <input
                id="api-url-parameter"
                type="text"
                value={apiUrlParameter}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setApiUrlParameter(newValue);
                  handleInstantSave('apiUrlParameter', newValue);
                }}
                disabled={isLoading}
                placeholder="?var1=1&var2=2"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '2px solid var(--input-border)',
                  borderRadius: '6px',
                  backgroundColor: isLoading ? 'var(--bg-tertiary)' : 'var(--input-bg)',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  boxSizing: 'border-box',
                  outline: 'none',
                  fontFamily: 'monospace'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--button-bg)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--input-border)'}
              />
              <div style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: '1.4',
                marginTop: '6px',
                maxWidth: '500px'
              }}>
                Optional URL parameters to append to all API requests for debugging. Example: ?debug=1&test=true
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="debug-level" style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: '500'
              }}>
                Debug Level
              </label>
              <select
                id="debug-level"
                value={debugLevel}
                onChange={(e) => {
                  const newValue = Number(e.target.value);
                  setDebugLevel(newValue);
                  handleInstantSave('debugLevel', newValue);
                }}
                disabled={isLoading}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  fontSize: '14px',
                  border: '2px solid var(--input-border)',
                  borderRadius: '6px',
                  backgroundColor: isLoading ? 'var(--bg-tertiary)' : 'var(--input-bg)',
                  color: 'var(--text-primary)',
                  transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
                  boxSizing: 'border-box',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = 'var(--button-bg)'}
                onBlur={(e) => e.target.style.borderColor = 'var(--input-border)'}
              >
                <option value={0}>0 - Silent (No debug output)</option>
                <option value={1}>1 - Basic (Essential info only)</option>
                <option value={2}>2 - Verbose (Detailed debugging)</option>
                <option value={3}>3 - Full (All debug information)</option>
              </select>
              <div style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: '1.4',
                marginTop: '6px',
                maxWidth: '500px'
              }}>
                Controls the verbosity of debug output. Higher levels provide more detailed logging information.
              </div>
            </div>
          </>
        )}

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
              onChange={(e) => {
                const newValue = e.target.checked;
                setCheckUpdatesOnStart(newValue);
                handleInstantSave('checkUpdatesOnStart', newValue);
              }}
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
                color: 'var(--text-secondary)', 
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
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            padding: '8px 0'
          }}>
            <input
              type="checkbox"
              id="auto-remove-completed-files"
              checked={autoRemoveCompletedFiles}
              onChange={(e) => {
                const newValue = e.target.checked;
                setAutoRemoveCompletedFiles(newValue);
                handleInstantSave('autoRemoveCompletedFiles', newValue);
              }}
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
                htmlFor="auto-remove-completed-files" 
                style={{ 
                  margin: 0, 
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'block',
                  marginBottom: '4px'
                }}
              >
                Auto-remove completed files
              </label>
              <div style={{ 
                fontSize: '12px', 
                color: 'var(--text-secondary)', 
                lineHeight: '1.4',
                maxWidth: '400px'
              }}>
                Automatically remove files from the batch queue after successful processing.
              </div>
            </div>
          </div>

        {/* Processing Settings Section Divider */}
        <div style={{
          margin: '30px 0',
          height: '1px',
          background: 'linear-gradient(to right, transparent, var(--border-color) 20%, var(--border-color) 80%, transparent)',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            top: '-10px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--bg-primary)',
            padding: '0 15px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            <i className="fas fa-brain" style={{marginRight: '6px'}}></i>
            Processing Settings
          </div>
        </div>

          {/* Cache Expiration Setting */}
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            padding: '8px 0'
          }}>
            <div style={{ flex: 1 }}>
              <label 
                htmlFor="cache-expiration-hours" 
                style={{ 
                  margin: 0, 
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'block',
                  marginBottom: '4px'
                }}
              >
                API Cache Expiration (hours)
              </label>
              <div style={{ 
                fontSize: '12px', 
                color: 'var(--text-secondary)', 
                lineHeight: '1.4',
                maxWidth: '400px',
                marginBottom: '8px'
              }}>
                How long to cache API model and language information. Lower values ensure fresher data but increase API calls.
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <select
                  id="cache-expiration-hours"
                  value={cacheExpirationHours}
                  onChange={(e) => {
                    const newValue = Number(e.target.value);
                    setCacheExpirationHours(newValue);
                    handleInstantSave('cacheExpirationHours', newValue);
                  }}
                  disabled={isLoading}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    backgroundColor: 'var(--bg-secondary)',
                    cursor: 'pointer',
                    minWidth: '120px'
                  }}
                >
                  <option value={1}>1 hour</option>
                  <option value={6}>6 hours</option>
                  <option value={12}>12 hours</option>
                  <option value={24}>24 hours (default)</option>
                  <option value={48}>48 hours</option>
                  <option value={168}>1 week</option>
                </select>
                <button
                  type="button"
                  onClick={handleClearCache}
                  disabled={isClearingCache}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: '#dc3545',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    fontSize: '12px',
                    cursor: isClearingCache ? 'not-allowed' : 'pointer',
                    opacity: isClearingCache ? 0.6 : 1,
                    whiteSpace: 'nowrap'
                  }}
                >
                  {isClearingCache ? 'Clearing...' : 'Clear Cache Now'}
                </button>
              </div>
            </div>
          </div>

          {/* API Polling Interval Setting */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '8px 0'
          }}>
            <div style={{ flex: 1 }}>
              <label
                htmlFor="polling-interval-seconds"
                style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'block',
                  marginBottom: '4px'
                }}
              >
                API Polling Interval (seconds)
              </label>
              <div style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: '1.4',
                maxWidth: '400px',
                marginBottom: '8px'
              }}>
                How often to check for completion of transcription and translation tasks.
              </div>
              <input
                id="polling-interval-seconds"
                type="number"
                min="5"
                max="60"
                step="1"
                value={pollingIntervalSeconds}
                onChange={(e) => {
                  const newValue = Math.max(5, Math.min(60, Number(e.target.value)));
                  setPollingIntervalSeconds(newValue);
                  handleInstantSave('pollingIntervalSeconds', newValue);
                }}
                disabled={isLoading}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'var(--bg-secondary)',
                  width: '120px'
                }}
                placeholder="10"
              />
              <span style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                marginLeft: '8px'
              }}>
                Default: 10 seconds
              </span>
            </div>
          </div>

          {/* API Polling Timeout Setting */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '8px 0'
          }}>
            <div style={{ flex: 1 }}>
              <label
                htmlFor="polling-timeout-seconds"
                style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'block',
                  marginBottom: '4px'
                }}
              >
                API Polling Timeout (minutes)
              </label>
              <div style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: '1.4',
                maxWidth: '400px',
                marginBottom: '8px'
              }}>
                Maximum time to wait for task completion before giving up.
              </div>
              <input
                id="polling-timeout-seconds"
                type="number"
                min="5"
                max="1440"
                step="5"
                value={Math.floor(pollingTimeoutSeconds / 60)}
                onChange={(e) => {
                  const minutes = Math.max(5, Math.min(1440, Number(e.target.value)));
                  const seconds = minutes * 60;
                  setPollingTimeoutSeconds(seconds);
                  handleInstantSave('pollingTimeoutSeconds', seconds);
                }}
                disabled={isLoading}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  backgroundColor: 'var(--bg-secondary)',
                  width: '120px'
                }}
                placeholder="120"
              />
              <span style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                marginLeft: '8px'
              }}>
                Default: 120 minutes (2 hours)
              </span>
            </div>
          </div>

          {/* Audio Language Detection Time Setting */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '8px 0'
          }}>
            <div style={{ flex: 1 }}>
              <label
                htmlFor="audio-language-detection-time"
                style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'block',
                  marginBottom: '4px'
                }}
              >
                Audio Language Detection Duration
              </label>
              <div style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: '1.4',
                maxWidth: '400px',
                marginBottom: '12px'
              }}>
                Time span used for detecting the language of spoken audio. Longer durations provide more accurate detection but require more processing time.
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '8px'
              }}>
                <div style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: 'var(--text-primary)',
                  minWidth: '80px'
                }}>
                  {Math.floor(audioLanguageDetectionTime / 60)}:{(audioLanguageDetectionTime % 60).toString().padStart(2, '0')}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: '#666'
                }}>
                  ({audioLanguageDetectionTime} seconds)
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '12px', color: '#666', minWidth: '30px' }}>1:00</span>
                <input
                  type="range"
                  id="audio-language-detection-time"
                  min="60"
                  max="300"
                  step="30"
                  value={audioLanguageDetectionTime}
                  onChange={(e) => handleAudioLanguageDetectionTimeChange(Number(e.target.value))}
                  disabled={isLoading}
                  style={{
                    flex: 1,
                    height: '6px',
                    borderRadius: '3px',
                    background: `linear-gradient(to right, #007bff 0%, #007bff ${((audioLanguageDetectionTime - 60) / (300 - 60)) * 100}%, #ddd ${((audioLanguageDetectionTime - 60) / (300 - 60)) * 100}%, #ddd 100%)`,
                    outline: 'none',
                    cursor: isLoading ? 'not-allowed' : 'pointer'
                  }}
                />
                <span style={{ fontSize: '12px', color: '#666', minWidth: '30px' }}>5:00</span>
              </div>

              <div style={{
                fontSize: '11px',
                color: '#999',
                marginTop: '6px',
                fontStyle: 'italic'
              }}>
                Default: 4:00 (240 seconds) • Range: 1:00 - 5:00
              </div>
            </div>
          </div>

          {/* Auto Language Detection Setting */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '8px 0'
          }}>
            <div style={{ flex: 1 }}>
              <label
                htmlFor="auto-language-detection"
                style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'block',
                  marginBottom: '4px'
                }}
              >
                Auto Language Detection for Audio/Video Files
              </label>
              <div style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: '1.4',
                maxWidth: '400px',
                marginBottom: '12px'
              }}>
                Automatically detect the language of audio and video files when added to the batch processing queue. Subtitle files (.srt, .vtt, etc.) will always be auto-detected regardless of this setting. When disabled for audio/video files, you can manually trigger language detection.
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <input
                  type="checkbox"
                  id="auto-language-detection"
                  checked={autoLanguageDetection}
                  onChange={(e) => {
                    const newValue = e.target.checked;
                    setAutoLanguageDetection(newValue);
                    handleInstantSave('autoLanguageDetection', newValue);
                  }}
                  disabled={isLoading}
                  style={{
                    width: '16px',
                    height: '16px',
                    cursor: isLoading ? 'not-allowed' : 'pointer'
                  }}
                />
                <span style={{
                  fontSize: '14px',
                  color: autoLanguageDetection ? '#28a745' : '#6c757d',
                  fontWeight: '500'
                }}>
                  {autoLanguageDetection ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              <div style={{
                fontSize: '11px',
                color: '#999',
                marginTop: '6px',
                fontStyle: 'italic'
              }}>
                Default: Enabled • Note: This setting only affects batch processing, not single file processing
              </div>
            </div>
          </div>

          {/* Default Filename Format Setting */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            padding: '8px 0'
          }}>
            <div style={{ flex: 1 }}>
              <label
                htmlFor="default-filename-format"
                style={{
                  margin: 0,
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'block',
                  marginBottom: '4px'
                }}
              >
                Default Filename Format
              </label>
              <div style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                lineHeight: '1.4',
                maxWidth: '500px',
                marginBottom: '12px'
              }}>
                Pattern for naming output files. Available placeholders: <code>{'{filename}'}</code>, <code>{'{timestamp}'}</code>, <code>{'{type}'}</code>, <code>{'{format}'}</code>, <code>{'{language_code}'}</code>, <code>{'{language_name}'}</code>, <code>{'{extension}'}</code>
                <br />
                <strong>Example:</strong> <code>movie.en.transcription.srt</code>
              </div>

              <input
                type="text"
                id="default-filename-format"
                value={defaultFilenameFormat}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setDefaultFilenameFormat(newValue);
                  handleInstantSave('defaultFilenameFormat', newValue);
                }}
                disabled={isLoading}
                placeholder="{filename}.{language_code}.{type}{extension}"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  fontSize: '13px',
                  fontFamily: 'monospace',
                  backgroundColor: 'var(--bg-secondary)',
                  color: 'var(--text-primary)',
                  cursor: isLoading ? 'not-allowed' : 'text'
                }}
              />

              {/* Placeholder Buttons */}
              <div style={{
                marginTop: '10px',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px'
              }}>
                {[
                  { placeholder: '{filename}', label: 'Filename' },
                  { placeholder: '{language_code}', label: 'Language Code' },
                  { placeholder: '{language_name}', label: 'Language Name' },
                  { placeholder: '{type}', label: 'Type' },
                  { placeholder: '{format}', label: 'Format' },
                  { placeholder: '{timestamp}', label: 'Timestamp' },
                  { placeholder: '{extension}', label: 'Extension' }
                ].map(({ placeholder, label }) => (
                  <button
                    key={placeholder}
                    type="button"
                    onClick={() => {
                      const input = document.getElementById('default-filename-format') as HTMLInputElement;
                      if (input) {
                        const start = input.selectionStart || 0;
                        const end = input.selectionEnd || 0;
                        const newValue = defaultFilenameFormat.slice(0, start) + placeholder + defaultFilenameFormat.slice(end);
                        setDefaultFilenameFormat(newValue);
                        handleInstantSave('defaultFilenameFormat', newValue);
                        // Set cursor position after the inserted placeholder
                        setTimeout(() => {
                          input.focus();
                          input.setSelectionRange(start + placeholder.length, start + placeholder.length);
                        }, 0);
                      }
                    }}
                    style={{
                      padding: '4px 8px',
                      fontSize: '11px',
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--button-bg)';
                      e.currentTarget.style.color = 'var(--button-text)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Live Preview */}
              <div style={{
                marginTop: '10px',
                padding: '8px 12px',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                fontSize: '12px'
              }}>
                <div style={{
                  color: 'var(--text-secondary)',
                  marginBottom: '4px',
                  fontSize: '11px'
                }}>
                  Preview:
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  color: 'var(--text-primary)',
                  fontWeight: '500'
                }}>
                  {(() => {
                    const sampleData = {
                      filename: 'movie',
                      language_code: 'en',
                      language_name: 'English',
                      type: 'transcription',
                      format: 'srt',
                      extension: 'srt',
                      timestamp: '2025-09-30T14-30-15'
                    };

                    let preview = defaultFilenameFormat;
                    Object.entries(sampleData).forEach(([key, value]) => {
                      preview = preview.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
                    });

                    return preview || 'Enter a format above';
                  })()}
                </div>
              </div>

              <div style={{
                fontSize: '11px',
                color: '#999',
                marginTop: '6px',
                fontStyle: 'italic'
              }}>
                Default: {'{filename}.{language_code}.{type}.{extension}'} • Use dots as separators
              </div>
            </div>
          </div>
        </div>

        {/* System Integration Section Divider */}
        <div style={{
          margin: '30px 0',
          height: '1px',
          background: 'linear-gradient(to right, transparent, var(--border-color) 20%, var(--border-color) 80%, transparent)',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            top: '-10px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--bg-primary)',
            padding: '0 15px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            <i className="fas fa-puzzle-piece" style={{marginRight: '6px'}}></i>
            System Integration
          </div>
        </div>

        {/* FFmpeg Configuration */}
        <div className="form-group">
          <div style={{
            padding: '20px',
            backgroundColor: 'var(--bg-tertiary)',
            border: '2px solid var(--border-color)',
            borderRadius: '6px',
            marginBottom: '15px'
          }}>
            <h3 style={{ marginBottom: '12px', fontSize: '16px', color: 'var(--text-primary)', fontWeight: 'bold' }}>FFmpeg Configuration</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: '1.4' }}>
              FFmpeg is required for media processing. Leave blank to use automatic detection, or specify a custom path if auto-detection fails.
            </p>
            
            <div style={{ marginBottom: '15px' }}>
              <label
                htmlFor="ffmpeg-path"
                style={{
                  display: 'block',
                  marginBottom: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'var(--text-primary)'
                }}
              >
                Custom FFmpeg Path (optional)
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexDirection: 'column' }}>
                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  <input
                    type="text"
                    id="ffmpeg-path"
                    value={ffmpegPath}
                    onChange={(e) => {
                      const newValue = e.target.value;
                      setFfmpegPath(newValue);
                      setFfmpegTestResult(null);
                      handleInstantSave('ffmpegPath', newValue);
                    }}
                    disabled={isLoading}
                    placeholder="e.g., /usr/local/bin/ffmpeg or /opt/homebrew/bin/ffmpeg"
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      border: '1px solid var(--input-border)',
                      borderRadius: '4px',
                      fontSize: '14px',
                      fontFamily: 'monospace',
                      backgroundColor: 'var(--input-bg)',
                      color: 'var(--text-primary)'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleBrowseForFfmpeg}
                    disabled={isLoading}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#6c757d',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: isLoading ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    Browse
                  </button>
                </div>
                
                <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
                  <button
                    type="button"
                    onClick={handleTestFfmpeg}
                    disabled={isTestingFfmpeg || isLoading}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      cursor: (isTestingFfmpeg || isLoading) ? 'not-allowed' : 'pointer',
                      opacity: (isTestingFfmpeg || isLoading) ? 0.6 : 1
                    }}
                  >
                    {isTestingFfmpeg ? 'Testing...' : 'Test FFmpeg'}
                  </button>
                  
                  {ffmpegPath && (
                    <button
                      type="button"
                      onClick={() => {
                        setFfmpegPath('');
                        setFfmpegTestResult(null);
                        handleInstantSave('ffmpegPath', '');
                      }}
                      disabled={isLoading}
                      style={{
                        padding: '8px 12px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        fontSize: '12px',
                        cursor: isLoading ? 'not-allowed' : 'pointer'
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
              
              {ffmpegTestResult && (
                <div style={{
                  marginTop: '10px',
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  backgroundColor: ffmpegTestResult.success ? '#d4edda' : '#f8d7da',
                  color: ffmpegTestResult.success ? '#155724' : '#721c24',
                  border: `1px solid ${ffmpegTestResult.success ? '#c3e6cb' : '#f5c6cb'}`
                }}>
                  <i className={`fas ${ffmpegTestResult.success ? 'fa-check-circle text-success' : 'fa-times-circle text-danger'}`}></i> {ffmpegTestResult.message}
                </div>
              )}
            </div>
            
            <div style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              lineHeight: '1.4'
            }}>
              <strong>macOS users:</strong> If FFmpeg is not found automatically, try installing it with:
              <div style={{
                backgroundColor: 'var(--bg-secondary)',
                padding: '8px',
                borderRadius: '4px',
                fontFamily: 'monospace',
                margin: '8px 0',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)'
              }}>
                brew install ffmpeg
              </div>
              Then restart the application or specify the path manually.
            </div>
          </div>
        </div>

        {/* File Associations Section */}
        <div className="form-group">
          <div style={{
            padding: '20px',
            backgroundColor: 'var(--bg-tertiary)',
            border: '2px solid var(--border-color)',
            borderRadius: '6px',
            marginBottom: '15px',
            marginTop: '15px'
          }}>
            <h3 style={{ marginBottom: '12px', fontSize: '16px', color: 'var(--text-primary)', fontWeight: 'bold' }}>File Type Associations</h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', marginBottom: '18px', lineHeight: '1.4' }}>
              Register the app to handle media files so you can right-click any supported file and "Open with" this application.
            </p>
            
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '12px',
              marginBottom: '15px'
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: fileAssociationStatus.registered ? '#28a745' : '#dc3545',
                flexShrink: 0
              }} />
              <span style={{
                fontSize: '14px',
                color: 'var(--text-primary)',
                fontWeight: '500'
              }}>
                {isCheckingAssociations ? (
                  'Checking status...'
                ) : fileAssociationStatus.registered ? (
                  <><i className="fas fa-check-circle text-success"></i> Registered for {fileAssociationStatus.associatedFormats.length} file types</>
                ) : (
                  <><i className="fas fa-times-circle text-danger"></i> Not registered as default handler</>
                )}
              </span>
            </div>
            
            {fileAssociationStatus.registered && fileAssociationStatus.associatedFormats.length > 0 && (
              <div style={{
                fontSize: '12px',
                color: 'var(--text-secondary)',
                marginBottom: '15px',
                padding: '8px',
                backgroundColor: '#e8f5e8',
                borderRadius: '4px',
                maxHeight: '60px',
                overflowY: 'auto'
              }}>
                <strong>Associated formats:</strong> {fileAssociationStatus.associatedFormats.join(', ')}
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                onClick={handleRegisterFileTypes}
                disabled={isRegisteringAssociations || isLoading}
                style={{
                  backgroundColor: '#007bff',
                  borderColor: '#007bff',
                  color: 'white',
                  padding: '8px 16px',
                  border: '2px solid',
                  borderRadius: '5px',
                  cursor: (isRegisteringAssociations || isLoading) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                  opacity: (isRegisteringAssociations || isLoading) ? 0.6 : 1
                }}
                onMouseOver={(e) => {
                  if (!isRegisteringAssociations && !isLoading) {
                    e.currentTarget.style.backgroundColor = '#0056b3';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isRegisteringAssociations && !isLoading) {
                    e.currentTarget.style.backgroundColor = '#007bff';
                  }
                }}
              >
                {isRegisteringAssociations ? 'Registering...' : 'Register File Types'}
              </button>
              
              <button
                type="button"
                onClick={checkFileAssociationStatus}
                disabled={isCheckingAssociations || isLoading}
                style={{
                  backgroundColor: 'transparent',
                  borderColor: 'var(--text-secondary)',
                  color: 'var(--text-secondary)',
                  padding: '8px 16px',
                  border: '2px solid',
                  borderRadius: '5px',
                  cursor: (isCheckingAssociations || isLoading) ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  transition: 'all 0.2s ease',
                  opacity: (isCheckingAssociations || isLoading) ? 0.6 : 1
                }}
                onMouseOver={(e) => {
                  if (!isCheckingAssociations && !isLoading) {
                    e.currentTarget.style.backgroundColor = 'var(--text-secondary)';
                    e.currentTarget.style.color = 'var(--bg-primary)';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isCheckingAssociations && !isLoading) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                {isCheckingAssociations ? 'Checking...' : 'Refresh Status'}
              </button>
            </div>
            
            <div style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              marginTop: '10px',
              lineHeight: '1.4'
            }}>
              <i className="fas fa-lightbulb"></i> <strong>Note:</strong> On Windows/Linux, you may need to run as administrator/root for system-wide file associations.
            </div>
          </div>
        </div>

        {/* Visual divider */}
        <div style={{
          margin: '30px 0',
          height: '1px',
          background: 'linear-gradient(to right, transparent, var(--border-color) 20%, var(--border-color) 80%, transparent)',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            top: '-10px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--bg-primary)',
            padding: '0 15px',
            fontSize: '12px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            Danger Zone
          </div>
        </div>

        {/* Beta Test Section */}
        <div className="form-group">
          <div style={{
            padding: '20px',
            backgroundColor: 'var(--warning-bg)',
            border: '2px solid var(--warning-border)',
            borderRadius: '6px',
            marginBottom: '15px'
          }}>
            <h3 style={{ marginBottom: '12px', fontSize: '16px', color: 'var(--warning-text)', fontWeight: 'bold' }}>Beta Testing</h3>
            <label style={{ 
              display: 'flex !important', 
              alignItems: 'center', 
              cursor: 'pointer',
              justifyContent: 'flex-start',
              textAlign: 'left'
            }}>
              <input
                type="checkbox"
                checked={betaTest}
                onChange={(e) => {
                  const newValue = e.target.checked;
                  setBetaTest(newValue);
                  handleInstantSave('betaTest', newValue);
                }}
                style={{ 
                  marginRight: '10px',
                  width: 'auto',
                  flexShrink: 0
                }}
              />
              <span style={{ fontSize: '14px', color: 'var(--warning-text)', textAlign: 'left' }}>
                Enable beta testing features and updates
              </span>
            </label>
            <p style={{ fontSize: '12px', color: 'var(--warning-text)', marginTop: '8px', lineHeight: '1.4', opacity: 0.8 }}>
              Receive prerelease versions and experimental features. May contain bugs.
            </p>
          </div>
        </div>

        {/* Reset Settings Section */}
        <div className="form-group">
          <div style={{
            padding: '20px',
            backgroundColor: 'var(--danger-bg)',
            border: '2px solid var(--danger-border)',
            borderRadius: '6px',
            marginBottom: '15px'
          }}>
            <h3 style={{ marginBottom: '12px', fontSize: '16px', color: 'var(--danger-text)', fontWeight: 'bold' }}>Reset Settings</h3>
            <p style={{ fontSize: '14px', color: 'var(--danger-text)', marginBottom: '18px', lineHeight: '1.4', opacity: 0.8 }}>
              This will permanently clear all your login credentials and preferences. Use this to test the fresh install experience or when switching to a different OpenSubtitles account.
            </p>
            <button
              type="button"
              onClick={handleResetSettings}
              disabled={isLoading}
              style={{
                backgroundColor: '#e53e3e',
                borderColor: '#c53030',
                color: 'white',
                padding: '10px 20px',
                border: '2px solid',
                borderRadius: '5px',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '600',
                transition: 'all 0.2s ease',
                opacity: isLoading ? 0.6 : 1
              }}
              onMouseOver={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.backgroundColor = '#c53030';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(197, 48, 48, 0.3)';
                }
              }}
              onMouseOut={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.backgroundColor = '#e53e3e';
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              Reset All Settings
            </button>
          </div>
        </div>
      </form>
      </div>
    </>
  );
}

export default Preferences;