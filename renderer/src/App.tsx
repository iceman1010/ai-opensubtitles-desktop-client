import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import MainScreen from './components/MainScreen';
import Preferences from './components/Preferences';
import Info from './components/Info';
import Credits from './components/Credits';
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
  const [currentScreen, setCurrentScreen] = useState<'login' | 'main' | 'preferences' | 'info' | 'credits'>('main');
  const [isLoading, setIsLoading] = useState(true);
  
  // Centralized status state
  const [isNetworkOnline, setIsNetworkOnline] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTask, setCurrentTask] = useState<string | undefined>(undefined);

  useEffect(() => {
    loadConfig();
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
                  onClick={() => setCurrentScreen('main')}
                >
                  Main
                </button>
              </li>
              <li>
                <button
                  className={currentScreen === 'info' ? 'active' : ''}
                  onClick={() => setCurrentScreen('info')}
                >
                  Info
                </button>
              </li>
              <li>
                <button
                  className={currentScreen === 'credits' ? 'active' : ''}
                  onClick={() => setCurrentScreen('credits')}
                >
                  Credits
                </button>
              </li>
              <li>
                <button
                  className={currentScreen === 'preferences' ? 'active' : ''}
                  onClick={() => setCurrentScreen('preferences')}
                >
                  Preferences
                </button>
              </li>
            </ul>
          </nav>
          {config?.credits && (
            <div style={{ marginTop: '20px', fontSize: '14px' }}>
              <p>Credits: {config.credits.remaining}</p>
            </div>
          )}
          
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
          <Login onLogin={handleLogin} />
        )}
        {currentScreen === 'main' && config && (
          <MainScreen 
            config={config} 
            setAppProcessing={setAppProcessing}
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
      </div>

      {/* Centralized StatusBar - only show when not on login */}
      {currentScreen !== 'login' && (
        <StatusBar 
          onNetworkChange={handleNetworkChange}
          isProcessing={isProcessing}
          currentTask={currentTask}
          hasSidebar={false}
        />
      )}
    </div>
  );
}

export default App;