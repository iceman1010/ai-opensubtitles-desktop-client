import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '../utils/errorLogger';

interface PowerState {
  currentScreen: string;
  isProcessing: boolean;
  processingTask?: string;
  timestamp: number;
}

interface PowerContextType {
  isSystemSuspended: boolean;
  isScreenLocked: boolean;
  lastResumeTime: number | null;

  // State preservation
  preserveState: (state: PowerState) => void;
  restoreState: () => PowerState | null;
  clearPreservedState: () => void;

  // Event handlers
  onSystemSuspend: (callback: () => void) => void;
  onSystemResume: (callback: () => void) => void;
  onScreenLock: (callback: () => void) => void;
  onScreenUnlock: (callback: () => void) => void;

  // Token validation utility
  isTokenExpired: () => Promise<boolean>;

  // Register connectivity refresh callback
  registerConnectivityRefreshCallback: (callback: () => Promise<void>) => void;

  // Test functions
  simulateSystemResume: () => void;

  // Cleanup
  removeAllListeners: () => void;
}

const PowerContext = createContext<PowerContextType | null>(null);

export const usePower = () => {
  const context = useContext(PowerContext);
  if (!context) {
    throw new Error('usePower must be used within a PowerProvider');
  }
  return context;
};

interface PowerProviderProps {
  children: React.ReactNode;
}

export const PowerProvider: React.FC<PowerProviderProps> = ({ children }) => {
  const [isSystemSuspended, setIsSystemSuspended] = useState(false);
  const [isScreenLocked, setIsScreenLocked] = useState(false);
  const [lastResumeTime, setLastResumeTime] = useState<number | null>(null);

  // Store callbacks for different events
  const suspendCallbacks = useRef<(() => void)[]>([]);
  const resumeCallbacks = useRef<(() => void)[]>([]);
  const lockCallbacks = useRef<(() => void)[]>([]);
  const unlockCallbacks = useRef<(() => void)[]>([]);
  const connectivityRefreshCallback = useRef<(() => Promise<void>) | null>(null);

  // Preserved state storage
  const preservedState = useRef<PowerState | null>(null);

  const preserveState = useCallback((state: PowerState) => {
    preservedState.current = {
      ...state,
      timestamp: Date.now()
    };
    logger.debug(2, 'PowerContext', 'State preserved for hibernation:', state);
  }, []);

  const restoreState = useCallback((): PowerState | null => {
    const state = preservedState.current;
    if (state) {
      logger.debug(2, 'PowerContext', 'State restored after hibernation:', state);
    }
    return state;
  }, []);

  const clearPreservedState = useCallback(() => {
    preservedState.current = null;
    logger.debug(3, 'PowerContext', 'Preserved state cleared');
  }, []);

  // Token validation utility
  const isTokenExpired = useCallback(async (): Promise<boolean> => {
    try {
      if (!window.electronAPI?.isTokenExpiredForHibernation) {
        logger.warn('PowerContext', 'Token expiration check not available');
        return true;
      }

      const expired = await window.electronAPI.isTokenExpiredForHibernation();
      logger.debug(3, 'PowerContext', `Token expired check: ${expired}`);
      return expired;
    } catch (error) {
      logger.error('PowerContext', 'Error checking token expiration:', error);
      return true; // Assume expired on error
    }
  }, []);

  // Event handler registration
  const onSystemSuspend = useCallback((callback: () => void) => {
    suspendCallbacks.current.push(callback);
  }, []);

  const onSystemResume = useCallback((callback: () => void) => {
    resumeCallbacks.current.push(callback);
  }, []);

  const onScreenLock = useCallback((callback: () => void) => {
    lockCallbacks.current.push(callback);
  }, []);

  const onScreenUnlock = useCallback((callback: () => void) => {
    unlockCallbacks.current.push(callback);
  }, []);

  const registerConnectivityRefreshCallback = useCallback((callback: () => Promise<void>) => {
    connectivityRefreshCallback.current = callback;
    logger.debug(2, 'PowerContext', 'Connectivity refresh callback registered');
  }, []);

  // Test function to simulate system resume from hibernation
  const simulateSystemResume = useCallback(() => {
    logger.info('PowerContext', '🧪 TEST: Simulating system hibernation resume');

    const now = Date.now();
    setLastResumeTime(now);

    // Execute all registered resume callbacks
    logger.debug(1, 'PowerContext', `Executing ${resumeCallbacks.current.length} resume callbacks`);
    resumeCallbacks.current.forEach((callback, index) => {
      try {
        logger.debug(1, 'PowerContext', `Executing resume callback ${index + 1}/${resumeCallbacks.current.length}`);
        callback();
      } catch (error) {
        logger.error('PowerContext', `Error in resume callback ${index + 1}:`, error);
      }
    });

    // Also execute connectivity refresh callback if registered
    if (connectivityRefreshCallback.current) {
      logger.debug(1, 'PowerContext', 'Executing connectivity refresh callback');
      connectivityRefreshCallback.current().catch((error) => {
        logger.error('PowerContext', 'Error in connectivity refresh callback:', error);
      });
    }

    logger.info('PowerContext', '🧪 TEST: All hibernation resume callbacks executed');
  }, []);

  const removeAllListeners = useCallback(() => {
    suspendCallbacks.current = [];
    resumeCallbacks.current = [];
    lockCallbacks.current = [];
    unlockCallbacks.current = [];
    connectivityRefreshCallback.current = null;
    logger.debug(3, 'PowerContext', 'All power event listeners removed');
  }, []);

  // Event handlers for system events
  const handleSystemSuspend = useCallback(() => {
    logger.info('PowerContext', 'System suspend detected');
    setIsSystemSuspended(true);

    // Execute all registered suspend callbacks
    suspendCallbacks.current.forEach(callback => {
      try {
        callback();
      } catch (error) {
        logger.error('PowerContext', 'Error in suspend callback:', error);
      }
    });
  }, []); // Empty deps - function is stable

  const handleSystemResume = useCallback(async () => {
    const resumeTime = Date.now();
    console.log('🚀 SYSTEM RESUME DETECTED IN RENDERER! 🚀', resumeTime);
    logger.info('PowerContext', 'System resume detected');
    logger.debug(1, 'PowerContext', `Resume time: ${resumeTime}, registered callbacks: ${resumeCallbacks.current.length}`);

    setIsSystemSuspended(false);
    setLastResumeTime(resumeTime);

    // Call connectivity refresh callback first (proactive connectivity test)
    if (connectivityRefreshCallback.current) {
      try {
        logger.debug(1, 'PowerContext', 'Calling connectivity refresh callback');
        await connectivityRefreshCallback.current();
        logger.debug(1, 'PowerContext', 'Connectivity refresh completed');
      } catch (error) {
        logger.error('PowerContext', 'Error in connectivity refresh callback:', error);
      }
    }

    // Execute all registered resume callbacks
    resumeCallbacks.current.forEach((callback, index) => {
      try {
        logger.debug(1, 'PowerContext', `Executing resume callback ${index + 1}/${resumeCallbacks.current.length}`);
        callback();
      } catch (error) {
        logger.error('PowerContext', `Error in resume callback ${index + 1}:`, error);
      }
    });

    logger.debug(1, 'PowerContext', 'All resume callbacks executed');
  }, []); // Empty deps - function is stable

  const handleScreenLock = useCallback(() => {
    logger.debug(2, 'PowerContext', 'Screen lock detected');
    setIsScreenLocked(true);

    // Execute all registered lock callbacks
    lockCallbacks.current.forEach(callback => {
      try {
        callback();
      } catch (error) {
        logger.error('PowerContext', 'Error in screen lock callback:', error);
      }
    });
  }, []); // Empty deps - function is stable

  const handleScreenUnlock = useCallback(() => {
    logger.debug(2, 'PowerContext', 'Screen unlock detected');
    setIsScreenLocked(false);

    // Execute all registered unlock callbacks
    unlockCallbacks.current.forEach(callback => {
      try {
        callback();
      } catch (error) {
        logger.error('PowerContext', 'Error in screen unlock callback:', error);
      }
    });
  }, []); // Empty deps - function is stable

  // Setup power monitoring when component mounts
  useEffect(() => {
    console.log('🔥 POWERCONTEXT SETUP STARTING 🔥');
    logger.debug(1, 'PowerContext', 'Power monitoring setup starting', {
      hasElectronAPI: !!window.electronAPI,
      onSystemSuspend: !!window.electronAPI?.onSystemSuspend,
      onSystemResume: !!window.electronAPI?.onSystemResume
    });

    if (!window.electronAPI) {
      console.log('❌ NO ELECTRON API AVAILABLE');
      logger.warn('PowerContext', 'electronAPI not available, power monitoring disabled');
      return;
    }

    // Register event listeners
    window.electronAPI.onSystemSuspend(handleSystemSuspend);
    window.electronAPI.onSystemResume(handleSystemResume);
    window.electronAPI.onScreenLock(handleScreenLock);
    window.electronAPI.onScreenUnlock(handleScreenUnlock);

    logger.info('PowerContext', 'Power monitoring initialized with all event handlers registered');

    return () => {
      // Cleanup event listeners
      window.electronAPI.removeSystemSuspendListener(handleSystemSuspend);
      window.electronAPI.removeSystemResumeListener(handleSystemResume);
      window.electronAPI.removeScreenLockListener(handleScreenLock);
      window.electronAPI.removeScreenUnlockListener(handleScreenUnlock);

      logger.debug(3, 'PowerContext', 'Power monitoring cleanup completed');
    };
  }, [handleSystemSuspend, handleSystemResume, handleScreenLock, handleScreenUnlock]);

  const contextValue: PowerContextType = {
    isSystemSuspended,
    isScreenLocked,
    lastResumeTime,
    preserveState,
    restoreState,
    clearPreservedState,
    isTokenExpired,
    onSystemSuspend,
    onSystemResume,
    onScreenLock,
    onScreenUnlock,
    registerConnectivityRefreshCallback,
    simulateSystemResume,
    removeAllListeners
  };

  return (
    <PowerContext.Provider value={contextValue}>
      {children}
    </PowerContext.Provider>
  );
};

// Convenience hooks for specific power events
export const usePowerEvents = () => {
  const { onSystemSuspend, onSystemResume, onScreenLock, onScreenUnlock } = usePower();
  return { onSystemSuspend, onSystemResume, onScreenLock, onScreenUnlock };
};

export const useHibernationRecovery = () => {
  const { preserveState, restoreState, clearPreservedState, lastResumeTime, isTokenExpired } = usePower();
  return { preserveState, restoreState, clearPreservedState, lastResumeTime, isTokenExpired };
};