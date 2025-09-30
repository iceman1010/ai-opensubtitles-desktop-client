import React, { useState, useEffect, useCallback, useRef } from 'react';
import { CreditPackage } from '../services/api';
import { useAPI } from '../contexts/APIContext';

interface AppConfig {
  username: string;
  password: string;
  apiKey?: string;
  lastUsedLanguage?: string;
  debugMode?: boolean;
  debugLevel?: number;
  autoLanguageDetection?: boolean;
  darkMode?: boolean;
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

function Credits({ config, setAppProcessing, isVisible = true }: CreditsProps) {
  const { credits, refreshCredits, getCreditPackages, isAuthenticated } = useAPI();
  
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);
  const [hasAttemptedLoad, setHasAttemptedLoad] = useState(false);
  const loadingRef = useRef(false);

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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 10px 0', color: 'var(--text-primary)' }}>Current Balance</h2>
            {isLoadingCredits ? (
              <p>Loading current credits...</p>
            ) : (
              <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '0', color: 'var(--text-primary)' }}>
                {credits ? `${credits.remaining} Credits` : 'Credits unavailable'}
              </p>
            )}
          </div>
          <button
            onClick={loadCurrentCredits}
            disabled={isLoadingCredits}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            {isLoadingCredits ? 'Refreshing...' : 'Refresh'}
          </button>
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