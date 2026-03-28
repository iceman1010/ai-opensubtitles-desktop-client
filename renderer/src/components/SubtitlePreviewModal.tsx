import React, { useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { parseSubtitleEntries, detectSubtitleFormat, SubtitleEntry } from '../utils/subtitleParser';

interface SubtitlePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  fileName: string;
  onDownload?: () => void;
}

function formatMs(ms: number): string {
  // Convert milliseconds to HH:MM:SS
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatTotalDuration(entries: SubtitleEntry[]): string {
  if (entries.length === 0) return '';
  const lastEndMs = entries[entries.length - 1].end;
  if (lastEndMs <= 0) return '';
  const totalSecs = Math.floor(lastEndMs / 1000);
  const hours = Math.floor(totalSecs / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function SubtitlePreviewModal({ isOpen, onClose, content, fileName, onDownload }: SubtitlePreviewModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const entries = useMemo(() => parseSubtitleEntries(content, fileName), [content, fileName]);
  const format = useMemo(() => detectSubtitleFormat(content, fileName), [content, fileName]);
  const totalChars = useMemo(() => entries.reduce((sum, e) => sum + e.text.length, 0), [entries]);
  const duration = useMemo(() => formatTotalDuration(entries), [entries]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '12px',
          width: '90vw',
          maxWidth: '900px',
          height: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-color)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            <i className="fas fa-eye" style={{ color: 'var(--primary-color)', flexShrink: 0 }}></i>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{fileName}</span>
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px 8px',
              lineHeight: 1,
              flexShrink: 0,
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Stats Bar */}
        <div style={{
          padding: '8px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
          flexShrink: 0,
          flexWrap: 'wrap',
        }}>
          <span style={{
            background: 'var(--primary-color)',
            color: 'var(--button-text)',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '600',
          }}>{format}</span>
          <span>{entries.length.toLocaleString()} entries</span>
          {duration && <><span style={{ color: 'var(--border-color)' }}>&middot;</span><span>{duration}</span></>}
          <span style={{ color: 'var(--border-color)' }}>&middot;</span>
          <span>{totalChars.toLocaleString()} chars</span>
        </div>

        {/* Subtitle Entries */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '4px 0',
          fontFamily: 'monospace',
          fontSize: '13px',
          lineHeight: '1.6',
        }}>
          {entries.length === 0 ? (
            <div style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--text-secondary)',
            }}>
              <i className="fas fa-exclamation-circle" style={{ fontSize: '24px', marginBottom: '12px', display: 'block' }}></i>
              Could not parse subtitle entries from this file.
            </div>
          ) : (
            entries.map((entry, i) => (
              <div
                key={i}
                style={{
                  padding: '3px 16px',
                  background: i % 2 === 0 ? 'transparent' : 'var(--bg-secondary)',
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'baseline',
                }}
              >
                <span style={{
                  color: 'var(--text-disabled)',
                  minWidth: '36px',
                  textAlign: 'right',
                  flexShrink: 0,
                  fontSize: '11px',
                }}>{i + 1}.</span>
                <span style={{
                  color: 'var(--text-secondary)',
                  flexShrink: 0,
                  fontSize: '11px',
                }}>[{formatMs(entry.start)}&rarr;{formatMs(entry.end)}]</span>
                <span style={{
                  color: 'var(--text-primary)',
                  fontFamily: 'inherit',
                }}>{entry.text}</span>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '8px',
          flexShrink: 0,
        }}>
          {onDownload && (
            <button
              onClick={onDownload}
              style={{
                padding: '8px 16px',
                fontSize: '13px',
                fontWeight: '600',
                background: 'var(--primary-color)',
                color: 'var(--button-text)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'background 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-dark)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary-color)'}
            >
              <i className="fas fa-download"></i> Download
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '500',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default SubtitlePreviewModal;
