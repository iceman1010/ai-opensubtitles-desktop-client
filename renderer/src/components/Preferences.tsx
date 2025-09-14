import React, { useState, useEffect } from 'react';
import CacheManager from '../services/cache';

interface AppConfig {
  username: string;
  password: string;
  apiKey?: string;
  lastUsedLanguage?: string;
  debugMode?: boolean;
  checkUpdatesOnStart?: boolean;
  autoRemoveCompletedFiles?: boolean;
  cacheExpirationHours?: number;
  betaTest?: boolean;
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
  const [checkUpdatesOnStart, setCheckUpdatesOnStart] = useState(config.checkUpdatesOnStart ?? true);
  const [autoRemoveCompletedFiles, setAutoRemoveCompletedFiles] = useState(config.autoRemoveCompletedFiles ?? false);
  const [cacheExpirationHours, setCacheExpirationHours] = useState(config.cacheExpirationHours ?? 24);
  const [betaTest, setBetaTest] = useState(config.betaTest ?? false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileAssociationStatus, setFileAssociationStatus] = useState<{registered: boolean, associatedFormats: string[]}>({ registered: false, associatedFormats: [] });
  const [isCheckingAssociations, setIsCheckingAssociations] = useState(false);
  const [isRegisteringAssociations, setIsRegisteringAssociations] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);



  const handleResetSettings = async () => {
    if (window.confirm('Are you sure you want to reset all settings? This will clear your login credentials and all preferences. This action cannot be undone.')) {
      try {
        console.log('=== FRONTEND RESET DEBUG ===');
        console.log('Calling resetAllSettings...');
        const success = await window.electronAPI.resetAllSettings();
        console.log('resetAllSettings returned:', success);
        console.log('Success type:', typeof success);
        
        if (success) {
          console.log('Reset successful, updating UI...');
          // Reset local state to match cleared config
          setUsername('');
          setPassword('');
          setApiKey('');
          setDebugMode(false);
          setCheckUpdatesOnStart(true);
          setAutoRemoveCompletedFiles(false);
          setError('');
          alert('All settings have been reset successfully.');
        } else {
          console.log('Reset failed, showing error...');
          setError('Failed to reset settings. Please try again.');
        }
        console.log('=== END FRONTEND RESET DEBUG ===');
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
        alert(`✅ ${result.message}`);
        // Refresh status after successful registration
        await checkFileAssociationStatus();
      } else {
        alert(`❌ ${result.message}`);
      }
    } catch (error) {
      console.error('Failed to register file associations:', error);
      alert('❌ Failed to register file types. Please try running the application as administrator/root.');
    } finally {
      setIsRegisteringAssociations(false);
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
      const success = await onSave({ username, password, apiKey, debugMode, checkUpdatesOnStart, autoRemoveCompletedFiles, cacheExpirationHours, betaTest });
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
            type="text"
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
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            padding: '8px 0'
          }}>
            <input
              type="checkbox"
              id="auto-remove-completed-files"
              checked={autoRemoveCompletedFiles}
              onChange={(e) => setAutoRemoveCompletedFiles(e.target.checked)}
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
                color: '#666', 
                lineHeight: '1.4',
                maxWidth: '400px'
              }}>
                Automatically remove files from the batch queue after successful processing.
              </div>
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
                color: '#666', 
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
                  onChange={(e) => setCacheExpirationHours(Number(e.target.value))}
                  disabled={isLoading}
                  style={{
                    padding: '8px 12px',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    fontSize: '14px',
                    backgroundColor: '#fff',
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
        </div>

        <div className="button-group">
          <button
            type="submit"
            className="button"
            disabled={isLoading || !username || !password || !apiKey}
          >
            {isLoading ? 'Saving...' : 'Save'}
          </button>
        </div>
        
        {/* File Associations Section */}
        <div className="form-group">
          <div style={{
            padding: '20px',
            backgroundColor: '#f8f9fa',
            border: '2px solid #e9ecef',
            borderRadius: '6px',
            marginBottom: '15px',
            marginTop: '15px'
          }}>
            <h3 style={{ marginBottom: '12px', fontSize: '16px', color: '#495057', fontWeight: 'bold' }}>File Type Associations</h3>
            <p style={{ fontSize: '14px', color: '#6c757d', marginBottom: '18px', lineHeight: '1.4' }}>
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
                color: '#495057',
                fontWeight: '500'
              }}>
                {isCheckingAssociations ? (
                  'Checking status...'
                ) : fileAssociationStatus.registered ? (
                  `✅ Registered for ${fileAssociationStatus.associatedFormats.length} file types`
                ) : (
                  '❌ Not registered as default handler'
                )}
              </span>
            </div>
            
            {fileAssociationStatus.registered && fileAssociationStatus.associatedFormats.length > 0 && (
              <div style={{
                fontSize: '12px',
                color: '#6c757d',
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
                  borderColor: '#6c757d',
                  color: '#6c757d',
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
                    e.currentTarget.style.backgroundColor = '#6c757d';
                    e.currentTarget.style.color = 'white';
                  }
                }}
                onMouseOut={(e) => {
                  if (!isCheckingAssociations && !isLoading) {
                    e.currentTarget.style.backgroundColor = 'transparent';
                    e.currentTarget.style.color = '#6c757d';
                  }
                }}
              >
                {isCheckingAssociations ? 'Checking...' : 'Refresh Status'}
              </button>
            </div>
            
            <div style={{
              fontSize: '12px',
              color: '#6c757d',
              marginTop: '10px',
              lineHeight: '1.4'
            }}>
              💡 <strong>Note:</strong> On Windows/Linux, you may need to run as administrator/root for system-wide file associations.
            </div>
          </div>
        </div>

        {/* Visual divider */}
        <div style={{
          margin: '30px 0',
          height: '1px',
          background: 'linear-gradient(to right, transparent, #ddd 20%, #ddd 80%, transparent)',
          position: 'relative'
        }}>
          <div style={{
            position: 'absolute',
            top: '-10px',
            left: '50%',
            transform: 'translateX(-50%)',
            backgroundColor: '#f5f5f5',
            padding: '0 15px',
            fontSize: '12px',
            color: '#999',
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
            backgroundColor: '#fff8e1',
            border: '2px solid #ffd54f',
            borderRadius: '6px',
            marginBottom: '15px'
          }}>
            <h3 style={{ marginBottom: '12px', fontSize: '16px', color: '#f57f17', fontWeight: 'bold' }}>Beta Testing</h3>
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
                onChange={(e) => setBetaTest(e.target.checked)}
                style={{ 
                  marginRight: '10px',
                  width: 'auto',
                  flexShrink: 0
                }}
              />
              <span style={{ fontSize: '14px', color: '#e65100', textAlign: 'left' }}>
                Enable beta testing features and updates
              </span>
            </label>
            <p style={{ fontSize: '12px', color: '#ef6c00', marginTop: '8px', lineHeight: '1.4' }}>
              Receive prerelease versions and experimental features. May contain bugs.
            </p>
          </div>
        </div>

        {/* Reset Settings Section */}
        <div className="form-group">
          <div style={{
            padding: '20px',
            backgroundColor: '#fff5f5',
            border: '2px solid #fed7d7',
            borderRadius: '6px',
            marginBottom: '15px'
          }}>
            <h3 style={{ marginBottom: '12px', fontSize: '16px', color: '#c53030', fontWeight: 'bold' }}>Reset Settings</h3>
            <p style={{ fontSize: '14px', color: '#742a2a', marginBottom: '18px', lineHeight: '1.4' }}>
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