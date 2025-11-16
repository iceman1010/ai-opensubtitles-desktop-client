import React from 'react';

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <h3 style={{
            margin: 0,
            fontSize: '18px',
            fontWeight: 'bold',
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
                fontWeight: 'normal',
                color: 'var(--text-secondary)',
                marginLeft: '8px'
              }}>
                ({attributes.feature_details.year})
              </span>
            )}
            {getTrustBadge()}
          </h3>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {getQualityBadges()}
          </div>
        </div>

        <div style={{
          fontSize: '13px',
          color: 'var(--text-secondary)',
          marginBottom: '8px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
        title={attributes.release || 'Unknown'}>
          Release: {attributes.release || 'Unknown'}
        </div>
      </div>

      {/* Subtitle Details */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: '12px',
        marginBottom: '12px',
        fontSize: '13px'
      }}>
        <div>
          <span style={{ color: 'var(--text-secondary)' }}>Language:</span>{' '}
          <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
            <i className="fas fa-globe"></i> {attributes.language.toUpperCase()}
          </span>
        </div>

        <div>
          <span style={{ color: 'var(--text-secondary)' }}>Downloads:</span>{' '}
          <span style={{ fontWeight: 'bold', color: 'var(--primary-color)' }}>
            <i className="fas fa-download"></i> {attributes.download_count.toLocaleString()}
          </span>
        </div>

        <div>
          <span style={{ color: 'var(--text-secondary)' }}>File Size:</span>{' '}
          <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
            <i className="fas fa-hdd"></i> {formatFileSize(attributes.files[0]?.file_name || '')}
          </span>
        </div>

        {attributes.fps > 0 && (
          <div>
            <span style={{ color: 'var(--text-secondary)' }}>FPS:</span>{' '}
            <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
              <i className="fas fa-clock"></i> {attributes.fps}
            </span>
          </div>
        )}

        <div>
          <span style={{ color: 'var(--text-secondary)' }}>CDs:</span>{' '}
          <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>
            <i className="fas fa-compact-disc"></i> {attributes.nb_cd}
          </span>
        </div>

        <div>
          <span style={{ color: 'var(--text-secondary)' }}>Uploaded:</span>{' '}
          <span style={{ color: 'var(--text-primary)' }}>
            <i className="fas fa-calendar"></i> {formatUploadDate(attributes.upload_date)}
          </span>
        </div>
      </div>

      {/* Uploader Info */}
      <div style={{
        fontSize: '12px',
        color: 'var(--text-secondary)',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        <span><i className="fas fa-user"></i> Uploader:</span>
        <span style={{
          fontWeight: 'bold',
          color: 'var(--text-primary)'
        }}>
          {attributes.uploader.name}
        </span>
        {(() => {
          const colors = getRankColor(attributes.uploader.rank);
          return (
            <span style={{
              background: colors.bg,
              color: colors.text,
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '10px',
              fontWeight: '600'
            }}>
              {attributes.uploader.rank}
            </span>
          );
        })()}
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'flex',
        gap: '10px',
        justifyContent: 'flex-end',
        alignItems: 'center'
      }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleDownloadClick();
          }}
          disabled={isDownloading || attributes.files.length === 0}
          style={{
            padding: '8px 20px',
            fontSize: '13px',
            fontWeight: 'bold',
            background: isDownloading ? 'var(--bg-disabled)' : 'var(--primary-color)',
            color: isDownloading ? 'var(--text-disabled)' : 'var(--button-text)',
            border: 'none',
            borderRadius: '4px',
            cursor: isDownloading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease',
            minWidth: '120px',
          }}
          onMouseEnter={(e) => {
            if (!isDownloading) {
              e.currentTarget.style.background = 'var(--primary-dark)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isDownloading) {
              e.currentTarget.style.background = 'var(--primary-color)';
              e.currentTarget.style.transform = 'translateY(0)';
            }
          }}
        >
          {isDownloading ? <><i className="fas fa-spinner fa-spin"></i> Downloading...</> : <><i className="fas fa-download"></i> Download SRT</>}
        </button>
      </div>
    </div>
  );
}

export default SubtitleCard;