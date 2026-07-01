import React from 'react';

interface CrashReportData {
  startedAt: string;
  detectedAt: string;
  appVersion: string;
  platform: string;
  platformVersion: string;
  lastStage: string;
  logTail: string[];
}

interface CrashReportModalProps {
  report: CrashReportData;
  onSend: () => void;
  onDismiss: () => void;
}

const CrashReportModal: React.FC<CrashReportModalProps> = ({ report, onSend, onDismiss }) => {
  const logPreview = (report.logTail || []).slice(-15).join('\n');

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000
    }}>
      <div style={{
        background: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
        borderRadius: '10px',
        padding: '24px',
        maxWidth: '560px',
        width: '90%',
        maxHeight: '85vh',
        overflowY: 'auto',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <i className="fas fa-exclamation-triangle" style={{ fontSize: '28px', color: 'var(--danger-color)' }}></i>
          <h2 style={{ margin: 0, fontSize: '20px' }}>Unexpected Closure Detected</h2>
        </div>

        <p style={{ marginBottom: '16px', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
          The application closed unexpectedly during its last session. Would you like to send a
          crash report to support? A pre-filled ticket will be created with the diagnostic details below.
        </p>

        <div style={{
          background: 'var(--bg-primary)',
          borderRadius: '6px',
          padding: '12px',
          marginBottom: '20px',
          fontSize: '12px',
          fontFamily: 'monospace',
          color: 'var(--text-secondary)',
          border: '1px solid var(--border-color)'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <strong>Last stage reached:</strong> {report.lastStage}<br />
            <strong>App version:</strong> {report.appVersion}<br />
            <strong>Platform:</strong> {report.platform} {report.platformVersion}<br />
            <strong>Started at:</strong> {report.startedAt}
          </div>
          {logPreview && (
            <details>
              <summary style={{ cursor: 'pointer', marginBottom: '4px' }}>Last log lines</summary>
              <pre style={{
                margin: '4px 0 0 0',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '180px',
                overflowY: 'auto'
              }}>{logPreview}</pre>
            </details>
          )}
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onDismiss}
            className="btn-secondary"
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              border: '1px solid var(--border-color)',
              background: 'transparent',
              color: 'var(--text-primary)'
            }}
          >
            Dismiss
          </button>
          <button
            onClick={onSend}
            className="btn-primary"
            style={{
              padding: '10px 20px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              background: 'var(--accent-color, #4a90e2)',
              color: '#fff',
              border: 'none'
            }}
          >
            <i className="fas fa-paper-plane" style={{ marginRight: '6px' }}></i>
            Send Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default CrashReportModal;
