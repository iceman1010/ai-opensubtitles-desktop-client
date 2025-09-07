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
  credits?: {
    used: number;
    remaining: number;
  };
}

function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [currentScreen, setCurrentScreen] = useState<'login' | 'main' | 'batch' | 'preferences' | 'update' | 'info' | 'credits' | 'help'>('main');
  const [isLoading, setIsLoading] = useState(true);
  const [pendingBatchFiles, setPendingBatchFiles] = useState<string[]>([]);
  const [pendingMainFile, setPendingMainFile] = useState<string | null>(null);
  
  // Centralized status state
  const [isNetworkOnline, setIsNetworkOnline] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTask, setCurrentTask] = useState<string | undefined>(undefined);

  useEffect(() => {
    loadConfig();
    
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

  const loadConfig = async () => {
    try {
      const loadedConfig = await window.electronAPI.getConfig();
      setConfig(loadedConfig);
      
      if (!loadedConfig.username || !loadedConfig.password || !loadedConfig.apiKey) {
        setCurrentScreen('login');
      } else {
        setCurrentScreen('main');
      }
    } catch (error) {
      console.error('Failed to load config:', error);
      setCurrentScreen('login');
    } finally {
      setIsLoading(false);
    }
  };


  const handleLogin = async (username: string, password: string, apiKey: string): Promise<boolean> => {
    try {
      setAppProcessing(true, 'Validating credentials...');
      
      // Import the API class dynamically
      const { OpenSubtitlesAPI } = await import('./services/api');
      
      // Create API instance and test login
      const api = new OpenSubtitlesAPI(apiKey);
      const loginResult = await api.login(username, password);
      
      if (loginResult.success) {
        // Only save config if login was successful
        const success = await window.electronAPI.saveConfig({ username, password, apiKey });
        if (success) {
          const updatedConfig = await window.electronAPI.getConfig();
          setConfig(updatedConfig);
          setCurrentScreen('main');
          return true;
        }
      }
      
      console.error('Login failed:', loginResult.error);
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    } finally {
      setAppProcessing(false);
    }
  };

  const handleCreditsUpdate = (credits: { used: number; remaining: number }) => {
    setConfig(prevConfig => {
      if (!prevConfig) return prevConfig;
      return {
        ...prevConfig,
        credits: credits
      };
    });
  };

  const handlePreferencesSave = async (newConfig: Partial<AppConfig>): Promise<boolean> => {
    try {
      setAppProcessing(true, 'Validating credentials...');
      
      // If username, password, or apiKey are being changed, validate them
      if (newConfig.username || newConfig.password || newConfig.apiKey) {
        const { OpenSubtitlesAPI } = await import('./services/api');
        
        // Use the new values if provided, otherwise use current config values
        const username = newConfig.username || config?.username || '';
        const password = newConfig.password || config?.password || '';
        const apiKey = newConfig.apiKey || config?.apiKey || '';
        
        const api = new OpenSubtitlesAPI(apiKey);
        const loginResult = await api.login(username, password);
        
        if (!loginResult.success) {
          console.error('Credential validation failed:', loginResult.error);
          return false;
        }
      }
      
      // If validation passed, save the config
      const success = await window.electronAPI.saveConfig(newConfig);
      if (success) {
        const updatedConfig = await window.electronAPI.getConfig();
        setConfig(updatedConfig);
        setCurrentScreen('main');
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
        {currentScreen === 'main' && config && (
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
        {currentScreen === 'batch' && config && (
          <BatchScreen 
            config={config} 
            setAppProcessing={setAppProcessing}
            pendingFiles={pendingBatchFiles}
            onFilesPending={() => setPendingBatchFiles([])}
          />
        )}
        {currentScreen === 'info' && config && (
          <Info 
            config={config} 
            setAppProcessing={setAppProcessing}
          />
        )}
        {currentScreen === 'credits' && config && (
          <Credits 
            config={config} 
            setAppProcessing={setAppProcessing}
          />
        )}
        {currentScreen === 'preferences' && config && (
          <Preferences
            config={config}
            onSave={handlePreferencesSave}
            onCancel={() => setCurrentScreen('main')}
            setAppProcessing={setAppProcessing}
          />
        )}
        {currentScreen === 'update' && (
          <Update
            onCancel={() => setCurrentScreen('main')}
          />
        )}
        {currentScreen === 'help' && (
          <Help
            onCancel={() => setCurrentScreen('main')}
          />
        )}
      </div>

      {/* Floating Credits Display */}
      {config?.credits && currentScreen !== 'login' && (
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
          💳 Credits: <strong>{config.credits.remaining}</strong>
        </div>
      )}

      {/* Centralized StatusBar - always full width */}
      <StatusBar 
        onNetworkChange={handleNetworkChange}
        isProcessing={isProcessing}
        currentTask={currentTask}
      />
    </div>
  );
}

export default App;