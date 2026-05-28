import React from 'react';

interface DownloadQueueBarProps {
  queueLength: number;
  onBatchDownload: () => void;
  onClear: () => void;
  isDownloading: boolean;
  progress: { current: number; total: number };
}

function DownloadQueueBar({
  queueLength,
  onBatchDownload,
  onClear,
  isDownloading,
  progress,
}: DownloadQueueBarProps) {
  if (queueLength === 0 && !isDownloading) return null;

  const progressPercent =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--bg-secondary)',
        borderTop: '2px solid var(--primary-color)',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        zIndex: 100,
        boxShadow: '0 -4px 16px rgba(0,0,0,0.15)',
        flexWrap: 'wrap',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '14px',
          color: 'var(--text-primary)',
          fontWeight: '500',
        }}
      >
        <i className="fas fa-layer-group" style={{ color: 'var(--primary-color)' }}></i>
        {isDownloading ? (
          <>
            <i className="fas fa-spinner fa-spin" style={{ color: 'var(--primary-color)' }}></i>
            <span>
              Downloading {progress.current} of {progress.total}...
            </span>
          </>
        ) : (
          <span>
            {queueLength} file{queueLength !== 1 ? 's' : ''} in queue
          </span>
        )}
      </div>

      {isDownloading && progress.total > 0 && (
        <div
          style={{
            flex: '1 1 200px',
            maxWidth: '400px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <div
            style={{
              flex: 1,
              height: '8px',
              background: 'var(--bg-tertiary)',
              borderRadius: '4px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: 'var(--primary-color)',
                borderRadius: '4px',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
          <span
            style={{
              fontSize: '12px',
              color: 'var(--text-secondary)',
              fontWeight: '600',
              minWidth: '36px',
              textAlign: 'right',
            }}
          >
            {progressPercent}%
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
        {!isDownloading && (
          <>
            <button
              onClick={onBatchDownload}
              style={{
                padding: '8px 20px',
                fontSize: '13px',
                fontWeight: '600',
                background: 'var(--primary-color)',
                color: 'var(--button-text)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--primary-dark)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--primary-color)';
              }}
            >
              <i className="fas fa-download"></i>
              Download All ({queueLength})
            </button>
            <button
              onClick={onClear}
              style={{
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: '500',
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--danger-color)';
                e.currentTarget.style.color = 'var(--danger-color)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <i className="fas fa-times"></i> Clear
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default DownloadQueueBar;
