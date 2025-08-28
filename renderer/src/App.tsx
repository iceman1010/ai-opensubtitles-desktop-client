import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import MainScreen from './components/MainScreen';
import Preferences from './components/Preferences';
import Info from './components/Info';
import './utils/errorLogger'; // Initialize global error handlers
import appConfig from './config/appConfig.json';
import packageInfo from '../../package.json';

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

function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [currentScreen, setCurrentScreen] = useState<'login' | 'main' | 'preferences' | 'info'>('main');
  const [isLoading, setIsLoading] = useState(true);

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

  const handleLogin = async (username: string, password: string, apiKey: string) => {
    try {
      const success = await window.electronAPI.saveConfig({ username, password, apiKey });
      if (success) {
        const updatedConfig = await window.electronAPI.getConfig();
        setConfig(updatedConfig);
        setCurrentScreen('main');
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handlePreferencesSave = async (newConfig: Partial<AppConfig>) => {
    try {
      const success = await window.electronAPI.saveConfig(newConfig);
      if (success) {
        const updatedConfig = await window.electronAPI.getConfig();
        setConfig(updatedConfig);
        setCurrentScreen('main');
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
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
          <MainScreen config={config} />
        )}
        {currentScreen === 'info' && config && (
          <Info config={config} />
        )}
        {currentScreen === 'preferences' && config && (
          <Preferences
            config={config}
            onSave={handlePreferencesSave}
            onCancel={() => setCurrentScreen('main')}
          />
        )}
      </div>
    </div>
  );
}

export default App;