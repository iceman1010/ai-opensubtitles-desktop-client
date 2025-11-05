import React, { useState, useEffect } from 'react';
import { parse } from '@plussub/srt-vtt-parser';
import { SubtitleSearchResult } from './SubtitleCard';
import { useAPI } from '../contexts/APIContext';

interface SubtitleEntry {
  id: string;
  from: number;
  to: number;
  text: string;
}

interface SubtitlePreviewProps {
  result: SubtitleSearchResult | null;
  isOpen: boolean;
  onClose: () => void;
  onDownload: (fileId: number, fileName: string) => void;
}

function SubtitlePreview({ result, isOpen, onClose, onDownload }: SubtitlePreviewProps) {
  const [subtitleEntries, setSubtitleEntries] = useState<SubtitleEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloadedContent, setDownloadedContent] = useState<string | null>(null);
  const { downloadSubtitle } = useAPI();

  const formatTime = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const parseSubtitleContent = (content: string): SubtitleEntry[] => {
    try {
      // Try to parse as SRT/VTT using the parser
      const parsed = parse(content);

      return parsed.entries.map((entry: any) => ({
        id: entry.id || '',
        from: entry.from || 0,
        to: entry.to || 0,
        text: entry.text || '',
      }));
    } catch (parseError) {
      console.error('Failed to parse subtitle content:', parseError);

      // Fallback: Try basic SRT parsing
      try {
        const srtBlocks = content.split('\n\n').filter(block => block.trim());
        const entries: SubtitleEntry[] = [];

        for (const block of srtBlocks.slice(0, 10)) { // Limit to first 10 entries
          const lines = block.trim().split('\n');
          if (lines.length >= 3) {
            const id = lines[0];
            const timecode = lines[1];
            const text = lines.slice(2).join('\n');

            // Basic time parsing for SRT format (00:00:20,000 --> 00:00:24,400)
            const timeMatch = timecode.match(/(\d{2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{3})/);
            if (timeMatch) {
              const [, h1, m1, s1, ms1, h2, m2, s2, ms2] = timeMatch;
              const fromMs = (parseInt(h1) * 3600 + parseInt(m1) * 60 + parseInt(s1)) * 1000 + parseInt(ms1);
              const toMs = (parseInt(h2) * 3600 + parseInt(m2) * 60 + parseInt(s2)) * 1000 + parseInt(ms2);

              entries.push({
                id,
                from: fromMs,
                to: toMs,
                text: text.trim(),
              });
            }
          }
        }

        return entries;
      } catch (fallbackError) {
        console.error('Fallback SRT parsing also failed:', fallbackError);
        throw new Error('Unable to parse subtitle content');
      }
    }
  };

  const loadSubtitlePreview = async () => {
    if (!result || !result.attributes.files.length) return;

    setIsLoading(true);
    setError(null);
    setSubtitleEntries([]);

    try {
      const firstFile = result.attributes.files[0];

      // Download the subtitle file
      const downloadResult = await downloadSubtitle({
        file_id: firstFile.file_id,
      });

      if (!downloadResult.success) {
        throw new Error(downloadResult.error || 'Failed to download subtitle');
      }

      // The download endpoint returns a link, we need to fetch the actual content
      const subtitleUrl = downloadResult.data?.link;
      if (!subtitleUrl) {
        throw new Error('No download link received');
      }

      // Fetch the subtitle content
      const response = await fetch(subtitleUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch subtitle content: ${response.status}`);
      }

      const content = await response.text();
      setDownloadedContent(content);

      // Parse the subtitle content
      const entries = parseSubtitleContent(content);
      setSubtitleEntries(entries.slice(0, 10)); // Show first 10 entries

    } catch (err) {
      console.error('Error loading subtitle preview:', err);
      setError(err instanceof Error ? err.message : 'Failed to load subtitle preview');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && result) {
      loadSubtitlePreview();
    } else {
      setSubtitleEntries([]);
      setError(null);
      setDownloadedContent(null);
    }
  }, [isOpen, result]);

  const handleDownload = () => {
    if (result && result.attributes.files.length > 0) {
      const firstFile = result.attributes.files[0];
      onDownload(firstFile.file_id, firstFile.file_name);
      onClose();
    }
  };

  if (!isOpen || !result) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
    }}
    onClick={onClose}
    >
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '80%',
        border: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
      }}
      onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: '20px',
              fontWeight: 'bold',
              color: 'var(--text-primary)',
            }}>
              📄 Subtitle Preview
            </h2>
            <p style={{
              margin: '4px 0 0',
              fontSize: '14px',
              color: 'var(--text-secondary)',
            }}>
              {result.attributes.feature_details.title} ({result.attributes.feature_details.year})
            </p>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '8px',
              borderRadius: '4px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-secondary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px',
        }}>
          {isLoading && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '40px',
              fontSize: '16px',
              color: 'var(--text-secondary)',
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '16px' }}>🔄</div>
                <div>Loading subtitle preview...</div>
              </div>
            </div>
          )}

          {error && (
            <div style={{
              background: 'var(--danger-bg)',
              color: 'var(--danger-color)',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid var(--danger-color)',
              marginBottom: '20px',
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>❌ Error</div>
              <div>{error}</div>
            </div>
          )}

          {subtitleEntries.length > 0 && (
            <div>
              <div style={{
                fontSize: '14px',
                color: 'var(--text-secondary)',
                marginBottom: '16px',
                padding: '12px',
                background: 'var(--bg-secondary)',
                borderRadius: '6px',
              }}>
                ℹ️ Showing first {subtitleEntries.length} subtitle entries. Download the full file to see all content.
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {subtitleEntries.map((entry, index) => (
                  <div key={`${entry.id}-${index}`} style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '12px',
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '8px',
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                    }}>
                      <span>#{entry.id || index + 1}</span>
                      <span>
                        ⏰ {formatTime(entry.from)} → {formatTime(entry.to)}
                      </span>
                    </div>
                    <div style={{
                      fontSize: '14px',
                      lineHeight: '1.4',
                      color: 'var(--text-primary)',
                      whiteSpace: 'pre-wrap',
                    }}>
                      {entry.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '10px 20px',
              fontSize: '14px',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>

          <button
            onClick={handleDownload}
            disabled={isLoading || !!error}
            style={{
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 'bold',
              background: isLoading || error ? 'var(--bg-disabled)' : 'var(--primary-color)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: isLoading || error ? 'not-allowed' : 'pointer',
            }}
          >
            📥 Download Full Subtitle
          </button>
        </div>
      </div>
    </div>
  );
}

export default SubtitlePreview;