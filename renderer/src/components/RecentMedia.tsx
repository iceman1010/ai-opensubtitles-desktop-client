import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAPI } from '../contexts/APIContext';
import { UncontrolledTreeEnvironment, StaticTreeDataProvider, Tree, TreeItem, TreeItemIndex } from 'react-complex-tree';
import 'react-complex-tree/lib/style-modern.css';

interface RecentMediaItem {
  id: number;
  time: number;
  time_str: string;
  files?: string[];
}

interface AppConfig {
  username: string;
  password: string;
  apiKey?: string;
  lastUsedLanguage?: string;
  debugMode?: boolean;
  hideRecentMediaInfoPanel?: boolean;
  darkMode?: boolean;
  credits?: {
    used: number;
    remaining: number;
  };
}

interface RecentMediaProps {
  setAppProcessing: (processing: boolean, task?: string) => void;
  isVisible?: boolean;
  config?: AppConfig | null;
  onConfigUpdate?: (newConfig: Partial<AppConfig>) => Promise<void>;
}

interface TreeData {
  [key: string]: TreeItem<any>;
}

function RecentMedia({ setAppProcessing, isVisible = true, config, onConfigUpdate }: RecentMediaProps) {
  const { getRecentMedia, isAuthenticated, downloadRecentMediaFile } = useAPI();

  const [recentMedia, setRecentMedia] = useState<RecentMediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedItem, setFocusedItem] = useState<TreeItemIndex>();
  const [expandedItems, setExpandedItems] = useState<TreeItemIndex[]>([]);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const loadingRef = useRef(false);

  // Get info panel visibility from config (default to true if not set)
  const showInfoPanel = !config?.hideRecentMediaInfoPanel;

  const loadRecentMedia = useCallback(async () => {
    // Prevent multiple simultaneous calls using ref
    if (loadingRef.current) {
      return;
    }

    if (!isAuthenticated) {
      setError('Please log in to view recent media');
      return;
    }

    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    setAppProcessing(true, 'Loading recent media...');

    try {
      const result = await getRecentMedia();

      if (result.success && result.data) {
        setRecentMedia(result.data);
        setHasLoadedOnce(true);
      } else {
        throw new Error(result.error || 'Failed to load recent media');
      }
    } catch (error: any) {
      console.error('Error loading recent media:', error);
      setError(error.message || 'Failed to load recent media');
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
      setAppProcessing(false);
    }
  }, [getRecentMedia, isAuthenticated, setAppProcessing]);

  useEffect(() => {
    if (isAuthenticated && isVisible && !hasLoadedOnce) {
      loadRecentMedia();
    }
  }, [isAuthenticated, isVisible, hasLoadedOnce, loadRecentMedia]);

  const formatDateTime = (timeStr: string) => {
    try {
      const date = new Date(timeStr.replace(' GMT', 'Z'));
      return date.toLocaleString();
    } catch {
      return timeStr;
    }
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.toLowerCase().split('.').pop();
    switch (ext) {
      case 'srt':
      case 'vtt':
      case 'ass':
      case 'ssa':
        return 'fa-file-alt';
      case 'mp4':
      case 'avi':
      case 'mkv':
      case 'mov':
        return 'fa-file-video';
      case 'mp3':
      case 'wav':
      case 'flac':
        return 'fa-file-audio';
      default:
        return 'fa-file';
    }
  };

  // Convert RecentMediaItem[] to react-complex-tree data structure
  const treeData = useMemo<TreeData>(() => {
    const data: TreeData = {
      root: {
        index: 'root',
        isFolder: true,
        children: recentMedia.map(item => `media-${item.id}`),
        data: 'Recent Media'
      }
    };

    recentMedia.forEach(item => {
      // Media folder
      data[`media-${item.id}`] = {
        index: `media-${item.id}`,
        isFolder: true,
        children: item.files ? item.files.map((_, fileIndex) => `file-${item.id}-${fileIndex}`) : [],
        data: {
          type: 'media',
          id: item.id,
          title: `ID: ${item.id}`,
          subtitle: formatDateTime(item.time_str),
          filesCount: item.files ? item.files.length : 0
        }
      };

      // File items
      if (item.files) {
        item.files.forEach((file, fileIndex) => {
          data[`file-${item.id}-${fileIndex}`] = {
            index: `file-${item.id}-${fileIndex}`,
            isFolder: false,
            children: [],
            data: {
              type: 'file',
              fileName: file,
              icon: getFileIcon(file),
              mediaId: item.id
            }
          };
        });
      }
    });

    return data;
  }, [recentMedia]);

  if (!isAuthenticated) {
    return (
      <div className="recent-media-screen" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
        <h1>Recent Media</h1>
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: 'var(--text-secondary)'
        }}>
          <i className="fas fa-user-lock" style={{ fontSize: '48px', marginBottom: '20px', display: 'block' }}></i>
          <p>Please log in to view your recent media</p>
        </div>
      </div>
    );
  }

  const handleRefresh = () => {
    setHasLoadedOnce(false);
    setRecentMedia([]);
    loadRecentMedia();
  };

  const handleDownloadFile = async (fileKey: string, fileName: string) => {
    // Extract mediaId from fileKey (file-{mediaId}-{fileIndex})
    const mediaIdMatch = fileKey.match(/^file-(\d+)-\d+$/);
    if (!mediaIdMatch) {
      setError('Invalid file reference');
      return;
    }

    const mediaId = parseInt(mediaIdMatch[1]);

    try {
      setAppProcessing(true, `Downloading ${fileName}...`);
      setError(null);

      // Download file content
      const result = await downloadRecentMediaFile(mediaId, fileName);

      if (result.success && result.content) {
        // Show save dialog
        const savedPath = await window.electronAPI.saveFile(result.content, fileName);

        if (savedPath) {
          // Success - file was saved
          console.log(`File saved successfully: ${savedPath}`);
        }
        // If savedPath is null, user cancelled the save dialog - no error needed
      } else {
        setError(`Failed to download ${fileName}: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Download error:', error);
      setError(`Failed to download ${fileName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setAppProcessing(false);
    }
  };

  return (
    <div className="recent-media-screen" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px', position: 'relative' }}>
      <h1>Recent Media</h1>

      {/* Floating Refresh Button - positioned under credits overlay */}
      {isAuthenticated && (
        <button
          onClick={handleRefresh}
          disabled={isLoading}
          style={{
            position: 'fixed',
            top: '70px',
            right: '20px',
            padding: '8px 12px',
            backgroundColor: isLoading ? '#ccc' : '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '13px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            zIndex: 999,
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            if (!isLoading) {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
          }}
        >
          {isLoading ? (
            <>
              <span style={{
                display: 'inline-block',
                width: '12px',
                height: '12px',
                border: '2px solid white',
                borderTop: '2px solid transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite'
              }}></span>
              Loading...
            </>
          ) : (
            <>
              <i className="fas fa-sync-alt"></i>
              Refresh
            </>
          )}
        </button>
      )}

      {error && (
        <div style={{
          background: 'var(--danger-color)',
          color: 'var(--bg-primary)',
          padding: '12px',
          borderRadius: '4px',
          marginBottom: '20px',
          border: '1px solid var(--danger-color)',
          opacity: '0.9'
        }}>
          <i className="fas fa-exclamation-triangle" style={{ marginRight: '8px' }}></i>
          {error}
        </div>
      )}

      {isLoading && recentMedia.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
          <i className="fas fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '20px', display: 'block' }}></i>
          <p>Loading recent media...</p>
        </div>
      ) : recentMedia.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: 'var(--text-secondary)'
        }}>
          <i className="fas fa-folder-open" style={{ fontSize: '48px', marginBottom: '20px', display: 'block' }}></i>
          <p>No recent media found</p>
          <small>Your transcriptions and translations will appear here</small>
        </div>
      ) : (
        <div style={{
          flex: showInfoPanel ? 1 : '1 1 calc(100% - 120px)', // Expand more when info panel is hidden
          overflowY: 'auto',
          background: 'var(--bg-secondary)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          padding: '8px',
          minHeight: showInfoPanel ? 'auto' : 'calc(100vh - 180px)' // Take more height when info panel is hidden
        }}>
          <style>{`
            /* Reset react-complex-tree default styling */
            .rct-tree {
              background: transparent !important;
              border: none !important;
              font-family: inherit !important;
            }

            /* Remove ugly borders and outlines */
            .rct-tree-item {
              border: none !important;
              outline: none !important;
              box-shadow: none !important;
              background: transparent !important;
              padding: 4px 0 !important;
              margin: 0 !important;
              border-radius: 0 !important;
            }

            /* Remove focus borders */
            .rct-tree-item[data-rct-item-focused="true"] {
              outline: none !important;
              box-shadow: none !important;
              border: none !important;
              background: var(--bg-primary) !important;
              border-radius: 4px !important;
            }

            /* Clean hover states */
            .rct-tree-item:hover {
              background: var(--bg-primary) !important;
              border-radius: 4px !important;
              border: none !important;
              outline: none !important;
            }

            /* Fix tree item container */
            .rct-tree-item-li {
              list-style: none !important;
              margin: 0 !important;
              padding: 0 !important;
            }

            /* Clean up tree item title container */
            .rct-tree-item-title-container {
              padding: 4px 8px !important;
              margin: 0 !important;
              background: transparent !important;
              border: none !important;
              outline: none !important;
            }

            /* Remove default button styling */
            .rct-tree-item-button {
              background: transparent !important;
              border: none !important;
              outline: none !important;
              padding: 0 !important;
              margin: 0 !important;
              width: 100% !important;
              text-align: left !important;
              cursor: pointer !important;
            }

            /* Clean arrow styling */
            .rct-tree-item-arrow {
              background: transparent !important;
              border: none !important;
              outline: none !important;
              margin-right: 8px !important;
              padding: 0 !important;
              display: inline-flex !important;
              align-items: center !important;
              justify-content: center !important;
              width: 16px !important;
              height: 16px !important;
            }

            /* Tree structure lines */
            .rct-tree-item-li::before {
              display: none !important;
            }

            /* Indentation for child items */
            .rct-tree-item[data-rct-tree-item-depth="1"] {
              padding-left: 20px !important;
            }
            .rct-tree-item[data-rct-tree-item-depth="2"] {
              padding-left: 40px !important;
            }

            /* Clean selected state */
            .rct-tree-item[data-rct-item-selected="true"] {
              background: var(--primary-color) !important;
              color: white !important;
              border-radius: 4px !important;
            }

            /* Remove any drag and drop visual artifacts */
            .rct-tree-item-drag-over-top,
            .rct-tree-item-drag-over-bottom {
              display: none !important;
            }

            /* Improved hover and focus states for better UX */
            .rct-tree-item:hover .rct-tree-item-title-container {
              background: var(--bg-primary) !important;
              border-radius: 6px !important;
            }

            .rct-tree-item[data-rct-item-focused="true"] .rct-tree-item-title-container {
              background: var(--bg-primary) !important;
              border-radius: 6px !important;
            }

            /* Clean up any unwanted margins/padding */
            .rct-tree-container {
              padding: 0 !important;
              margin: 0 !important;
            }

            .rct-tree-items {
              list-style: none !important;
              padding: 0 !important;
              margin: 0 !important;
            }

            /* Smooth transitions for better interaction feel */
            .rct-tree-item-title-container {
              transition: background-color 0.15s ease, border-radius 0.15s ease !important;
            }

            /* Ensure proper spacing between tree levels */
            .rct-tree-item[data-rct-tree-item-depth="0"] {
              margin-bottom: 2px !important;
            }

            /* Fix any potential text selection issues */
            .rct-tree-item-title-container {
              user-select: none !important;
            }

            /* Override any hover backgrounds on download button area */
            .rct-tree-item-title-container:hover {
              background: var(--bg-primary) !important;
            }

            /* Specifically prevent background changes on the download button container */
            [role="button"][aria-label="Download file"] {
              background: transparent !important;
            }

            [role="button"][aria-label="Download file"]:hover {
              background: transparent !important;
            }
          `}</style>
          <UncontrolledTreeEnvironment
            dataProvider={new StaticTreeDataProvider(treeData)}
            getItemTitle={(item) => {
              if (item.data?.type === 'media') {
                return item.data.title;
              } else if (item.data?.type === 'file') {
                return item.data.fileName;
              }
              return item.data || 'Unknown';
            }}
            viewState={{}}
            renderItemTitle={({ item }) => {
              if (item.data?.type === 'media') {
                return (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '6px 8px',
                    minHeight: '44px'
                  }}>
                    <i
                      className="fas fa-folder"
                      style={{
                        color: '#ffc107',
                        fontSize: '18px',
                        minWidth: '18px',
                        textAlign: 'center'
                      }}
                    ></i>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: '600',
                        color: 'var(--text-primary)',
                        fontSize: '14px',
                        lineHeight: '1.2',
                        marginBottom: '2px'
                      }}>
                        {item.data.title}
                      </div>
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        lineHeight: '1.2'
                      }}>
                        {item.data.subtitle}
                      </div>
                    </div>
                    {item.data.filesCount > 0 && (
                      <div style={{
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                        background: 'var(--bg-tertiary)',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        whiteSpace: 'nowrap',
                        fontWeight: '500'
                      }}>
                        {item.data.filesCount} file{item.data.filesCount !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                );
              } else if (item.data?.type === 'file') {
                return (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '4px 8px',
                    minHeight: '32px',
                    width: '100%',
                    justifyContent: 'space-between'
                  }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      flex: 1,
                      minWidth: 0,
                      maxWidth: 'calc(100% - 32px)' // Reserve space for download button
                    }}>
                      <i
                        className={`fas ${item.data.icon}`}
                        style={{
                          color: '#28a745',
                          fontSize: '16px',
                          minWidth: '16px',
                          textAlign: 'center'
                        }}
                      ></i>
                      <span style={{
                        color: 'var(--text-primary)',
                        fontSize: '13px',
                        fontWeight: '400',
                        lineHeight: '1.3',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {item.data.fileName}
                      </span>
                    </div>

                    {/* Download Button */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation(); // Prevent tree selection
                        handleDownloadFile(item.index as string, item.data.fileName);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDownloadFile(item.index as string, item.data.fileName);
                        }
                      }}
                      style={{
                        background: 'transparent !important',
                        cursor: 'pointer',
                        padding: '4px 6px',
                        borderRadius: '3px',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        width: '24px',
                        height: '24px',
                        position: 'relative',
                        zIndex: 10
                      }}
                      onMouseOver={(e) => {
                        const target = e.currentTarget;
                        const icon = target.querySelector('i');
                        if (icon) {
                          icon.style.transform = 'scale(1.3)';
                          icon.style.textShadow = document.documentElement.classList.contains('dark-mode')
                            ? '0 0 8px rgba(255, 255, 0, 0.6)'
                            : '0 0 8px rgba(0, 150, 255, 0.8)';
                        }
                      }}
                      onMouseOut={(e) => {
                        const target = e.currentTarget;
                        const icon = target.querySelector('i');
                        if (icon) {
                          icon.style.transform = 'scale(1)';
                          icon.style.textShadow = 'none';
                        }
                      }}
                      title="Download file"
                      aria-label="Download file"
                    >
                      <i className="fas fa-download" style={{
                        fontSize: '12px',
                        color: 'var(--text-secondary)',
                        transition: 'all 0.2s ease'
                      }} />
                    </div>
                  </div>
                );
              }
              return <span style={{ padding: '4px 8px' }}>{item.data}</span>;
            }}
            renderItemArrow={({ item, context }) => {
              if (!item.isFolder || !item.children || item.children.length === 0) {
                return <div style={{ width: '16px', minWidth: '16px' }}></div>;
              }
              return (
                <div style={{
                  width: '16px',
                  minWidth: '16px',
                  height: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '4px'
                }}>
                  <i
                    className={`fas fa-chevron-${context.isExpanded ? 'down' : 'right'}`}
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-secondary)',
                      transition: 'transform 0.2s ease'
                    }}
                  />
                </div>
              );
            }}
          >
            <Tree treeId="recent-media-tree" rootItem="root" treeLabel="Recent Media" />
          </UncontrolledTreeEnvironment>
        </div>
      )}

      {/* Info Section - Collapsible */}
      {showInfoPanel && (
        <div style={{
          background: 'var(--bg-tertiary)',
          padding: '15px',
          borderRadius: '6px',
          border: '1px solid var(--border-color)',
          position: 'relative'
        }}>
          {/* Close Button */}
          <button
            onClick={() => onConfigUpdate?.({ hideRecentMediaInfoPanel: true })}
            style={{
              position: 'absolute',
              top: '10px',
              right: '10px',
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '3px',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '24px',
              height: '24px',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg-primary)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
            title="Hide info panel"
          >
            <i className="fas fa-times"></i>
          </button>

          <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)', paddingRight: '30px' }}>
            <i className="fas fa-lightbulb" style={{ marginRight: '6px', color: '#ffc107' }}></i>
            About Recent Media
          </h4>
          <ul style={{ margin: '0', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
            <li>This shows your recent transcription and translation jobs</li>
            <li>Click on folders to expand and see generated files</li>
            <li>Data is cached for better performance</li>
            <li>New jobs automatically refresh this list</li>
          </ul>
        </div>
      )}
    </div>
  );
}

export default RecentMedia;