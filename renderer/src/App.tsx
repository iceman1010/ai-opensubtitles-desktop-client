import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import MainScreen from './components/MainScreen';
import BatchScreen from './components/BatchScreen';
import Preferences from './components/Preferences';
import Update from './components/Update';
import Info from './components/Info';
import Credits from './components/Credits';
import Help from './components/Help';
import StatusBar from './components/StatusBar';
import ErrorLogControls from './components/ErrorLogControls';
import { APIProvider, useAPI } from './contexts/APIContext';
import './utils/errorLogger'; // Initialize global error handlers
import appConfig from './config/appConfig.json';
import packageInfo from '../../package.json';
import logoImage from './assets/logo.png';

interface AppConfig {
  username: string;
  password: string;
  apiKey?: string;
  lastUsedLanguage?: string;
  debugMode?: boolean;
  checkUpdatesOnStart?: boolean;
  cacheExpirationHours?: number;
  credits?: {
    used: number;
    remaining: number;
  };
}

// Main App component wrapped with API context
function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      const loadedConfig = await window.electronAPI.getConfig();
      setConfig(loadedConfig);
    } catch (error) {
      console.error('Failed to load config:', error);
      setConfig({} as AppConfig); // Empty config will show login
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="app">
        <div className="main-content">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Determine if we have valid credentials
  const hasCredentials = config?.username && config?.password && config?.apiKey;

  return (
    <APIProvider 
      initialConfig={hasCredentials ? {
        username: config.username,
        password: config.password,
        apiKey: config.apiKey
      } : undefined}
    >
      <AppContent 
        config={config} 
        setConfig={setConfig}
        hasCredentials={!!hasCredentials}
        isLoading={isLoading}
      />
    </APIProvider>
  );
}

// Inner component that uses the API context
function AppContent({ 
  config, 
  setConfig, 
  hasCredentials,
  isLoading
}: { 
  config: AppConfig | null; 
  setConfig: (config: AppConfig) => void;
  hasCredentials: boolean;
  isLoading: boolean;
}) {
  const { 
    isAuthenticated, 
    credits, 
    isLoading: apiLoading, 
    error: apiError,
    login,
    updateCredits
  } = useAPI();

  const [currentScreen, setCurrentScreen] = useState<'login' | 'main' | 'batch' | 'preferences' | 'update' | 'info' | 'credits' | 'help'>('main');
  const [pendingBatchFiles, setPendingBatchFiles] = useState<string[]>([]);
  const [pendingMainFile, setPendingMainFile] = useState<string | null>(null);
  
  // Centralized status state
  const [isNetworkOnline, setIsNetworkOnline] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTask, setCurrentTask] = useState<string | undefined>(undefined);

  // Set initial screen based on authentication state
  useEffect(() => {
    if (!hasCredentials || !isAuthenticated) {
      setCurrentScreen('login');
    } else {
      setCurrentScreen('main');
    }
  }, [hasCredentials, isAuthenticated]);

  useEffect(() => {
    // Set up keyboard shortcut listener
    const handleKeyboardShortcut = (event: any, shortcut: string) => {
      switch (shortcut) {
        case 'help':
          setCurrentScreen('help');
          break;
        case 'navigate-main':
          setCurrentScreen('main');
          break;
        case 'navigate-batch':
          setCurrentScreen('batch');
          break;
        case 'navigate-info':
          setCurrentScreen('info');
          break;
        case 'navigate-credits':
          setCurrentScreen('credits');
          break;
        case 'navigate-preferences':
          setCurrentScreen('preferences');
          break;
        case 'navigate-update':
          setCurrentScreen('update');
          break;
      }
    };

    window.electronAPI.onKeyboardShortcut(handleKeyboardShortcut);

    return () => {
      window.electronAPI.removeKeyboardShortcutListener(handleKeyboardShortcut);
    };
  }, []);

  // Handle external file opening (from file associations or command line)
  useEffect(() => {
    // Handle single file opening - route to Single File screen
    const handleExternalFile = (event: any, filePath: string) => {
      console.log('App: Received single external file:', filePath);
      setCurrentScreen('main');
      // Set the file for MainScreen to pick up
      setPendingMainFile(filePath);
    };

    // Handle multiple files opening - route to Batch screen
    const handleExternalFiles = (event: any, filePaths: string[]) => {
      console.log(`App: Received ${filePaths.length} external files:`, filePaths);
      setCurrentScreen('batch');
      // Set files for batch screen to pick up
      setPendingBatchFiles(filePaths);
    };

    // Listen for external file events
    window.electronAPI?.onExternalFileOpen?.(handleExternalFile);
    window.electronAPI?.onExternalFilesOpen?.(handleExternalFiles);

    // Cleanup listeners on unmount
    return () => {
      window.electronAPI?.removeExternalFileListener?.(handleExternalFile);
      window.electronAPI?.removeExternalFilesListener?.(handleExternalFiles);
    };
  }, []);

  const handleLogin = async (username: string, password: string, apiKey: string): Promise<boolean> => {
    try {
      setAppProcessing(true, 'Validating credentials...');
      
      // Use centralized login from API context
      const success = await login(username, password, apiKey);
      
      if (success) {
        // Save config if login was successful
        const configSuccess = await window.electronAPI.saveConfig({ username, password, apiKey });
        if (configSuccess) {
          const updatedConfig = await window.electronAPI.getConfig();
          setConfig(updatedConfig);
          setCurrentScreen('main');
          return true;
        }
      }
      
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    } finally {
      setAppProcessing(false);
    }
  };

  const handleCreditsUpdate = (creditsData: { used: number; remaining: number }) => {
    // Update credits in centralized context
    updateCredits(creditsData);
    
    // Also update local config for backwards compatibility
    setConfig(prevConfig => {
      if (!prevConfig) return prevConfig;
      return {
        ...prevConfig,
        credits: creditsData
      };
    });
  };

  const handlePreferencesSave = async (newConfig: Partial<AppConfig>): Promise<boolean> => {
    try {
      setAppProcessing(true, 'Validating credentials...');
      
      // If username, password, or apiKey are being changed, validate them using centralized login
      if (newConfig.username || newConfig.password || newConfig.apiKey) {
        // Use the new values if provided, otherwise use current config values
        const username = newConfig.username || config?.username || '';
        const password = newConfig.password || config?.password || '';
        const apiKey = newConfig.apiKey || config?.apiKey || '';
        
        // Use centralized login for validation
        const success = await login(username, password, apiKey);
        if (!success) {
          console.error('Credential validation failed');
          return false;
        }
      }
      
      // If validation passed, save the config
      const success = await window.electronAPI.saveConfig(newConfig);
      if (success) {
        const updatedConfig = await window.electronAPI.getConfig();
        setConfig(updatedConfig);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to save preferences:', error);
      return false;
    } finally {
      setAppProcessing(false);
    }
  };

  // Centralized status handlers
  const handleNetworkChange = (isOnline: boolean) => {
    setIsNetworkOnline(isOnline);
  };

  const setAppProcessing = (processing: boolean, task?: string) => {
    setIsProcessing(processing);
    setCurrentTask(processing ? task : undefined);
  };

  const handleScreenChange = (screen: typeof currentScreen) => {
    setCurrentScreen(screen);
    // Reset scroll position to top when changing screens
    setTimeout(() => {
      const mainContentElement = document.querySelector('.main-content');
      if (mainContentElement) {
        mainContentElement.scrollTop = 0;
      }
      // Also reset body/window scroll as fallback
      window.scrollTo(0, 0);
    }, 0);
  };

  if (isLoading) {
    return (
      <div className="app">
        <div className="main-content">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      {currentScreen !== 'login' && (
        <div className="sidebar">
          <h2>{appConfig.name}</h2>
          <nav>
            <ul>
              <li>
                <button
                  className={currentScreen === 'main' ? 'active' : ''}
                  onClick={() => handleScreenChange('main')}
                >
                  Single File
                </button>
              </li>
              <li>
                <button
                  className={currentScreen === 'batch' ? 'active' : ''}
                  onClick={() => handleScreenChange('batch')}
                >
                  Batch
                </button>
              </li>
              <li>
                <button
                  className={currentScreen === 'info' ? 'active' : ''}
                  onClick={() => handleScreenChange('info')}
                >
                  Info
                </button>
              </li>
              <li>
                <button
                  className={currentScreen === 'credits' ? 'active' : ''}
                  onClick={() => handleScreenChange('credits')}
                >
                  Credits
                </button>
              </li>
              <li>
                <button
                  className={currentScreen === 'preferences' ? 'active' : ''}
                  onClick={() => handleScreenChange('preferences')}
                >
                  Preferences
                </button>
              </li>
              <li>
                <button
                  className={currentScreen === 'update' ? 'active' : ''}
                  onClick={() => handleScreenChange('update')}
                >
                  Update
                </button>
              </li>
              <li>
                <button
                  className={currentScreen === 'help' ? 'active' : ''}
                  onClick={() => handleScreenChange('help')}
                >
                  Help
                </button>
              </li>
            </ul>
          </nav>
          
          {/* Logo positioned above version display at bottom of sidebar */}
          <div 
            className="sidebar-logo" 
            style={{ 
              position: 'absolute',
              bottom: '75px', // 45px (version position) + 20px (logo height) + 10px (gap)
              left: '50%',
              transform: 'translateX(-50%)',
              textAlign: 'center',
              padding: '0 10px',
              width: 'calc(100% - 40px)' // Account for sidebar padding
            }}
          >
            <img 
              src={logoImage} 
              alt="Logo" 
              style={{
                width: '100%',
                maxWidth: '60px', // Smaller size for bottom positioning
                height: 'auto',
                borderRadius: '50%'
              }}
            />
          </div>
          
          {/* Version display at bottom of sidebar */}
          <div className="sidebar-version">
            v{packageInfo.version}
          </div>
        </div>
      )}

      <div className="main-content">
        {currentScreen === 'login' && (
          <Login 
            onLogin={handleLogin} 
            setAppProcessing={setAppProcessing}
          />
        )}
        <div style={{ display: currentScreen === 'main' ? 'block' : 'none' }}>
          {config && (
            <MainScreen 
              config={config} 
              setAppProcessing={setAppProcessing}
              onNavigateToCredits={() => setCurrentScreen('credits')}
              onNavigateToBatch={(filePaths?: string[]) => {
                if (filePaths) {
                  setPendingBatchFiles(filePaths);
                }
                setCurrentScreen('batch');
              }}
              pendingExternalFile={pendingMainFile}
              onExternalFileProcessed={() => setPendingMainFile(null)}
              onCreditsUpdate={handleCreditsUpdate}
            />
          )}
        </div>
        <div style={{ display: currentScreen === 'batch' ? 'block' : 'none' }}>
          {config && (
            <BatchScreen 
              config={config} 
              setAppProcessing={setAppProcessing}
              pendingFiles={pendingBatchFiles}
              onFilesPending={() => setPendingBatchFiles([])}
            />
          )}
        </div>
        <div style={{ display: currentScreen === 'info' ? 'block' : 'none' }}>
          {config && (
            <Info 
              config={config} 
              setAppProcessing={setAppProcessing}
            />
          )}
        </div>
        <div style={{ display: currentScreen === 'credits' ? 'block' : 'none' }}>
          {config && (
            <Credits 
              config={config} 
              setAppProcessing={setAppProcessing}
            />
          )}
        </div>
        <div style={{ display: currentScreen === 'preferences' ? 'block' : 'none' }}>
          {config && (
            <Preferences
              config={config}
              onSave={handlePreferencesSave}
              setAppProcessing={setAppProcessing}
            />
          )}
        </div>
        <div style={{ display: currentScreen === 'update' ? 'block' : 'none' }}>
          <Update />
        </div>
        <div style={{ display: currentScreen === 'help' ? 'block' : 'none' }}>
          <Help />
        </div>
      </div>

      {/* Floating Credits Display */}
      {credits && currentScreen !== 'login' && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: 'rgba(255, 255, 255, 0.95)',
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '8px 12px',
          fontSize: '14px',
          fontWeight: '500',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          zIndex: 1000,
          color: '#333'
        }}>
          💳 Credits: <strong>{credits.remaining}</strong>
        </div>
      )}

      {/* Centralized StatusBar - always full width */}
      <StatusBar
        onNetworkChange={handleNetworkChange}
        isProcessing={isProcessing}
        currentTask={currentTask}
      />

      {/* Global Error Log Controls */}
      <ErrorLogControls />
    </div>
  );
}

export default App;