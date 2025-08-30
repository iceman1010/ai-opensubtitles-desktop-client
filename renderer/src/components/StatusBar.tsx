import React, { useState, useEffect } from 'react';
import { setupNetworkListeners, isOnline } from '../utils/networkUtils';
import { activityTracker } from '../utils/activityTracker';

interface StatusBarProps {
  onNetworkChange?: (isOnline: boolean) => void;
  isProcessing?: boolean;
  currentTask?: string;
  hasSidebar?: boolean;
}

const StatusBar: React.FC<StatusBarProps> = ({ 
  onNetworkChange, 
  isProcessing = false,
  currentTask,
  hasSidebar = true
}) => {
  const [online, setOnline] = useState(isOnline());
  const [showConnectionChange, setShowConnectionChange] = useState(false);
  const [isApiActive, setIsApiActive] = useState(false);
  
  // State for managing minimum display time of processing status
  const [displayedTask, setDisplayedTask] = useState<string | undefined>(currentTask);
  const [shouldShowProcessing, setShouldShowProcessing] = useState(isProcessing);
  const [lastUpdateTime, setLastUpdateTime] = useState(Date.now());

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
      onActivityStart: () => {
        setIsApiActive(true);
      },
      onActivityEnd: () => {
        setIsApiActive(false);
      }
    });

    return cleanupActivity;
  }, []);

  const getNetworkStatusDisplay = () => {
    if (!online) {
      return (
        <span className="status-item offline">
          <span className="status-icon">⚠</span>
          Offline
        </span>
      );
    } else if (showConnectionChange) {
      return (
        <span className="status-item online-restored">
          <span className="status-icon">✓</span>
          Connected
        </span>
      );
    } else {
      return (
        <span className="status-item online">
          <span className="status-icon">●</span>
          Online
        </span>
      );
    }
  };

  const statusBarStyles: React.CSSProperties = {
    position: 'fixed',
    bottom: 0,
    left: hasSidebar ? 200 : 0,
    right: 0,
    height: 26,
    background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
    borderTop: '1px solid #dee2e6',
    display: 'flex',
    alignItems: 'center',
    padding: hasSidebar ? '0 16px' : '0 12px',
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

  return (
    <div style={statusBarStyles}>
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
          <span style={statusIconStyles}>⚠</span>
          Offline
        </span>
      ) : showConnectionChange ? (
        <span style={{...statusItemStyles, color: '#28a745', fontWeight: 600}} className="status-pulse">
          <span style={statusIconStyles}>✓</span>
          Connected
        </span>
      ) : (
        <span style={{...statusItemStyles, color: '#28a745'}}>
          <span style={statusIconStyles}>●</span>
          Online
        </span>
      )}
      
      {/* API Activity Indicator */}
      {isApiActive && (
        <>
          <span style={statusSeparatorStyles}>|</span>
          <span style={{...statusItemStyles, color: '#6f42c1', fontWeight: 500, fontSize: 11}}>
            <span style={statusIconStyles} className="status-pulsing">◐</span>
            API
          </span>
        </>
      )}
      
      {/* Processing Status */}
      {shouldShowProcessing && displayedTask && (
        <>
          <span style={statusSeparatorStyles}>|</span>
          <span style={{...statusItemStyles, color: '#007bff', fontWeight: 600}}>
            <span style={statusIconStyles} className="status-spinning">⟳</span>
            {displayedTask}
          </span>
        </>
      )}
    </div>
  );
};

export default StatusBar;