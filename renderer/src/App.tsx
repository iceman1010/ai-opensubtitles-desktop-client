import React, { useState, useEffect, useCallback, useRef } from 'react';
import Login from './components/Login';
import MainScreen from './components/MainScreen';
import BatchScreen from './components/BatchScreen';
import Search from './components/Search';
import RecentMedia from './components/RecentMedia';
import Preferences from './components/Preferences';
import Update from './components/Update';
import Info from './components/Info';
import Credits from './components/Credits';
import Help from './components/Help';
import StatusBar from './components/StatusBar';
import ErrorLogControls from './components/ErrorLogControls';
import { APIProvider, useAPI } from './contexts/APIContext';
import { PowerProvider, usePowerEvents, useHibernationRecovery } from './contexts/PowerContext';
import { logger } from './utils/errorLogger'; // Initialize global error handlers
import appConfig from './config/appConfig.json';
import packageInfo from '../../package.json';
import logoImage from './assets/logo.png';

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
  hideRecentMediaInfoPanel?: boolean;
  defaultFilenameFormat?: string;
  credits?: {
    used: number;
    remaining: number;
  };
}

// Main App component wrapped with API context
function App() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSplashScreen, setShowSplashScreen] = useState(true);
  const [splashOpacity, setSplashOpacity] = useState(1);

  useEffect(() => {
    // Start fade out after 4 seconds, then hide completely after fade finishes
    const fadeTimer = setTimeout(() => {
      setSplashOpacity(0);
    }, 4000);

    const hideTimer = setTimeout(() => {
      setShowSplashScreen(false);
    }, 5000); // 4s display + 1s fade = 5s total

    loadConfig();

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  // Handle dark mode class toggling
  useEffect(() => {
    if (config?.darkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  }, [config?.darkMode]);

  // Sync debug level with logger
  useEffect(() => {
    if (config?.debugLevel !== undefined) {
      logger.setDebugLevel(config.debugLevel);
    }
  }, [config?.debugLevel]);

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

  // Show splash screen overlay with fade transition
  if (showSplashScreen) {
    return (
      <>
        {/* Main app content loads behind splash screen - ready for reveal */}
        {!isLoading && (
          <PowerProvider>
            <APIProvider
              initialConfig={hasCredentials ? {
                username: config.username,
                password: config.password,
                apiKey: config.apiKey,
                apiBaseUrl: config.apiBaseUrl,
                apiUrlParameter: config.apiUrlParameter
              } : undefined}
            >
              <AppContent
                config={config}
                setConfig={setConfig}
                hasCredentials={!!hasCredentials}
                isLoading={isLoading}
              />
            </APIProvider>
          </PowerProvider>
        )}

        {/* Splash screen overlay */}
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: config?.darkMode ? '#1a1a1a' : '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          opacity: splashOpacity,
          transition: 'opacity 1000ms ease-out'
        }}>
          <style>
            {`
              @keyframes splashBounceGlow {
                0% {
                  transform: translateY(-100px) scale(0.3);
                  opacity: 0;
                  box-shadow: 0 0 20px rgba(74, 144, 226, 0.3);
                }
                50% {
                  transform: translateY(10px) scale(1.1);
                  opacity: 0.8;
                  box-shadow: 0 0 30px rgba(74, 144, 226, 0.5);
                }
                70% {
                  transform: translateY(-5px) scale(0.95);
                  opacity: 1;
                  box-shadow: 0 0 25px rgba(74, 144, 226, 0.4);
                }
                100% {
                  transform: translateY(0) scale(1);
                  opacity: 1;
                  box-shadow: 0 0 20px rgba(74, 144, 226, 0.3);
                }
              }

              @keyframes splashGlowPulse {
                0% {
                  box-shadow: 0 0 20px rgba(74, 144, 226, 0.3);
                }
                50% {
                  box-shadow: 0 0 30px rgba(74, 144, 226, 0.6);
                }
                100% {
                  box-shadow: 0 0 20px rgba(74, 144, 226, 0.3);
                }
              }

              .splash-logo {
                animation: splashBounceGlow 1.2s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards,
                           splashGlowPulse 2s ease-in-out infinite 1.2s;
              }
            `}
          </style>
          <img
            src={logoImage}
            alt="Logo"
            className="splash-logo"
            style={{
              width: '120px',
              height: '120px',
              borderRadius: '50%',
              marginBottom: '16px'
            }}
          />
          <div style={{
            position: 'absolute',
            bottom: '10px',
            fontSize: '11px',
            color: config?.darkMode ? '#aaa' : '#6c757d',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
            fontWeight: '300'
          }}>
            v{packageInfo.version}
          </div>
        </div>
      </>
    );
  }

  if (isLoading) {
    return (
      <div className="app">
        <div className="main-content">
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  // Normal app flow after splash screen is hidden
  return (
    <PowerProvider>
      <APIProvider
        initialConfig={hasCredentials ? {
          username: config.username,
          password: config.password,
          apiKey: config.apiKey,
          apiBaseUrl: config.apiBaseUrl,
          apiUrlParameter: config.apiUrlParameter
        } : undefined}
      >
        <AppContent
          config={config}
          setConfig={setConfig}
          hasCredentials={!!hasCredentials}
          isLoading={isLoading}
        />
      </APIProvider>
    </PowerProvider>
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
    logout,
    updateCredits,
    refreshConnectivityAndAuth
  } = useAPI();

  // Power management hooks for hibernation recovery
  const { onSystemSuspend, onSystemResume } = usePowerEvents();
  const { preserveState, restoreState, clearPreservedState, isTokenExpired } = useHibernationRecovery();

  const [currentScreen, setCurrentScreen] = useState<'login' | 'main' | 'batch' | 'search' | 'recent-media' | 'preferences' | 'update' | 'info' | 'credits' | 'help'>('main');
  const [pendingBatchFiles, setPendingBatchFiles] = useState<string[]>([]);
  const [pendingMainFile, setPendingMainFile] = useState<string | null>(null);

  // Track processing states from child screens
  const [mainScreenProcessing, setMainScreenProcessing] = useState(false);
  const [batchScreenProcessing, setBatchScreenProcessing] = useState(false);
  
  // Centralized status state
  const [isNetworkOnline, setIsNetworkOnline] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentTask, setCurrentTask] = useState<string | undefined>(undefined);

  // Notification function for StatusBar instant messages (duplicate files, validation errors, etc.)
  // This provides orange notification style distinct from blue processing status
  // Using ref instead of state to avoid async update issues
  const showNotificationRef = useRef<((message: string, duration?: number) => void) | null>(null);

  // Set initial screen based on authentication state
  useEffect(() => {
    if (!hasCredentials) {
      // Only show login screen if no credentials exist at all
      setCurrentScreen('login');
    } else if (currentScreen === 'login') {
      // Only auto-navigate to main screen if coming from login screen
      // Preserve current screen location during authentication maintenance operations
      setCurrentScreen('main');
    }
    // Don't auto-navigate when user is already on functional screens (credits, batch, etc.)
  }, [hasCredentials, isAuthenticated, currentScreen]);

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
        case 'navigate-search':
          setCurrentScreen('search');
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
      logger.debug(1, 'App', `Received single external file: ${filePath}`);
      setCurrentScreen('main');
      // Set the file for MainScreen to pick up
      setPendingMainFile(filePath);
    };

    // Handle multiple files opening - route to Batch screen
    const handleExternalFiles = (event: any, filePaths: string[]) => {
      logger.debug(1, 'App', `Received ${filePaths.length} external files:`, filePaths);
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

  // Hibernation recovery management
  useEffect(() => {
    const handleSuspend = () => {
      logger.info('App', 'System suspending - preserving app state');

      // Preserve critical app state
      preserveState({
        currentScreen,
        isProcessing: mainScreenProcessing || batchScreenProcessing,
        processingTask: isProcessing ? currentTask : undefined,
        timestamp: Date.now()
      });
    };

    const handleResume = async () => {
      logger.info('App', 'System resumed - checking for hibernation recovery');
      logger.debug(1, 'App', 'Resume handler called', {
        currentScreen,
        isAuthenticated,
        hasCredentials: !!hasCredentials,
        mainScreenProcessing,
        batchScreenProcessing
      });

      try {
        // Check if token is expired after hibernation
        const tokenExpired = await isTokenExpired();
        logger.debug(1, 'App', `Token expiration check result: ${tokenExpired}`);

        if (tokenExpired && isAuthenticated) {
          logger.warn('App', 'Token expired after hibernation, re-authentication needed');
          // You can trigger re-authentication here or show a notification
          // For now, we'll just log it and let the normal token validation handle it
        }

        // Restore preserved state if available
        const savedState = restoreState();
        if (savedState) {
          logger.info('App', 'Restoring app state after hibernation:', savedState);

          // Restore current screen if it was preserved
          if (savedState.currentScreen !== currentScreen) {
            setCurrentScreen(savedState.currentScreen as typeof currentScreen);
          }

          // Clear the preserved state after restoration
          clearPreservedState();
        }
      } catch (error) {
        logger.error('App', 'Error during hibernation recovery:', error);
      }
    };

    // Register hibernation event handlers
    onSystemSuspend(handleSuspend);
    onSystemResume(handleResume);

    logger.debug(2, 'App', 'Hibernation recovery handlers registered');

    // No cleanup needed as PowerContext handles its own cleanup
  }, [onSystemSuspend, onSystemResume, preserveState, restoreState, clearPreservedState, isTokenExpired]);

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

  const handleConfigUpdate = async (newConfig: Partial<AppConfig>): Promise<void> => {
    try {
      // Save config without validation (for simple UI preferences)
      const success = await window.electronAPI.saveConfig(newConfig);
      if (success) {
        const updatedConfig = await window.electronAPI.getConfig();
        setConfig(updatedConfig);
      }
    } catch (error) {
      console.error('Failed to update config:', error);
    }
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
  const handleNetworkChange = useCallback((isOnline: boolean) => {
    setIsNetworkOnline(isOnline);

    // Trigger connectivity refresh and re-auth when network comes back
    if (isOnline) {
      refreshConnectivityAndAuth();
    }
  }, [refreshConnectivityAndAuth]);

  const setAppProcessing = (processing: boolean, task?: string) => {
    setIsProcessing(processing);
    setCurrentTask(processing ? task : undefined);
  };

  const handleScreenChange = (screen: typeof currentScreen) => {
    // Check if a process is currently running and warn user
    const isCurrentlyProcessing =
      (currentScreen === 'main' && mainScreenProcessing) ||
      (currentScreen === 'batch' && batchScreenProcessing);

    if (isCurrentlyProcessing) {
      const confirmed = window.confirm(
        "A process is currently running. Navigating away will lose the current state. Continue anyway?"
      );
      if (!confirmed) {
        return; // Cancel navigation
      }
    }

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
                  <i className="fas fa-file-audio"></i>Single File
                </button>
              </li>
              <li>
                <button
                  className={currentScreen === 'batch' ? 'active' : ''}
                  onClick={() => handleScreenChange('batch')}
                >
                  <i className="fas fa-layer-group"></i>Batch
                </button>
              </li>
              <li style={{
                opacity: 1,
                transition: 'opacity 0.3s ease-in-out, transform 0.3s ease-in-out',
                transform: 'translateY(0)'
              }}>
                <button
                  className={currentScreen === 'search' ? 'active' : ''}
                  onClick={() => handleScreenChange('search')}
                >
                  <i className="fas fa-search"></i>Search
                </button>
              </li>
              <li>
                <button
                  className={currentScreen === 'recent-media' ? 'active' : ''}
                  onClick={() => handleScreenChange('recent-media')}
                >
                  <i className="fas fa-history"></i>Recent Media
                </button>
              </li>
              <li>
                <button
                  className={currentScreen === 'info' ? 'active' : ''}
                  onClick={() => handleScreenChange('info')}
                >
                  <i className="fas fa-info-circle"></i>Info
                </button>
              </li>
              <li>
                <button
                  className={currentScreen === 'credits' ? 'active' : ''}
                  onClick={() => handleScreenChange('credits')}
                >
                  <i className="fas fa-coins"></i>Credits
                </button>
              </li>
              <li>
                <button
                  className={currentScreen === 'preferences' ? 'active' : ''}
                  onClick={() => handleScreenChange('preferences')}
                >
                  <i className="fas fa-cog"></i>Preferences
                </button>
              </li>
              <li>
                <button
                  className={currentScreen === 'update' ? 'active' : ''}
                  onClick={() => handleScreenChange('update')}
                >
                  <i className="fas fa-download"></i>Update
                </button>
              </li>
              <li>
                <button
                  className={currentScreen === 'help' ? 'active' : ''}
                  onClick={() => handleScreenChange('help')}
                >
                  <i className="fas fa-question-circle"></i>Help
                </button>
              </li>
            </ul>
          </nav>

          {/* Dark Mode Toggle positioned under version number */}
          <div style={{
            position: 'absolute',
            bottom: '10px', // Moved 15px down from 25px
            left: '50%',
            transform: 'translateX(-50%)',
            textAlign: 'center'
          }}>
            <button
              onClick={async () => {
                const newDarkMode = !config?.darkMode;
                // Save dark mode directly without credential validation
                const success = await window.electronAPI.saveConfig({ darkMode: newDarkMode });
                if (success) {
                  const updatedConfig = await window.electronAPI.getConfig();
                  setConfig(updatedConfig);
                }
              }}
              style={{
                background: 'transparent',
                border: '2px solid var(--sidebar-text)',
                borderRadius: '20px',
                color: 'var(--sidebar-text)',
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.2s ease',
                minWidth: '100px',
                justifyContent: 'center'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              <i className={`fas ${config?.darkMode ? 'fa-sun' : 'fa-moon'}`}></i>
              {config?.darkMode ? 'Light' : 'Dark'}
            </button>
          </div>

          {/* Logo positioned above version display at bottom of sidebar */}
          <div
            className="sidebar-logo"
            style={{
              position: 'absolute',
              bottom: '90px', // 60px (version position) + 20px (logo height) + 10px (gap)
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
          <div className="sidebar-version" style={{
            position: 'absolute',
            bottom: '60px' // Moved 15px up from 45px
          }}>
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
            onProcessingStateChange={setMainScreenProcessing}
          />
        )}
        {currentScreen === 'batch' && config && (
          <BatchScreen
            config={config}
            setAppProcessing={setAppProcessing}
            showNotification={showNotificationRef.current}
            pendingFiles={pendingBatchFiles}
            onFilesPending={() => setPendingBatchFiles([])}
            isVisible={true}
            onProcessingStateChange={setBatchScreenProcessing}
          />
        )}
        {currentScreen === 'search' && config && (
          <Search
            setAppProcessing={setAppProcessing}
            showNotification={showNotificationRef.current}
          />
        )}
        {currentScreen === 'recent-media' && config && (
          <RecentMedia
            setAppProcessing={setAppProcessing}
            isVisible={true}
            config={config}
            onConfigUpdate={handleConfigUpdate}
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
            isVisible={true}
          />
        )}
        {currentScreen === 'preferences' && config && (
          <Preferences
            config={config}
            onSave={handlePreferencesSave}
            setAppProcessing={setAppProcessing}
            onSimulateOffline={logout}
          />
        )}
        {currentScreen === 'update' && (
          <Update />
        )}
        {currentScreen === 'help' && (
          <Help />
        )}
      </div>

      {/* Floating Credits Display */}
      {credits && currentScreen !== 'login' && (
        <div
          onClick={() => setCurrentScreen('credits')}
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            zIndex: 1000,
            color: 'var(--text-primary)',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
          }}
        >
          <i className="fas fa-coins" style={{color: 'var(--text-primary)', marginRight: '6px'}}></i>Credits: <strong>{credits.remaining}</strong>
        </div>
      )}

      {/* Centralized StatusBar - always full width */}
      <StatusBar
        onNetworkChange={handleNetworkChange}
        isProcessing={isProcessing}
        currentTask={currentTask}
        config={config ? {
          apiBaseUrl: config.apiBaseUrl,
          apiConnectivityTestIntervalMinutes: config.apiConnectivityTestIntervalMinutes
        } : undefined}
        onNotificationShow={(callback) => { showNotificationRef.current = callback; }}
      />

      {/* Global Error Log Controls */}
      <ErrorLogControls />
    </div>
  );
}

export default App;