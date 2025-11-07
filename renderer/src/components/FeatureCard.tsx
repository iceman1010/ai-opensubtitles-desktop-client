import React, { useState } from 'react';
import { Feature } from '../services/api';

interface FeatureCardProps {
  feature: Feature;
  onFindSubtitles?: (feature: Feature) => void;
}

function FeatureCard({ feature, onFindSubtitles }: FeatureCardProps) {
  const { attributes } = feature;
  const [imageError, setImageError] = useState(false);

  const getFeatureTypeIcon = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'movie': return <i className="fas fa-film"></i>;
      case 'tvshow': return <i className="fas fa-tv"></i>;
      case 'episode': return <i className="fas fa-tv"></i>;
      default: return <i className="fas fa-video"></i>;
    }
  };

  const getFeatureTypeBadge = (type?: string) => {
    if (!type) return null;

    const colors = {
      'Movie': { bg: 'var(--info-color)', text: 'white' },
      'Tvshow': { bg: 'var(--primary-color)', text: 'white' },
      'Episode': { bg: 'var(--warning-color)', text: 'var(--text-primary)' }
    };

    const color = colors[type as keyof typeof colors] || { bg: 'var(--text-muted)', text: 'white' };

    return (
      <span style={{
        background: color.bg,
        color: color.text,
        padding: '2px 8px',
        borderRadius: '12px',
        fontSize: '10px',
        fontWeight: 'bold',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {type}
      </span>
    );
  };

  const formatSubtitleCount = () => {
    if (!attributes.subtitles_count) return '0 subtitles';
    return `${attributes.subtitles_count.toLocaleString()} subtitle${attributes.subtitles_count !== 1 ? 's' : ''}`;
  };

  const getDisplayTitle = () => {
    if (attributes.parent_title && attributes.feature_type === 'Episode') {
      const season = attributes.season_number ? `S${attributes.season_number}` : '';
      const episode = attributes.episode_number ? `E${attributes.episode_number}` : '';
      const episodeInfo = season && episode ? `${season}${episode}` : season || episode;
      return `${attributes.parent_title}${episodeInfo ? ` (${episodeInfo})` : ''}`;
    }
    return attributes.title || attributes.original_title || 'Unknown Title';
  };

  const getSubtitle = () => {
    if (attributes.parent_title && attributes.feature_type === 'Episode') {
      return attributes.title;
    }
    if (attributes.original_title && attributes.original_title !== attributes.title) {
      return attributes.original_title;
    }
    return null;
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const handleFindSubtitles = () => {
    if (onFindSubtitles) {
      onFindSubtitles(feature);
    }
  };

  const hasImage = attributes.img_url && !attributes.img_url.includes('no-poster.png') && !imageError;

  return (
    <div className="feature-card" style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      height: '100%',
      display: 'flex',
      flexDirection: 'column'
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.transform = 'translateY(-4px)';
      e.currentTarget.style.boxShadow = '0 8px 25px rgba(0,0,0,0.15)';
      e.currentTarget.style.borderColor = 'var(--primary-color)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
      e.currentTarget.style.borderColor = 'var(--border-color)';
    }}>

      {/* Poster Image */}
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '2/3',
        background: hasImage ? 'transparent' : 'var(--bg-tertiary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden'
      }}>
        {hasImage ? (
          <img
            src={attributes.img_url}
            alt={getDisplayTitle()}
            onError={handleImageError}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover'
            }}
          />
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            color: 'var(--text-muted)',
            fontSize: '48px'
          }}>
            {getFeatureTypeIcon(attributes.feature_type)}
            <div style={{
              fontSize: '12px',
              marginTop: '8px',
              textAlign: 'center',
              padding: '0 16px',
              lineHeight: '1.3'
            }}>
              No Poster Available
            </div>
          </div>
        )}

        {/* Feature Type Badge */}
        <div style={{
          position: 'absolute',
          top: '8px',
          right: '8px'
        }}>
          {getFeatureTypeBadge(attributes.feature_type)}
        </div>
      </div>

      {/* Content */}
      <div style={{
        padding: '12px',
        flexGrow: 1,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Title and Year */}
        <div style={{ marginBottom: '8px', flexGrow: 1 }}>
          <h3 style={{
            margin: '0 0 4px 0',
            fontSize: '14px',
            fontWeight: 'bold',
            color: 'var(--text-primary)',
            lineHeight: '1.3',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {getDisplayTitle()}
            {attributes.year && (
              <span style={{
                fontSize: '12px',
                fontWeight: 'normal',
                color: 'var(--text-secondary)',
                marginLeft: '4px'
              }}>
                ({attributes.year})
              </span>
            )}
          </h3>

          {getSubtitle() && (
            <p style={{
              margin: '0',
              fontSize: '12px',
              color: 'var(--text-secondary)',
              fontStyle: 'italic',
              lineHeight: '1.3',
              display: '-webkit-box',
              WebkitLineClamp: 1,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden'
            }}>
              {getSubtitle()}
            </p>
          )}
        </div>

        {/* Metadata */}
        <div style={{
          fontSize: '11px',
          color: 'var(--text-secondary)',
          marginBottom: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}>
          <div><i className="fas fa-download"></i> {formatSubtitleCount()}</div>
          {attributes.imdb_id && (
            <div><i className="fas fa-external-link-alt"></i> IMDb: {attributes.imdb_id}</div>
          )}
        </div>

        {/* Action Button */}
        {onFindSubtitles && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleFindSubtitles();
            }}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '12px',
              fontWeight: 'bold',
              background: 'var(--primary-color)',
              color: 'var(--button-text)',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginTop: 'auto'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--primary-dark)';
              e.currentTarget.style.transform = 'scale(1.02)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--primary-color)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Find Subtitles
          </button>
        )}
      </div>
    </div>
  );
}

export default FeatureCard;