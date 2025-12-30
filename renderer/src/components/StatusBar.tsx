import React, { useState, useEffect, useRef, useCallback } from 'react';
import { setupNetworkListeners, isOnline, isFullyOnline, checkAPIConnectivity, updateAPIConnectivityCache, getAPIConnectivityStatus } from '../utils/networkUtils';
import { activityTracker } from '../utils/activityTracker';

interface StatusBarProps {
  onNetworkChange?: (isOnline: boolean) => void;
  isProcessing?: boolean;
  currentTask?: string;
  config?: {
    apiBaseUrl?: string;
    apiConnectivityTestIntervalMinutes?: number;
  };
  // Callback to register notification function for instant messages (warnings, info, errors)
  // Usage: showNotification("message", duration_ms) - displays orange notification with info icon
  onNotificationShow?: (callback: (message: string, duration?: number) => void) => void;
}

const StatusBar: React.FC<StatusBarProps> = ({
  onNetworkChange,
  isProcessing = false,
  currentTask,
  config,
  onNotificationShow
}) => {
  const [online, setOnline] = useState(isOnline());
  const [apiConnectivity, setApiConnectivity] = useState<'connected' | 'unreachable'>('connected');
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);
  const [showConnectionChange, setShowConnectionChange] = useState(false);
  const [isApiActive, setIsApiActive] = useState(false);
  const [currentApiContext, setCurrentApiContext] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string>('');
  const [showUpdateStatus, setShowUpdateStatus] = useState(false);

  // Notification state for instant messages (duplicate files, validation errors, etc.)
  // These appear in orange with info icon, distinct from blue processing status
  const [notificationMessage, setNotificationMessage] = useState<string>('');
  const [showNotification, setShowNotification] = useState(false);
  
  // State for managing minimum display time of processing status
  const [displayedTask, setDisplayedTask] = useState<string | undefined>(currentTask);
  const [shouldShowProcessing, setShouldShowProcessing] = useState(isProcessing);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

  // Dynamic width calculation for smart truncation
  const containerRef = useRef<HTMLDivElement>(null);
  const [availableChars, setAvailableChars] = useState(40); // fallback

  useEffect(() => {
    const cleanup = setupNetworkListeners(
      () => {
        setOnline(true);
        setShowConnectionChange(true);
        onNetworkChange?.(true);
        
        // Hide the connection change indicator after 5 seconds
        setTimeout(() => {
          setShowConnectionChange(false);
        }, 5000);
      },
      () => {
        setOnline(false);
        setShowConnectionChange(true);
        onNetworkChange?.(false);
        
        // Keep showing offline status until back online
      }
    );

    return cleanup;
  }, [onNetworkChange]);

  // Set up notification callback for parent components to show instant messages
  // This allows components to show temporary notifications without using processing status
  useEffect(() => {
    if (onNotificationShow) {
      onNotificationShow((message: string, duration: number = 2000) => {
        setNotificationMessage(message);
        setShowNotification(true);
        setTimeout(() => {
          setShowNotification(false);
          setNotificationMessage('');
        }, duration);
      });
    }
  }, [onNotificationShow]);

  // API Connectivity Testing
  useEffect(() => {
    const testAPIConnectivity = async () => {
      if (!online) {
        setApiConnectivity('unreachable');
        updateAPIConnectivityCache(false, 30000);
        return;
      }

      if (!config?.apiBaseUrl) {
        // No API config available - can't test, but show as connected for basic network
        setApiConnectivity('connected');
        updateAPIConnectivityCache(true, 30000);
        return;
      }

      try {
        const result = await checkAPIConnectivity(config.apiBaseUrl);
        const newConnectivity = result.connected ? 'connected' : 'unreachable';
        setApiConnectivity(newConnectivity);

        // Store error message if connection failed
        if (!result.connected && result.error) {
          setApiErrorMessage(result.error);
        } else {
          setApiErrorMessage(null);
        }

        // Update cache with configured interval (convert minutes to ms)
        const cacheValidMs = (config.apiConnectivityTestIntervalMinutes ?? 5) * 60 * 1000;
        updateAPIConnectivityCache(result.connected, cacheValidMs);
      } catch (error) {
        setApiConnectivity('unreachable');
        setApiErrorMessage('Failed to check API connectivity');
        const cacheValidMs = (config.apiConnectivityTestIntervalMinutes ?? 5) * 60 * 1000;
        updateAPIConnectivityCache(false, cacheValidMs);
      }
    };

    // Set up periodic testing
    const intervalMinutes = config?.apiConnectivityTestIntervalMinutes ?? 5;
    const intervalMs = intervalMinutes * 60 * 1000;

    // Debounce immediate test on config changes to prevent race conditions
    const immediateTestTimeout = setTimeout(() => {
      if (config?.apiBaseUrl) {
        testAPIConnectivity();
      }
    }, 100);

    const intervalId = setInterval(() => {
      if (config?.apiBaseUrl) {
        testAPIConnectivity();
      }
    }, intervalMs);

    return () => {
      clearTimeout(immediateTestTimeout);
      clearInterval(intervalId);
    };
  }, [config?.apiBaseUrl, config?.apiConnectivityTestIntervalMinutes, online, onNetworkChange]);

  // Handle minimum display time for processing status
  useEffect(() => {
    const MIN_DISPLAY_TIME = 2000; // 2 seconds minimum display time

    if (isProcessing && currentTask) {
      // New task started - show immediately
      setDisplayedTask(currentTask);
      setShouldShowProcessing(true);
      setLastUpdateTime(Date.now());
    } else if (!isProcessing && shouldShowProcessing) {
      // Processing stopped - enforce minimum display time
      const timeSinceLastUpdate = Date.now() - lastUpdateTime;
      const remainingTime = Math.max(0, MIN_DISPLAY_TIME - timeSinceLastUpdate);

      if (remainingTime > 0) {
        // Wait for remaining time before hiding
        const timeoutId = setTimeout(() => {
          setShouldShowProcessing(false);
          setDisplayedTask(undefined);
        }, remainingTime);
        
        return () => clearTimeout(timeoutId);
      } else {
        // Minimum time already passed - hide immediately
        setShouldShowProcessing(false);
        setDisplayedTask(undefined);
      }
    } else if (isProcessing && currentTask !== displayedTask) {
      // Task changed while processing - update immediately
      setDisplayedTask(currentTask);
      setLastUpdateTime(Date.now());
    }
  }, [isProcessing, currentTask, shouldShowProcessing, displayedTask, lastUpdateTime]);

  useEffect(() => {
    // Set up activity tracking
    const cleanupActivity = activityTracker.addListener({
      onActivityStart: (context) => {
        setIsApiActive(true);
        setCurrentApiContext(context || null);
      },
      onActivityEnd: () => {
        setIsApiActive(false);
        setCurrentApiContext(null);
      },
      onContextUpdate: (contexts) => {
        // Update with the most recent context
        const currentContext = contexts.length > 0 ? contexts[contexts.length - 1] : null;
        setCurrentApiContext(currentContext);
      }
    });

    return cleanupActivity;
  }, []);

  useEffect(() => {
    // Set up update status listener
    const handleUpdateStatus = (_event: any, status: { event: string, message: string }) => {
      setUpdateStatus(status.message);
      setShowUpdateStatus(true);
      
      // Auto-hide update status after 10 seconds for most events
      // Keep showing for download progress and update ready
      if (!status.event.includes('downloading') && status.event !== 'update-downloaded') {
        setTimeout(() => {
          setShowUpdateStatus(false);
        }, 10000);
      }
    };

    window.electronAPI.onUpdateStatus(handleUpdateStatus);

    return () => {
      window.electronAPI.removeUpdateStatusListener(handleUpdateStatus);
    };
  }, []);

  // Calculate available space for dynamic truncation
  const calculateAvailableChars = useCallback(() => {
    if (!containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;

    // Estimate space taken by fixed elements
    let fixedWidth = 24; // base padding

    // Network status: ~70px
    fixedWidth += 70;

    // API indicator (when active): ~50px + separator
    if (isApiActive) {
      fixedWidth += 58; // 50px + 8px separator
    }

    // Update status (when active): ~20px for icon + separator
    if (showUpdateStatus) {
      fixedWidth += 28; // 20px + 8px separator
    }

    // Processing separator: ~8px
    if (shouldShowProcessing) {
      fixedWidth += 8;
    }

    // Processing icon and spacing: ~20px
    if (shouldShowProcessing) {
      fixedWidth += 20;
    }

    const remainingWidth = Math.max(0, containerWidth - fixedWidth);

    // Convert to character count (approximately 7px per character at 12px font)
    const charWidth = 7;
    const availableCharCount = Math.floor(remainingWidth / charWidth);

    // Responsive behavior based on screen size
    let minChars = 20;
    let maxChars = 120;

    // Mobile/small screens: more conservative limits
    if (containerWidth <= 768) {
      minChars = 15;
      maxChars = 35;
    }
    // Tablet/medium screens: moderate limits
    else if (containerWidth <= 1200) {
      minChars = 25;
      maxChars = 60;
    }
    // Large screens: generous limits
    else {
      minChars = 30;
      maxChars = 120;
    }

    // Set bounds based on screen size
    const boundedChars = Math.max(minChars, Math.min(maxChars, availableCharCount));

    setAvailableChars(boundedChars);
  }, [isApiActive, showUpdateStatus, shouldShowProcessing]);

  // Recalculate on mount and window resize
  useEffect(() => {
    calculateAvailableChars();

    const handleResize = () => calculateAvailableChars();
    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, [calculateAvailableChars]);

  // Recalculate when status elements change
  useEffect(() => {
    calculateAvailableChars();
  }, [isApiActive, showUpdateStatus, shouldShowProcessing, displayedTask, updateStatus, calculateAvailableChars]);

  const getNetworkStatusDisplay = () => {
    // Red: Device offline (no network adapter)
    if (!online) {
      return {
        color: 'var(--danger-color)',
        icon: 'fas fa-exclamation-triangle',
        text: 'Offline',
        title: 'No network connection'
      };
    }

    // Orange: Online but API server unreachable
    if (apiConnectivity === 'unreachable') {
      // Extract user-friendly message from error
      let displayText = 'API Issues';
      let tooltipText = 'Cannot reach API server - check network or DNS settings';

      if (apiErrorMessage) {
        // Try to extract the actual error message from the full error string
        // Format: "API server responded with status XXX: {json}" or plain message
        const statusMatch = apiErrorMessage.match(/status \d+: (.+)/);
        if (statusMatch) {
          try {
            // Parse JSON error response
            const errorJson = JSON.parse(statusMatch[1]);
            if (errorJson.message) {
              displayText = errorJson.message;
              tooltipText = `API Error: ${errorJson.message}`;
            }
          } catch {
            // If not JSON, use the raw message after status
            displayText = statusMatch[1].substring(0, 50);
            tooltipText = `API Error: ${statusMatch[1]}`;
          }
        } else {
          // Use the full error message if no status match
          displayText = apiErrorMessage.substring(0, 50);
          tooltipText = apiErrorMessage;
        }
      }

      return {
        color: '#fd7e14',
        icon: 'fas fa-exclamation-circle',
        text: displayText,
        title: tooltipText
      };
    }

    // Green: Fully connected (network + API reachable)
    if (apiConnectivity === 'connected') {
      return {
        color: '#28a745',
        icon: showConnectionChange ? 'fas fa-check' : 'fas fa-circle',
        text: showConnectionChange ? 'Connected' : 'Online',
        title: 'Connected to API server'
      };
    }

    // This should never happen now, but fallback to connected
    return {
      color: '#28a745',
      icon: 'fas fa-circle',
      text: 'Online',
      title: 'Network status unknown'
    };
  };

  const statusBarStyles: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 26,
    background: 'var(--bg-tertiary)',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    fontSize: 12,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: 'var(--text-secondary)',
    zIndex: 998,
    userSelect: 'none' as const,
  };

  const statusItemStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontWeight: 500,
  };

  const statusSeparatorStyles: React.CSSProperties = {
    margin: '0 8px',
    color: 'var(--text-muted)',
    fontWeight: 'normal' as const,
  };

  const statusIconStyles: React.CSSProperties = {
    fontSize: 11,
    lineHeight: 1,
    display: 'inline-block',
  };

  // Helper function to truncate long text with dynamic sizing
  const truncateText = (text: string, maxLength?: number): string => {
    // Use dynamic availableChars unless maxLength is specifically provided
    const effectiveMaxLength = maxLength ?? availableChars;

    if (text.length <= effectiveMaxLength) return text;
    return text.substring(0, effectiveMaxLength - 3) + '...';
  };

  // Helper function for update status with slightly shorter limit
  const truncateUpdateText = (text: string): string => {
    // Use slightly less space for update status to account for icon
    const updateMaxLength = Math.max(15, availableChars - 5);
    return truncateText(text, updateMaxLength);
  };

  // Helper function to extract API endpoint name from context
  const getEndpointDisplay = (context: string): string => {
    if (!context) return 'API';
    
    // Extract meaningful parts from context strings
    const lowercased = context.toLowerCase();
    
    if (lowercased.includes('transcription') || lowercased.includes('transcribe')) {
      return 'transcription';
    }
    if (lowercased.includes('translation') || lowercased.includes('translate')) {
      return 'translation';
    }
    if (lowercased.includes('login') || lowercased.includes('auth')) {
      return 'login';
    }
    if (lowercased.includes('credits')) {
      return 'credits';
    }
    if (lowercased.includes('language') || lowercased.includes('detect')) {
      return 'language';
    }
    if (lowercased.includes('services') || lowercased.includes('info')) {
      return 'info';
    }
    if (lowercased.includes('packages') || lowercased.includes('credit')) {
      return 'packages';
    }
    if (lowercased.includes('download')) {
      return 'download';
    }
    
    // If no specific match, try to extract the last meaningful word
    const words = context.toLowerCase().split(/[\s\-_/]+/).filter(w => w.length > 2);
    if (words.length > 0) {
      return words[words.length - 1];
    }
    
    return 'API';
  };

  return (
    <div ref={containerRef} style={statusBarStyles}>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        @keyframes pulse-rotate {
          0% { 
            opacity: 0.6;
            transform: rotate(0deg) scale(0.9);
          }
          50% { 
            opacity: 1;
            transform: rotate(180deg) scale(1.1);
          }
          100% { 
            opacity: 0.6;
            transform: rotate(360deg) scale(0.9);
          }
        }
        
        .status-spinning {
          animation: spin 1s linear infinite;
        }
        
        .status-pulsing {
          animation: pulse-rotate 1.5s ease-in-out infinite;
        }
        
        .status-pulse {
          animation: pulse 2s ease-in-out;
        }
        
        @media (max-width: 768px) {
          .status-bar-mobile {
            left: 0 !important;
            font-size: 11px !important;
            padding: 0 8px !important;
            height: 24px !important;
          }
        }
        
        @media (max-width: 900px) {
          .status-bar-tablet {
            left: 0 !important;
            padding-left: 12px !important;
          }
        }
      `}</style>
      
      {/* Network Status */}
      {(() => {
        const status = getNetworkStatusDisplay();
        return (
          <span
            style={{
              ...statusItemStyles,
              color: status.color,
              fontWeight: (!online || apiConnectivity === 'unreachable') ? 600 : 500
            }}
            className={showConnectionChange ? 'status-pulse' : ''}
            title={status.title}
          >
            <i
              className={status.icon}
              style={{
                ...statusIconStyles,
                color: status.color,
                fontSize: status.icon.includes('circle') ? '8px' : '11px'
              }}
            ></i>
            {status.text}
          </span>
        );
      })()}
      
      {/* API Activity Indicator */}
      {isApiActive && (
        <>
          <span style={statusSeparatorStyles}>|</span>
          <span style={{...statusItemStyles, color: '#6f42c1', fontWeight: 500, fontSize: 11}}>
            <i className="fas fa-sync-alt status-pulsing" style={{...statusIconStyles, color: '#6f42c1'}}></i>
            {currentApiContext ? getEndpointDisplay(currentApiContext) : 'API'}
          </span>
        </>
      )}
      
      {/* Processing Status */}
      {shouldShowProcessing && displayedTask && (
        <>
          <span style={statusSeparatorStyles}>|</span>
          <span style={{
            ...statusItemStyles,
            color: displayedTask.toLowerCase().includes('failed') ||
                   displayedTask.toLowerCase().includes('error') ? 'var(--danger-color)' : '#007bff',
            fontWeight: 600
          }}>
            <i className={`fas ${
              displayedTask.toLowerCase().includes('failed') ||
              displayedTask.toLowerCase().includes('error') ? 'fa-times' : 'fa-spinner status-spinning'
            }`} style={{
              ...statusIconStyles,
              color: displayedTask.toLowerCase().includes('failed') ||
                     displayedTask.toLowerCase().includes('error') ? 'var(--danger-color)' : '#007bff'
            }}></i>
            <span title={displayedTask}>{truncateText(displayedTask)}</span>
          </span>
        </>
      )}
      
      {/* Update Status - App update notifications (orange with contextual icons) */}
      {showUpdateStatus && updateStatus && (
        <>
          <span style={statusSeparatorStyles}>|</span>
          <span style={{...statusItemStyles, color: '#fd7e14', fontWeight: 500}}>
            <span style={statusIconStyles} className={updateStatus.includes('Downloading') ? 'status-pulsing' : ''}>
              <i className={`fas ${
                updateStatus.includes('available') ? 'fa-arrow-down' :
                updateStatus.includes('Downloading') ? 'fa-download' :
                updateStatus.includes('ready') ? 'fa-check' :
                updateStatus.includes('error') ? 'fa-times' : 'fa-sync-alt'
              }`} style={{...statusIconStyles, color: '#fd7e14'}}></i>
            </span>
            <span title={updateStatus}>{truncateUpdateText(updateStatus)}</span>
          </span>
        </>
      )}

      {/* Notification Status - Instant messages (duplicate files, validation errors, etc.) */}
      {/* Uses orange color with info icon to distinguish from ongoing processing operations */}
      {showNotification && notificationMessage && (
        <>
          <span style={statusSeparatorStyles}>|</span>
          <span style={{...statusItemStyles, color: '#fd7e14', fontWeight: 500}}>
            <i className="fas fa-info-circle" style={{...statusIconStyles, color: '#fd7e14'}}></i>
            <span title={notificationMessage}>{truncateUpdateText(notificationMessage)}</span>
          </span>
        </>
      )}
    </div>
  );
};

export default StatusBar;