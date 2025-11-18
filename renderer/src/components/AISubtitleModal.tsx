import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';

interface AISubtitleModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function AISubtitleModal({ isOpen, onClose }: AISubtitleModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <>
      {/* Overlay */}
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
        {/* Modal Content */}
        <div
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderRadius: '12px',
            maxWidth: '600px',
            width: '100%',
            maxHeight: '80vh',
            overflow: 'auto',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            border: '1px solid var(--border-color)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <h2 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}>
              <i className="fas fa-robot" style={{ color: '#9C27B0' }}></i>
              AI-Generated Subtitles
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
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Body */}
          <div style={{
            padding: '24px',
            color: 'var(--text-primary)',
            lineHeight: '1.6',
          }}>
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{
                margin: '0 0 12px 0',
                fontSize: '16px',
                fontWeight: '600',
                color: 'var(--text-primary)',
              }}>
                What are AI-Generated Subtitles?
              </h3>
              <p style={{ margin: '0 0 12px 0', fontSize: '14px', color: 'var(--text-secondary)' }}>
                When you see a subtitle result with the uploader <strong style={{ color: '#9C27B0' }}>AI.OpenSubtitles.com</strong>,
                it means this is an <strong>on-demand translation</strong> that will be created by the OpenSubtitles platform
                when you download it.
              </p>
              <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)' }}>
                <strong>Important:</strong> These subtitles don't exist yet when you see them in search results.
                They are generated on-the-fly when you click "Download SRT".
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{
                margin: '0 0 12px 0',
                fontSize: '16px',
                fontWeight: '600',
                color: 'var(--text-primary)',
              }}>
                How It Works
              </h3>
              <ol style={{
                margin: 0,
                paddingLeft: '20px',
                fontSize: '14px',
                color: 'var(--text-secondary)',
              }}>
                <li style={{ marginBottom: '8px' }}>
                  OpenSubtitles identifies that no human translation exists for your language
                </li>
                <li style={{ marginBottom: '8px' }}>
                  When you download, they use <strong>DeepL translation technology</strong> to translate from
                  an existing subtitle in another language
                </li>
                <li style={{ marginBottom: '8px' }}>
                  The translated subtitle is generated and delivered to you
                </li>
              </ol>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <h3 style={{
                margin: '0 0 12px 0',
                fontSize: '16px',
                fontWeight: '600',
                color: 'var(--text-primary)',
              }}>
                Quality Considerations
              </h3>
              <ul style={{
                margin: 0,
                paddingLeft: '20px',
                fontSize: '14px',
                color: 'var(--text-secondary)',
              }}>
                <li style={{ marginBottom: '8px' }}>
                  Quality may vary depending on the source subtitle
                </li>
                <li style={{ marginBottom: '8px' }}>
                  Machine translation may miss context or cultural nuances
                </li>
                <li style={{ marginBottom: '8px' }}>
                  These are typically available when no human-translated subtitles exist
                </li>
                <li>
                  Currently experimental and free to use
                </li>
              </ul>
            </div>

            <div style={{
              padding: '16px',
              background: 'var(--bg-tertiary)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}>
              <p style={{
                margin: 0,
                fontSize: '13px',
                color: 'var(--text-secondary)',
                lineHeight: '1.5',
              }}>
                <i className="fas fa-info-circle" style={{ marginRight: '8px', color: '#9C27B0' }}></i>
                <strong>Note:</strong> This feature is provided by OpenSubtitles.com, not by this application.
                The quality and availability of AI-generated subtitles is determined by their platform.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '500',
                background: 'var(--primary-color)',
                color: 'var(--button-text)',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'background 0.2s ease',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--primary-dark)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'var(--primary-color)'}
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

export default AISubtitleModal;
