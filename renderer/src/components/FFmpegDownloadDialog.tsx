import React, { useState, useEffect, useCallback } from 'react';
import { logger } from '../utils/errorLogger';

interface FFmpegDownloadDialogProps {
  open: boolean;
  onClose: () => void;
  onCompleted: (info: { ready: boolean; path: string | null; source: string | null }) => void;
}

type State = 'idle' | 'downloading' | 'success' | 'error';

const FFmpegDownloadDialog: React.FC<FFmpegDownloadDialogProps> = ({ open, onClose, onCompleted }) => {
  const [state, setState] = useState<State>('idle');
  const [percent, setPercent] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Subscribe to download progress events for the live progress bar.
  useEffect(() => {
    if (!open) return;
    const handler = (_event: any, pct: number) => setPercent(pct);
    window.electronAPI.onFfmpegDownloadProgress(handler);
    return () => {
      window.electronAPI.removeFfmpegDownloadProgressListener(handler);
    };
  }, [open]);

  // Reset internal state each time the dialog opens.
  useEffect(() => {
    if (open) {
      setState('idle');
      setPercent(0);
      setErrorMsg(null);
    }
  }, [open]);

  const handleDownload = useCallback(async () => {
    setState('downloading');
    setPercent(0);
    setErrorMsg(null);
    try {
      const result = await window.electronAPI.triggerFfmpegDownload();
      if (result && result.success) {
        setState('success');
        setPercent(100);
        // Give the user a moment to see the success state, then close.
        setTimeout(() => {
          onCompleted({ ready: true, path: result.path || null, source: result.source || null });
        }, 800);
      } else {
        setState('error');
        setErrorMsg(result?.error || 'Download failed. Check the logs for details.');
      }
    } catch (err) {
      logger.error('FFmpegDownloadDialog', 'Download threw', err);
      setState('error');
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }, [onCompleted]);

  if (!open) return null;

  const isWindows = window.electronAPI.platform === 'win32';

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
        maxWidth: '480px',
        width: '90%',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        border: '1px solid var(--border-color)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <i className="fas fa-download" style={{ fontSize: '24px', color: 'var(--accent-color, #007bff)' }}></i>
          <h2 style={{ margin: 0, fontSize: '18px' }}>Download FFmpeg</h2>
        </div>

        {state === 'idle' && (
          <>
            <p style={{ marginBottom: '16px', lineHeight: '1.5', color: 'var(--text-secondary)' }}>
              FFmpeg is required for media processing and was not found on this system.
              {isWindows
                ? ' Download the bundled FFmpeg (~80 MB) from the AI.Opensubtitles.com release page?'
                : ' On macOS/Linux, the bundled binary is normally shipped with the app. If it is missing, please install FFmpeg via your package manager (e.g. brew install ffmpeg / apt install ffmpeg) and restart.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                style={secondaryButtonStyle}
              >
                Cancel
              </button>
              {isWindows && (
                <button
                  type="button"
                  onClick={handleDownload}
                  style={primaryButtonStyle}
                >
                  Download
                </button>
              )}
            </div>
          </>
        )}

        {state === 'downloading' && (
          <>
            <p style={{ marginBottom: '12px', color: 'var(--text-secondary)' }}>
              Downloading FFmpeg… {percent}%
            </p>
            <div style={{
              width: '100%',
              height: '8px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
              overflow: 'hidden',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{
                width: `${percent}%`,
                height: '100%',
                background: 'var(--accent-color, #007bff)',
                transition: 'width 200ms ease-out'
              }} />
            </div>
            <p style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-secondary)' }}>
              You can keep using the app; this runs in the background.
            </p>
          </>
        )}

        {state === 'success' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <i className="fas fa-check-circle" style={{ fontSize: '22px', color: '#28a745' }}></i>
              <span style={{ fontSize: '15px' }}>FFmpeg is ready.</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="button" onClick={() => onCompleted({ ready: true, path: null, source: null })} style={primaryButtonStyle}>
                Close
              </button>
            </div>
          </>
        )}

        {state === 'error' && (
          <>
            <p style={{ marginBottom: '8px', color: 'var(--danger-color)' }}>
              <i className="fas fa-exclamation-triangle" style={{ marginRight: '6px' }}></i>
              Download failed
            </p>
            <p style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)', fontFamily: 'monospace', wordBreak: 'break-word' }}>
              {errorMsg || 'Unknown error'}
            </p>
            <p style={{ marginBottom: '16px', fontSize: '13px', color: 'var(--text-secondary)' }}>
              You can still install FFmpeg manually and set the path in Preferences → Custom FFmpeg Path.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={onClose} style={secondaryButtonStyle}>Close</button>
              {isWindows && (
                <button type="button" onClick={handleDownload} style={primaryButtonStyle}>Try again</button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  backgroundColor: '#007bff',
  color: 'white',
  border: 'none',
  borderRadius: '4px',
  fontSize: '13px',
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '8px 16px',
  backgroundColor: 'var(--bg-tertiary)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-color)',
  borderRadius: '4px',
  fontSize: '13px',
  cursor: 'pointer',
};

export default FFmpegDownloadDialog;
