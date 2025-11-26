import React, { useState } from 'react';
import AISubtitleModal from './AISubtitleModal';

export interface SubtitleSearchResult {
  id: string;
  type: string;
  attributes: {
    subtitle_id: string;
    language: string;
    download_count: number;
    new_download_count: number;
    hearing_impaired: boolean;
    hd: boolean;
    fps: number;
    votes: number;
    ratings: number;
    from_trusted: boolean;
    foreign_parts_only: boolean;
    upload_date: string;
    ai_translated: boolean;
    nb_cd: number;
    slug: string;
    machine_translated: boolean;
    release: string;
    uploader: {
      uploader_id: number;
      name: string;
      rank: string;
    };
    feature_details: {
      feature_id: number;
      feature_type: string;
      year: number;
      title: string;
      movie_name: string;
      imdb_id: number;
      tmdb_id: number;
    };
    url: string;
    files: Array<{
      file_id: number;
      cd_number: number;
      file_name: string;
    }>;
  };
}

interface SubtitleCardProps {
  result: SubtitleSearchResult;
  onDownload: (fileId: number, fileName: string) => void;
  isDownloading?: boolean;
}

function SubtitleCard({ result, onDownload, isDownloading = false }: SubtitleCardProps) {
  const { attributes } = result;
  const [showAIModal, setShowAIModal] = useState(false);

  const formatFileSize = (fileName: string): string => {
    // Estimate file size based on filename and CD count
    const baseSize = attributes.nb_cd * 50; // Rough estimate: 50KB per CD
    return baseSize > 1000 ? `${(baseSize / 1000).toFixed(1)}MB` : `${baseSize}KB`;
  };

  const getTrustBadge = () => {
    if (attributes.from_trusted) {
      return <span style={{
        background: 'var(--success-color)',
        color: 'white',
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '11px',
        fontWeight: 'bold',
        marginLeft: '8px'
      }}><i className="fas fa-star"></i> TRUSTED</span>;
    }
    return null;
  };

  const getQualityBadges = () => {
    const badges = [];

    if (attributes.hd) {
      badges.push(
        <span key="hd" style={{
          background: 'var(--info-color)',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '8px',
          fontSize: '10px',
          marginRight: '4px'
        }}>HD</span>
      );
    }

    if (attributes.hearing_impaired) {
      badges.push(
        <span key="hi" style={{
          background: 'var(--warning-color)',
          color: 'var(--text-primary)',
          padding: '2px 6px',
          borderRadius: '8px',
          fontSize: '10px',
          marginRight: '4px'
        }}>HI</span>
      );
    }

    if (attributes.ai_translated) {
      badges.push(
        <span key="ai" style={{
          background: '#9C27B0',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '8px',
          fontSize: '10px',
          marginRight: '4px'
        }}>AI</span>
      );
    }

    return badges;
  };

  const formatUploadDate = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString();
    } catch {
      return 'Unknown';
    }
  };

  const getRankColor = (rank: string): { bg: string; text: string } => {
    const rankLower = rank.toLowerCase();
    if (rankLower.includes('trusted') || rankLower.includes('platinum'))
      return { bg: 'var(--success-color)', text: 'white' };
    if (rankLower.includes('gold'))
      return { bg: '#D4AF37', text: 'black' };
    if (rankLower.includes('silver'))
      return { bg: '#C0C0C0', text: 'black' };
    if (rankLower.includes('bronze'))
      return { bg: '#CD7F32', text: 'white' };
    return { bg: 'var(--bg-tertiary)', text: 'var(--text-primary)' };
  };

  const handleDownloadClick = () => {
    if (attributes.files.length > 0) {
      const firstFile = attributes.files[0];
      onDownload(firstFile.file_id, firstFile.file_name);
    }
  };

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '8px',
      padding: '14px',
      marginBottom: '10px',
      transition: 'all 0.2s ease',
      cursor: 'pointer',
    }}
    className="subtitle-card"
    onMouseEnter={(e) => {
      e.currentTarget.style.borderColor = 'var(--primary-color)';
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.borderColor = 'var(--border-color)';
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = 'none';
    }}
    >
      {/* Header - Movie/Show Info */}
      <div style={{ marginBottom: '12px' }}>
        {/* Title Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <h3 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            {attributes.feature_details.feature_type === 'Movie' ? <i className="fas fa-film"></i> : <i className="fas fa-tv"></i>}
            <span>{attributes.feature_details.title}</span>
            {attributes.feature_details.year && (
              <span style={{
                fontSize: '14px',
                fontWeight: '400',
                color: 'var(--text-secondary)'
              }}>
                ({attributes.feature_details.year})
              </span>
            )}
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {getQualityBadges()}
            {getTrustBadge()}
          </div>
        </div>

        {/* Release + IMDb Row */}
        <div style={{
          fontSize: '12px',
          color: 'var(--text-secondary)',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
        title={attributes.release || 'Unknown'}>
          <span>Release: {attributes.release || 'Unknown'}</span>

          {attributes.feature_details.imdb_id && (
            <>
              <span style={{ color: 'var(--border-color)', margin: '0 8px' }}>|</span>
              <span
                style={{
                  cursor: 'pointer',
                  transition: 'color 0.2s ease'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  const imdbUrl = `https://www.imdb.com/title/tt${attributes.feature_details.imdb_id.toString().padStart(7, '0')}`;
                  window.electronAPI?.openExternal(imdbUrl);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--primary-color)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }}
                title="Click to open on IMDb"
              >
                IMDb: {attributes.feature_details.imdb_id}
                <i className="fas fa-external-link-alt" style={{ fontSize: '9px', marginLeft: '3px' }}></i>
              </span>
            </>
          )}
        </div>
      </div>

      {/* Subtitle Details */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px 16px',
        marginBottom: '12px',
        fontSize: '12px',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ minWidth: '100px' }}>
          <span>Language:</span>{' '}
          <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
            {attributes.language.toUpperCase()}
          </span>
        </div>

        <div style={{ minWidth: '110px' }}>
          <span>Downloads:</span>{' '}
          <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
            {attributes.download_count.toLocaleString()}
          </span>
        </div>

        <div style={{ minWidth: '100px' }}>
          <span>File Size:</span>{' '}
          <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
            {formatFileSize(attributes.files[0]?.file_name || '')}
          </span>
        </div>

        {attributes.fps > 0 && (
          <div style={{ minWidth: '80px' }}>
            <span>FPS:</span>{' '}
            <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
              {attributes.fps.toFixed(2)}
            </span>
          </div>
        )}

        <div style={{ minWidth: '60px' }}>
          <span>CDs:</span>{' '}
          <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
            {attributes.nb_cd}
          </span>
        </div>

        <div style={{ minWidth: '120px' }}>
          <span>Uploaded:</span>{' '}
          <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
            {formatUploadDate(attributes.upload_date)}
          </span>
        </div>
      </div>

      {/* Footer: Uploader + Download Button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        paddingTop: '8px',
        borderTop: '1px solid var(--border-color)'
      }}>
        {/* Uploader Info */}
        <div style={{
          fontSize: '11px',
          color: 'var(--text-secondary)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flex: '1 1 auto'
        }}>
          <span>Uploader:</span>
          {attributes.uploader.name === 'AI.OpenSubtitles.com' ? (
            <span
              style={{
                background: '#9C27B0',
                color: 'white',
                padding: '3px 10px',
                borderRadius: '10px',
                fontSize: '10px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'background 0.2s ease'
              }}
              title="This subtitle will be generated on-demand by OpenSubtitles when you download it. Click to learn more."
              onClick={(e) => {
                e.stopPropagation();
                setShowAIModal(true);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#7B1FA2';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#9C27B0';
              }}
            >
              AI.OpenSubtitles.com
              <i className="fas fa-info-circle" style={{ fontSize: '9px' }}></i>
            </span>
          ) : (
            <>
              <span style={{
                fontWeight: '600',
                color: 'var(--text-primary)',
                fontSize: '11px'
              }}>
                {attributes.uploader.name}
              </span>
              {(() => {
                const colors = getRankColor(attributes.uploader.rank);
                return (
                  <span style={{
                    background: colors.bg,
                    color: colors.text,
                    padding: '2px 6px',
                    borderRadius: '8px',
                    fontSize: '9px',
                    fontWeight: '600'
                  }}>
                    {attributes.uploader.rank}
                  </span>
                );
              })()}
            </>
          )}
        </div>

        {/* Download Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDownloadClick();
          }}
          disabled={isDownloading || attributes.files.length === 0}
          style={{
            padding: '7px 16px',
            fontSize: '12px',
            fontWeight: '600',
            background: isDownloading ? 'var(--bg-disabled)' : 'var(--primary-color)',
            color: isDownloading ? 'var(--text-disabled)' : 'var(--button-text)',
            border: 'none',
            borderRadius: '4px',
            cursor: isDownloading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            minWidth: '110px',
            flex: '0 0 auto'
          }}
          onMouseEnter={(e) => {
            if (!isDownloading) {
              e.currentTarget.style.background = 'var(--primary-dark)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isDownloading) {
              e.currentTarget.style.background = 'var(--primary-color)';
            }
          }}
        >
          {isDownloading ? <><i className="fas fa-spinner fa-spin"></i> Downloading...</> : <><i className="fas fa-download"></i> Download SRT</>}
        </button>
      </div>

      {/* AI Subtitle Info Modal */}
      <AISubtitleModal
        isOpen={showAIModal}
        onClose={() => setShowAIModal(false)}
      />
    </div>
  );
}

export default SubtitleCard;