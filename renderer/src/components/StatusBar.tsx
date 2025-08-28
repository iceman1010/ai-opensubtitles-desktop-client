import React, { useState, useEffect } from 'react';
import { setupNetworkListeners, isOnline } from '../utils/networkUtils';

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

  return (
    <div className={`status-bar ${hasSidebar ? 'with-sidebar' : ''}`}>
      {/* Network Status */}
      {getNetworkStatusDisplay()}
      
      {/* Processing Status */}
      {isProcessing && currentTask && (
        <>
          <span className="status-separator">|</span>
          <span className="status-item processing">
            <span className="status-icon spinning">⟳</span>
            {currentTask}
          </span>
        </>
      )}
      
      <style jsx>{`
        .status-bar {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          height: 26px;
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          border-top: 1px solid #dee2e6;
          display: flex;
          align-items: center;
          padding: 0 12px;
          font-size: 12px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: #495057;
          z-index: 998; /* Lower than modals but above content */
          user-select: none;
        }
        
        /* Adjust for sidebar - avoid overlapping with sidebar version display */
        .status-bar.with-sidebar {
          left: 200px; /* Standard sidebar width */
          padding-left: 16px;
        }
        
        .status-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-weight: 500;
        }
        
        .status-item.offline {
          color: #dc3545;
          font-weight: 600;
        }
        
        .status-item.online {
          color: #28a745;
        }
        
        .status-item.online-restored {
          color: #28a745;
          font-weight: 600;
          animation: pulse 2s ease-in-out;
        }
        
        .status-item.processing {
          color: #007bff;
          font-weight: 600;
        }
        
        .status-separator {
          margin: 0 8px;
          color: #adb5bd;
          font-weight: normal;
        }
        
        .status-icon {
          font-size: 11px;
          line-height: 1;
          display: inline-block;
        }
        
        .status-icon.spinning {
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        /* Responsive adjustments */
        @media (max-width: 768px) {
          .status-bar {
            left: 0 !important; /* Full width on mobile */
            font-size: 11px;
            padding: 0 8px;
            height: 24px;
          }
          
          .status-separator {
            margin: 0 6px;
          }
        }
        
        /* When sidebar is collapsed/hidden */
        @media (max-width: 900px) {
          .status-bar.with-sidebar {
            left: 0;
            padding-left: 12px;
          }
        }
      `}</style>
    </div>
  );
};

export default StatusBar;