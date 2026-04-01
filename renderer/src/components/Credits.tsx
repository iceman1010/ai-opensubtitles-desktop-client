import { useState, useEffect, useCallback, useRef } from 'react';
import { CreditPackage, RecentActivityItem } from '../services/api';
import { useAPI } from '../contexts/APIContext';
import { usePower } from '../contexts/PowerContext';

interface AppConfig {
  username: string;
  password: string;
  apiKey?: string;
  lastUsedLanguage?: string;
  debugMode?: boolean;
  debugLevel?: number;
  autoLanguageDetection?: boolean;
  darkMode?: boolean;
  userId?: number;
  credits?: {
    used: number;
    remaining: number;
  };
}

interface CreditsProps {
  config: AppConfig;
  setAppProcessing: (processing: boolean, task?: string) => void;
  isVisible?: boolean;
}

const ACTIVITIES_PAGE_SIZE = 20;

function Credits({ config, setAppProcessing, isVisible = true }: CreditsProps) {
  const { credits, refreshCredits, getCreditPackages, getRecentActivities, isAuthenticated } = useAPI();
  const { lastResumeTime } = usePower();

  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const loadingRef = useRef(false);

  // Activity history state
  const [activities, setActivities] = useState<RecentActivityItem[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [isLoadingMoreActivities, setIsLoadingMoreActivities] = useState(false);
  const [activitiesPage, setActivitiesPage] = useState(1);
  const [hasMoreActivities, setHasMoreActivities] = useState(true);
  const [hasLoadedActivities, setHasLoadedActivities] = useState(false);
  const activitiesLoadingRef = useRef(false);

  const loadCreditPackages = useCallback(async () => {
    // Prevent multiple simultaneous calls using ref
    if (loadingRef.current) {
      return;
    }

    loadingRef.current = true;
    setIsLoading(true);
    setError(null);
    setAppProcessing(true, 'Loading credit packages...');

    try {
      console.log('Credits: Starting getCreditPackages call, authenticated:', isAuthenticated);
      const result = await getCreditPackages(config.username);

      if (result.success && result.data) {
        setCreditPackages(result.data);
        console.log('Credits: Successfully loaded', result.data.length, 'credit packages');
      } else {
        console.log('Credits: getCreditPackages failed:', result.error);
        throw new Error(result.error || 'Failed to load credit packages');
      }
    } catch (error: any) {
      console.error('Error loading credit packages:', error);
      setError(error.message || 'Failed to load credit packages');
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
      setAppProcessing(false);
      setHasAttemptedLoad(true);
    }
  }, [getCreditPackages, config.username, setAppProcessing]);

  useEffect(() => {
    if (isAuthenticated && isVisible && creditPackages.length === 0 && !hasAttemptedLoad) {
      loadCreditPackages();
    }
  }, [isAuthenticated, isVisible, loadCreditPackages, creditPackages.length, hasAttemptedLoad]);

  // Auto-retry after hibernation recovery if credits screen failed to load
  useEffect(() => {
    if (lastResumeTime && isVisible && error && !isLoading && hasAttemptedLoad) {
      const timeSinceResume = Date.now() - lastResumeTime;
      const HIBERNATION_RETRY_WINDOW_MS = 10000; // 10 seconds

      if (timeSinceResume < HIBERNATION_RETRY_WINDOW_MS) {
        console.log('Credits: Auto-retrying after hibernation recovery');
        // Wait a moment for network/authentication to stabilize after hibernation
        const retryDelay = Math.max(0, 3000 - timeSinceResume); // Wait at least 3 seconds after resume
        setTimeout(() => {
          if (isVisible && error && !isLoading) { // Double-check conditions haven't changed
            setHasAttemptedLoad(false);
            setError(null);
            loadCreditPackages();
          }
        }, retryDelay);
      }
    }
  }, [lastResumeTime, isVisible, error, isLoading, hasAttemptedLoad, loadCreditPackages]);

  // Activity history loading
  const loadActivities = useCallback(async (page: number = 1, append: boolean = false) => {
    if (activitiesLoadingRef.current) return;
    if (!isAuthenticated) return;

    activitiesLoadingRef.current = true;
    if (append) {
      setIsLoadingMoreActivities(true);
    } else {
      setIsLoadingActivities(true);
    }

    try {
      const result = await getRecentActivities(page);
      if (result.success && result.data) {
        if (append) {
          setActivities(prev => [...prev, ...result.data!]);
        } else {
          setActivities(result.data);
        }
        setActivitiesPage(page);
        setHasMoreActivities(result.data.length >= ACTIVITIES_PAGE_SIZE);
        setHasLoadedActivities(true);
      }
    } catch (error: any) {
      console.error('Error loading activities:', error);
    } finally {
      activitiesLoadingRef.current = false;
      setIsLoadingActivities(false);
      setIsLoadingMoreActivities(false);
    }
  }, [getRecentActivities, isAuthenticated]);

  // Auto-load activities when screen becomes visible
  useEffect(() => {
    if (isAuthenticated && isVisible && !hasLoadedActivities) {
      loadActivities();
    }
  }, [isAuthenticated, isVisible, hasLoadedActivities, loadActivities]);

  const handleLoadMoreActivities = () => {
    loadActivities(activitiesPage + 1, true);
  };

  const formatActivityDate = (timeStr: string) => {
    try {
      const date = new Date(timeStr.replace(' GMT', 'Z'));
      return date.toLocaleString();
    } catch {
      return timeStr;
    }
  };

  const getActivityTypeIcon = (typeName: string) => {
    switch (typeName?.toLowerCase()) {
      case 'transcription': return 'fa-microphone';
      case 'translation': return 'fa-language';
      case 'voiceover': return 'fa-volume-up';
      case 'download': return 'fa-download';
      default: return 'fa-circle';
    }
  };

  const getActivityTypeColor = (typeName: string) => {
    switch (typeName?.toLowerCase()) {
      case 'transcription': return '#007bff';
      case 'translation': return '#28a745';
      case 'voiceover': return '#6f42c1';
      case 'download': return '#fd7e14';
      default: return 'var(--text-secondary)';
    }
  };

  const loadCurrentCredits = async () => {
    if (refreshCredits) {
      setIsLoadingCredits(true);
      try {
        await refreshCredits();
      } catch (error) {
        console.error('Error refreshing credits:', error);
      } finally {
        setIsLoadingCredits(false);
      }
    }
  };

  const handlePurchase = (checkoutUrl: string) => {
    // Open the checkout URL in the system's default browser
    window.electronAPI?.openExternal?.(checkoutUrl) || window.open(checkoutUrl, '_blank');
  };

  return (
    <div className="credits-screen" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      <h1>Credits Management</h1>
      
      {/* Current Credits Section */}
      <div style={{
        background: 'var(--bg-tertiary)',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '30px',
        border: '1px solid var(--border-color)'
      }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
            <h2 style={{ margin: 0, color: 'var(--text-primary)' }}>Current Balance</h2>
            {config.username && (
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                <i className="fas fa-user" style={{ marginRight: '6px' }}></i>
                <span style={{ fontWeight: 500 }}>{config.username}</span>
                {config.userId && (
                  <span style={{ marginLeft: '10px', opacity: 0.7 }}>ID: {config.userId}</span>
                )}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isLoadingCredits ? (
              <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Loading...</p>
            ) : (
              <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '0', color: 'var(--text-primary)' }}>
                {credits ? `${credits.remaining} Credits` : 'Credits unavailable'}
              </p>
            )}
            <button
              onClick={loadCurrentCredits}
              disabled={isLoadingCredits}
              title="Refresh credits"
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: isLoadingCredits ? 'not-allowed' : 'pointer',
                padding: '4px',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                transition: 'color 0.2s ease'
              }}
              onMouseEnter={(e) => {
                if (!isLoadingCredits) {
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              <i className={`fas fa-sync-alt${isLoadingCredits ? ' fa-spin' : ''}`}></i>
            </button>
          </div>
        </div>
      </div>

      {/* Purchase Credits Section */}
      <div>
        <h2>Purchase Credits</h2>
        
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
            {error}
          </div>
        )}

        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <p>Loading available credit packages...</p>
          </div>
        ) : creditPackages.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '20px',
            marginTop: '20px'
          }}>
            {creditPackages.map((pkg, index) => (
              <div
                key={index}
                style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '20px',
                  background: 'var(--bg-secondary)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                  transition: 'transform 0.2s ease, box-shadow 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <h3 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)' }}>
                    {pkg.name}
                  </h3>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', margin: '10px 0' }}>
                    {pkg.value}
                  </div>
                  {pkg.discount_percent > 0 ? (
                    <div style={{
                      background: 'var(--success-color)',
                      color: 'var(--bg-primary)',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      margin: '10px 0',
                      display: 'inline-block'
                    }}>
                      {pkg.discount_percent}% OFF
                    </div>
                  ) : (
                    <div style={{ margin: '10px 0', height: '28px' }}></div>
                  )}
                  <button
                    onClick={() => handlePurchase(pkg.checkout_url)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      backgroundColor: '#007bff',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '16px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      marginTop: '15px',
                      transition: 'background-color 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#0056b3';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = '#007bff';
                    }}
                  >
                    Purchase Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : !isLoading && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            <p>No credit packages available at the moment.</p>
            <button
              onClick={() => {
                setHasAttemptedLoad(false);
                setError(null); // Clear previous error for fresh retry
                loadCreditPackages();
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Credit Activity Section */}
      <div style={{ marginTop: '30px' }}>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: '15px' }}>
          <i className="fas fa-history" style={{ marginRight: '8px', color: 'var(--text-secondary)' }}></i>
          Credit Activity
        </h2>

        {isLoadingActivities && activities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
            <i className="fas fa-spinner fa-spin" style={{ fontSize: '20px', marginBottom: '10px', display: 'block' }}></i>
            <p style={{ margin: 0 }}>Loading activity history...</p>
          </div>
        ) : activities.length === 0 && hasLoadedActivities ? (
          <div style={{
            textAlign: 'center',
            padding: '30px',
            color: 'var(--text-secondary)',
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)'
          }}>
            <i className="fas fa-receipt" style={{ fontSize: '32px', marginBottom: '10px', display: 'block' }}></i>
            <p style={{ margin: 0 }}>No activity recorded yet</p>
          </div>
        ) : activities.length > 0 && (
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            overflow: 'hidden'
          }}>
            {/* Table Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 100px',
              padding: '12px 16px',
              background: 'var(--bg-tertiary)',
              borderBottom: '1px solid var(--border-color)',
              fontSize: '12px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}>
              <div>Date</div>
              <div>Type</div>
              <div style={{ textAlign: 'right' }}>Credits</div>
            </div>

            {/* Table Rows */}
            {activities.map((activity, index) => (
              <div
                key={activity.id || index}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 100px',
                  padding: '10px 16px',
                  borderBottom: index < activities.length - 1 ? '1px solid var(--border-color)' : 'none',
                  fontSize: '13px',
                  alignItems: 'center',
                  transition: 'background-color 0.15s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ color: 'var(--text-secondary)' }}>
                  {formatActivityDate(activity.time_str)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i
                    className={`fas ${getActivityTypeIcon(activity.type_name)}`}
                    style={{
                      color: getActivityTypeColor(activity.type_name),
                      fontSize: '12px',
                      width: '16px',
                      textAlign: 'center'
                    }}
                  ></i>
                  <span style={{
                    color: 'var(--text-primary)',
                    textTransform: 'capitalize'
                  }}>
                    {activity.type_name}
                  </span>
                </div>
                <div style={{
                  textAlign: 'right',
                  fontWeight: '600',
                  fontVariantNumeric: 'tabular-nums',
                  color: '#dc3545'
                }}>
                  -{activity.credits}
                </div>
              </div>
            ))}

            {/* Load More Button */}
            {hasMoreActivities && (
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                padding: '12px',
                borderTop: '1px solid var(--border-color)'
              }}>
                <button
                  onClick={handleLoadMoreActivities}
                  disabled={isLoadingMoreActivities}
                  style={{
                    padding: '8px 20px',
                    backgroundColor: isLoadingMoreActivities ? 'var(--bg-tertiary)' : 'var(--bg-primary)',
                    color: isLoadingMoreActivities ? 'var(--text-secondary)' : 'var(--primary-color)',
                    border: `1px solid ${isLoadingMoreActivities ? 'var(--border-color)' : 'var(--primary-color)'}`,
                    borderRadius: '6px',
                    cursor: isLoadingMoreActivities ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoadingMoreActivities) {
                      e.currentTarget.style.backgroundColor = 'var(--primary-color)';
                      e.currentTarget.style.color = 'white';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isLoadingMoreActivities) {
                      e.currentTarget.style.backgroundColor = 'var(--bg-primary)';
                      e.currentTarget.style.color = 'var(--primary-color)';
                    }
                  }}
                >
                  {isLoadingMoreActivities ? (
                    <>
                      <span style={{
                        display: 'inline-block',
                        width: '14px',
                        height: '14px',
                        border: '2px solid var(--text-secondary)',
                        borderTop: '2px solid transparent',
                        borderRadius: '50%',
                        animation: 'spin 1s linear infinite'
                      }}></span>
                      Loading...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-chevron-down"></i>
                      Load More
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div style={{
        background: 'var(--bg-tertiary)',
        padding: '15px',
        borderRadius: '6px',
        marginTop: '30px',
        border: '1px solid var(--border-color)'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)' }}><i className="fas fa-lightbulb" style={{marginRight: '6px', color: '#ffc107'}}></i>How it works:</h4>
        <ul style={{ margin: '0', paddingLeft: '20px', color: 'var(--text-secondary)' }}>
          <li>Click "Purchase Now" to open the secure checkout page in your browser</li>
          <li>Complete your purchase on the OpenSubtitles website</li>
          <li>Credits will be added to your account automatically</li>
          <li>Click "Refresh" to update your current balance</li>
        </ul>
      </div>
    </div>
  );
}

export default Credits;