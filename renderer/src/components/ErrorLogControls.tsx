import React, { useState, useEffect } from 'react';
import { logger } from '../utils/errorLogger';

function ErrorLogControls() {
  const [errorCount, setErrorCount] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const updateErrorCount = () => {
      setErrorCount(logger.getErrorCount());
    };

    // Update error count periodically
    const interval = setInterval(updateErrorCount, 1000);
    updateErrorCount(); // Initial update

    return () => clearInterval(interval);
  }, []);

  const handleExportLogs = () => {
    logger.exportLogs();
  };

  const handleCopyLogs = async () => {
    try {
      await logger.copyLogsToClipboard();
      alert('Logs copied to clipboard!');
    } catch (error) {
      alert('Failed to copy logs to clipboard');
    }
  };

  const handleClearLogs = () => {
    logger.clear();
    setErrorCount(0);
  };

  const recentErrors = logger.getRecentErrors(5);

  // Only show the error controls if there are errors
  if (errorCount === 0) {
    return null;
  }

  return (
    <div className="error-log-controls" style={{
      position: 'fixed',
      bottom: '40px', // Moved up from 10px to avoid overlap with StatusBar
      right: '10px',
      background: 'var(--bg-secondary)',
      padding: '10px',
      borderRadius: '5px',
      boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
      zIndex: 1000
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '12px', color: errorCount > 0 ? 'red' : 'green' }}>
          Errors: {errorCount}
        </span>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ fontSize: '12px', padding: '2px 8px' }}
        >
          {isExpanded ? 'Hide' : 'Show'} Logs
        </button>
      </div>

      {isExpanded && (
        <div style={{ marginTop: '10px' }}>
          <div style={{ display: 'flex', gap: '5px', marginBottom: '10px' }}>
            <button onClick={handleExportLogs} style={{ fontSize: '11px', padding: '2px 6px' }}>
              Export All
            </button>
            <button onClick={handleCopyLogs} style={{ fontSize: '11px', padding: '2px 6px' }}>
              Copy All
            </button>
            <button onClick={handleClearLogs} style={{ fontSize: '11px', padding: '2px 6px' }}>
              Clear
            </button>
          </div>

          {recentErrors.length > 0 && (
            <div style={{
              maxHeight: '200px',
              overflow: 'auto',
              fontSize: '10px',
              background: 'var(--bg-primary)',
              padding: '5px',
              border: '1px solid var(--border-color)'
            }}>
              <strong>Recent Errors (last 5 min):</strong>
              {recentErrors.map((error, index) => (
                <div key={index} style={{
                  marginTop: '5px',
                  padding: '3px',
                  background: 'var(--danger-bg)',
                  borderLeft: '3px solid var(--danger-color)'
                }}>
                  <div><strong>{error.timestamp}</strong> [{error.category}]</div>
                  <div>{error.message}</div>
                  {error.data && (
                    <div style={{ marginTop: '2px', color: 'var(--text-secondary)' }}>
                      {JSON.stringify(error.data, null, 2)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ErrorLogControls;