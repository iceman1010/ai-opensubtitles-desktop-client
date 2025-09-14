import React, { useState, useEffect } from 'react';

interface UpdateProps {}

interface ReleaseInfo {
  tag_name: string;
  name: string;
  published_at: string;
  body: string;
}

function Update({}: UpdateProps) {
  const [updateStatus, setUpdateStatus] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentVersion, setCurrentVersion] = useState<string>('');
  const [releaseHistory, setReleaseHistory] = useState<ReleaseInfo[]>([]);
  const [showHistory, setShowHistory] = useState(true);

  useEffect(() => {
    // Get current version from package.json
    setCurrentVersion('1.4.8');

    // Set up update status listener
    const handleUpdateStatus = (_event: any, status: { event: string, message: string }) => {
      setUpdateStatus(status.message);
      setIsLoading(status.event === 'checking-for-update' || status.event === 'update-downloading');
    };

    window.electronAPI.onUpdateStatus(handleUpdateStatus);

    // Load release history
    loadReleaseHistory();

    return () => {
      window.electronAPI.removeUpdateStatusListener(handleUpdateStatus);
    };
  }, []);

  const loadReleaseHistory = async () => {
    try {
      // Fetch real releases from GitHub API
      const response = await fetch('https://api.github.com/repos/iceman1010/ai-opensubtitles-desktop-client/releases');
      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }
      
      const releases = await response.json();
      const formattedReleases: ReleaseInfo[] = releases.slice(0, 10).map((release: any) => ({
        tag_name: release.tag_name,
        name: release.name || release.tag_name,
        published_at: release.published_at,
        body: release.body || 'No release notes available.'
      }));
      
      setReleaseHistory(formattedReleases);
    } catch (error) {
      console.error('Failed to load release history:', error);
    }
  };

  const handleCheckForUpdates = async () => {
    setUpdateStatus('Checking for updates...');
    setIsLoading(true);
    try {
      await window.electronAPI.checkForUpdates();
    } catch (error) {
      setUpdateStatus('Failed to check for updates');
      setIsLoading(false);
    }
  };

  const handleInstallUpdate = async () => {
    try {
      await window.electronAPI.installUpdate();
    } catch (error) {
      setUpdateStatus('Failed to install update');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const parseChangelog = (body: string) => {
    // Convert markdown-style changelog to HTML-like structure for display
    return body.replace(/##\s*(.*)/g, '<strong>$1</strong>')
               .replace(/\n- (.*)/g, '\n• $1')
               .split('\n')
               .filter(line => line.trim());
  };

  return (
    <div className="preferences-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      <h1>Updates</h1>
      
      <div className="form-group">
        <div style={{
          padding: '20px',
          backgroundColor: '#f8f9fa',
          border: '1px solid #dee2e6',
          borderRadius: '8px',
          marginBottom: '20px'
        }}>
          <h3 style={{ marginBottom: '15px', fontSize: '18px', color: '#2c3e50' }}>Current Version</h3>
          <div style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            color: '#28a745',
            marginBottom: '20px'
          }}>
            v{currentVersion}
          </div>
          
          <div style={{ marginBottom: '20px' }}>
            <button
              type="button"
              className="button"
              onClick={handleCheckForUpdates}
              disabled={isLoading}
              style={{ 
                marginRight: '10px',
                backgroundColor: '#007bff',
                borderColor: '#007bff',
                color: 'white'
              }}
            >
              {isLoading ? 'Checking...' : 'Check for Updates'}
            </button>
            
            {updateStatus.includes('Update ready:') && (
              <button
                type="button"
                className="button"
                onClick={handleInstallUpdate}
                disabled={isLoading}
                style={{ 
                  marginRight: '10px',
                  backgroundColor: '#28a745',
                  borderColor: '#28a745',
                  color: 'white'
                }}
              >
                Restart & Install
              </button>
            )}
          </div>
          
          {updateStatus && (
            <div style={{ 
              padding: '12px 16px',
              backgroundColor: updateStatus.includes('Update ready:') ? '#d4edda' : 
                             updateStatus.includes('error') ? '#f8d7da' : '#d1ecf1',
              color: updateStatus.includes('Update ready:') ? '#155724' : 
                     updateStatus.includes('error') ? '#721c24' : '#0c5460',
              border: `1px solid ${updateStatus.includes('Update ready:') ? '#c3e6cb' : 
                                  updateStatus.includes('error') ? '#f5c6cb' : '#bee5eb'}`,
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              {updateStatus}
            </div>
          )}
        </div>
      </div>

      <div className="form-group">
        <div style={{
          padding: '20px',
          backgroundColor: '#ffffff',
          border: '1px solid #dee2e6',
          borderRadius: '8px'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '15px'
          }}>
            <h3 style={{ fontSize: '18px', color: '#2c3e50', margin: 0 }}>Release History</h3>
            <button
              type="button"
              onClick={() => setShowHistory(!showHistory)}
              style={{
                backgroundColor: 'transparent',
                border: '1px solid #6c757d',
                color: '#6c757d',
                padding: '6px 12px',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              {showHistory ? 'Hide' : 'Show'} History
            </button>
          </div>
          
          {showHistory && (
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {releaseHistory.map((release, index) => (
                <div 
                  key={release.tag_name}
                  style={{
                    padding: '15px',
                    marginBottom: '15px',
                    backgroundColor: index === 0 ? '#e8f5e8' : '#f8f9fa',
                    border: '1px solid #dee2e6',
                    borderRadius: '6px'
                  }}
                >
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: '10px'
                  }}>
                    <h4 style={{ 
                      fontSize: '16px', 
                      color: '#2c3e50', 
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      {release.name}
                      {index === 0 && (
                        <span style={{
                          backgroundColor: '#28a745',
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '10px',
                          fontWeight: 'bold'
                        }}>
                          CURRENT
                        </span>
                      )}
                    </h4>
                    <span style={{ 
                      fontSize: '12px', 
                      color: '#6c757d' 
                    }}>
                      {formatDate(release.published_at)}
                    </span>
                  </div>
                  
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#495057',
                    lineHeight: '1.5'
                  }}>
                    {parseChangelog(release.body).map((line, lineIndex) => (
                      <div key={lineIndex} style={{ marginBottom: '4px' }}>
                        {line.includes('<strong>') ? (
                          <div dangerouslySetInnerHTML={{ __html: line }} style={{ fontWeight: 'bold', marginTop: lineIndex > 0 ? '12px' : '0' }} />
                        ) : (
                          line
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}

export default Update;