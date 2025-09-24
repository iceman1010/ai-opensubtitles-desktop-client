import React, { useState, useEffect, useRef, useCallback } from 'react';
import { setupNetworkListeners, isOnline } from '../utils/networkUtils';
import { activityTracker } from '../utils/activityTracker';

interface StatusBarProps {
  onNetworkChange?: (isOnline: boolean) => void;
  isProcessing?: boolean;
  currentTask?: string;
}

const StatusBar: React.FC<StatusBarProps> = ({ 
  onNetworkChange, 
  isProcessing = false,
  currentTask
}) => {
  const [online, setOnline] = useState(isOnline());
  const [showConnectionChange, setShowConnectionChange] = useState(false);
  const [isApiActive, setIsApiActive] = useState(false);
  const [currentApiContext, setCurrentApiContext] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string>('');
  const [showUpdateStatus, setShowUpdateStatus] = useState(false);
  
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
    if (!online) {
      return (
        <span className="status-item offline">
          <span className="status-icon"><i className="fas fa-exclamation-triangle text-warning"></i></span>
          Offline
        </span>
      );
    } else if (showConnectionChange) {
      return (
        <span className="status-item online-restored">
          <span className="status-icon"><i className="fas fa-check text-success"></i></span>
          Connected
        </span>
      );
    } else {
      return (
        <span className="status-item online">
          <span className="status-icon"><i className="fas fa-circle text-success"></i></span>
          Online
        </span>
      );
    }
  };

  const statusBarStyles: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: 26,
    background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
    borderTop: '1px solid #dee2e6',
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    fontSize: 12,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: '#495057',
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
    color: '#adb5bd',
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
      {!online ? (
        <span style={{...statusItemStyles, color: '#dc3545', fontWeight: 600}}>
          <i className="fas fa-exclamation-triangle" style={{...statusIconStyles, color: '#dc3545'}}></i>
          Offline
        </span>
      ) : showConnectionChange ? (
        <span style={{...statusItemStyles, color: '#28a745', fontWeight: 600}} className="status-pulse">
          <i className="fas fa-check" style={{...statusIconStyles, color: '#28a745'}}></i>
          Connected
        </span>
      ) : (
        <span style={{...statusItemStyles, color: '#28a745'}}>
          <i className="fas fa-circle" style={{...statusIconStyles, color: '#28a745', fontSize: '8px'}}></i>
          Online
        </span>
      )}
      
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
          <span style={{...statusItemStyles, color: '#007bff', fontWeight: 600}}>
            <i className="fas fa-spinner status-spinning" style={{...statusIconStyles, color: '#007bff'}}></i>
            <span title={displayedTask}>{truncateText(displayedTask)}</span>
          </span>
        </>
      )}
      
      {/* Update Status */}
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
    </div>
  );
};

export default StatusBar;