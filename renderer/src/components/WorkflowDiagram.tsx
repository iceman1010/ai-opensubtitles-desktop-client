import React from 'react';

type SearchType = 'features' | 'subtitles' | 'file';

interface WorkflowDiagramProps {
  searchType: SearchType;
  hasSearched?: boolean;
}

interface WorkflowStep {
  icon: string;
  label: string;
  sublabel?: string;
}

function WorkflowDiagram({ searchType, hasSearched = false }: WorkflowDiagramProps) {
  const getWorkflowSteps = (): WorkflowStep[] => {
    switch (searchType) {
      case 'features':
        return [
          { icon: 'fa-video', label: 'Enter Movie', sublabel: 'Title' },
          { icon: 'fa-search', label: 'OpenSubs', sublabel: 'Database Search' },
          { icon: 'fa-film', label: 'Find Subtitles', sublabel: 'for Movie' }
        ];
      case 'subtitles':
        return [
          { icon: 'fa-language', label: 'Select', sublabel: 'Language' },
          { icon: 'fa-search', label: 'Search', sublabel: 'Subtitles' },
          { icon: 'fa-download', label: 'Download', sublabel: 'Subtitle' }
        ];
      case 'file':
        return [
          { icon: 'fa-file-video', label: 'Select Local', sublabel: 'Video' },
          { icon: 'fa-fingerprint', label: 'Calculate Hash', sublabel: '(Locally)' },
          { icon: 'fa-search', label: 'Search Database', sublabel: 'with Hash' },
          { icon: 'fa-download', label: 'Download', sublabel: 'Subtitle' }
        ];
    }
  };

  const getTips = (): string[] => {
    switch (searchType) {
      case 'features':
        return [
          'Try different movie titles or year',
          'Use the "Search Subtitles" tab if you know the IMDb ID',
          'Use "Search by File" for most accurate results'
        ];
      case 'subtitles':
        return [
          'If searching rare language, AI translation creates subtitles on-demand',
          'Quality depends on source language similarity',
          'Try "Search Movies" first to find the right movie',
          'Use IMDb ID from advanced options for precise results'
        ];
      case 'file':
        return [
          'Most accurate method - finds subtitles matching your exact video file',
          'Works even if you don\'t know the movie title',
          'Your video file stays on your computer - only the hash is sent',
          'File hash identifies your exact video version'
        ];
    }
  };

  const getAINote = (): string | null => {
    if (searchType === 'subtitles') {
      return 'No subtitles in your language? AI translation finds the best source language and translates it on-demand using DeepL.';
    }
    if (searchType === 'file') {
      return 'Privacy: Your video file never leaves your computer - only a unique hash is sent to our servers.';
    }
    return null;
  };

  const steps = getWorkflowSteps();
  const tips = getTips();
  const aiNote = getAINote();

  return (
    <div style={{
      padding: '40px 20px',
      textAlign: 'center',
      maxWidth: '900px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '40px' }}>
        <h2 style={{
          fontSize: '24px',
          color: 'var(--text-primary)',
          marginBottom: '12px',
          fontWeight: '600'
        }}>
          {hasSearched ? 'No Results Found' : 'How It Works'}
        </h2>
        <p style={{
          fontSize: '16px',
          color: 'var(--text-secondary)',
          margin: 0
        }}>
          {hasSearched
            ? `No ${searchType === 'features' ? 'movies or TV shows' : 'subtitles'} found. Here's how to get better results:`
            : `Here's how ${searchType === 'features' ? 'movie' : searchType === 'subtitles' ? 'subtitle' : 'file'} search works:`
          }
        </p>
      </div>

      {/* Workflow Diagram */}
      <div style={{
        padding: '15px',
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: '8px',
        marginBottom: '40px',
        maxWidth: '700px',
        margin: '0 auto 40px auto'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          flexWrap: 'wrap'
        }}>
          {steps.map((step, index) => (
            <React.Fragment key={index}>
              <div style={{ textAlign: 'center', flex: '0 0 auto', minWidth: '80px' }}>
                <div style={{ fontSize: '24px', marginBottom: '5px' }}>
                  <i className={`fas ${step.icon}`}></i>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {step.label}
                </div>
                {step.sublabel && (
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)', opacity: 0.8 }}>
                    {step.sublabel}
                  </div>
                )}
              </div>
              {index < steps.length - 1 && (
                <i className="fas fa-arrow-right" style={{ color: 'var(--primary-color)', flex: '0 0 auto' }}></i>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* AI Note */}
      {aiNote && (
        <div style={{
          background: searchType === 'subtitles' ? 'rgba(255, 165, 0, 0.1)' : 'rgba(74, 144, 226, 0.1)',
          border: `1px solid ${searchType === 'subtitles' ? 'rgba(255, 165, 0, 0.3)' : 'rgba(74, 144, 226, 0.3)'}`,
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '30px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          textAlign: 'left'
        }}>
          <i className={`fas ${searchType === 'subtitles' ? 'fa-robot' : 'fa-shield-alt'}`} style={{
            fontSize: '24px',
            color: searchType === 'subtitles' ? '#FF8C00' : '#4A90E2',
            flexShrink: 0
          }}></i>
          <div style={{
            fontSize: '14px',
            color: 'var(--text-primary)',
            lineHeight: '1.5'
          }}>
            {aiNote}
          </div>
        </div>
      )}

      {/* Tips Section */}
      <div style={{
        background: 'var(--bg-secondary)',
        borderRadius: '8px',
        padding: '24px',
        textAlign: 'left'
      }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: '600',
          color: 'var(--text-primary)',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <i className="fas fa-lightbulb" style={{ color: '#FFD700' }}></i>
          Tips to get better results:
        </h3>
        <ul style={{
          margin: 0,
          paddingLeft: '20px',
          listStyle: 'none'
        }}>
          {tips.map((tip, index) => (
            <li key={index} style={{
              fontSize: '14px',
              color: 'var(--text-secondary)',
              marginBottom: '8px',
              lineHeight: '1.5',
              position: 'relative',
              paddingLeft: '24px'
            }}>
              <i className="fas fa-check-circle" style={{
                position: 'absolute',
                left: 0,
                top: '4px',
                color: '#28a745',
                fontSize: '14px'
              }}></i>
              {tip}
            </li>
          ))}
        </ul>
      </div>

      {/* Mobile Responsive CSS */}
      <style>{`
        @media (max-width: 768px) {
          .workflow-step-arrow {
            transform: rotate(90deg);
          }
        }
      `}</style>
    </div>
  );
}

export default WorkflowDiagram;
