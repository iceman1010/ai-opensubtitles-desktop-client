import React, { useState, useEffect } from 'react';
import { setupNetworkListeners, isOnline } from '../utils/networkUtils';

interface NetworkStatusProps {
  onNetworkChange?: (isOnline: boolean) => void;
}

const NetworkStatus: React.FC<NetworkStatusProps> = ({ onNetworkChange }) => {
  const [online, setOnline] = useState(isOnline());
  const [justWentOnline, setJustWentOnline] = useState(false);

  useEffect(() => {
    const cleanup = setupNetworkListeners(
      () => {
        setOnline(true);
        setJustWentOnline(true);
        onNetworkChange?.(true);
        
        // Hide the "back online" message after a few seconds
        setTimeout(() => {
          setJustWentOnline(false);
        }, 3000);
      },
      () => {
        setOnline(false);
        setJustWentOnline(false);
        onNetworkChange?.(false);
      }
    );

    return cleanup;
  }, [onNetworkChange]);

  if (online && !justWentOnline) {
    return null; // Don't show anything when online (normal state)
  }

  return (
    <div className={`network-status ${online ? 'online' : 'offline'}`}>
      {online ? (
        justWentOnline ? (
          <>
            <span className="status-icon"><i className="fas fa-check text-success"></i></span>
            Connection restored
          </>
        ) : null
      ) : (
        <>
          <span className="status-icon"><i className="fas fa-exclamation-triangle text-warning"></i></span>
          No internet connection
        </>
      )}
      
      <style jsx>{`
        .network-status {
          position: fixed;
          top: 10px;
          right: 10px;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
          animation: slideIn 0.3s ease-out;
        }
        
        .network-status.offline {
          background-color: var(--danger-color);
          color: white;
          border: 1px solid #c82333;
        }
        
        .network-status.online {
          background-color: #28a745;
          color: white;
          border: 1px solid #1e7e34;
        }
        
        .status-icon {
          font-size: 16px;
        }
        
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default NetworkStatus;