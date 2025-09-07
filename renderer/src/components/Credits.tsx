import React, { useState, useEffect } from 'react';
import { OpenSubtitlesAPI, CreditPackage } from '../services/api';

interface AppConfig {
  username: string;
  password: string;
  apiKey?: string;
  lastUsedLanguage?: string;
  debugMode?: boolean;
  credits?: {
    used: number;
    remaining: number;
  };
}

interface CreditsProps {
  config: AppConfig;
  setAppProcessing: (processing: boolean, task?: string) => void;
}

function Credits({ config, setAppProcessing }: CreditsProps) {
  const [creditPackages, setCreditPackages] = useState<CreditPackage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentCredits, setCurrentCredits] = useState<number | null>(null);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);
  const [api] = useState(() => {
    const apiInstance = new OpenSubtitlesAPI();
    if (config.apiKey) {
      apiInstance.setApiKey(config.apiKey);
    }
    return apiInstance;
  });

  useEffect(() => {
    if (config.apiKey) {
      loadCurrentCredits();
      loadCreditPackages();
    }
  }, [config]);

  const loadCurrentCredits = async () => {
    setIsLoadingCredits(true);
    try {
      await api.loadCachedToken();
      const result = await api.getCredits();
      if (result.success && typeof result.credits === 'number') {
        setCurrentCredits(result.credits);
      } else {
        console.error('Failed to load current credits:', result.error);
      }
    } catch (error) {
      console.error('Error loading current credits:', error);
    } finally {
      setIsLoadingCredits(false);
    }
  };

  const loadCreditPackages = async () => {
    setIsLoading(true);
    setError(null);
    setAppProcessing(true, 'Loading credit packages...');

    try {
      await api.loadCachedToken();
      const result = await api.getCreditPackages(config.username);
      
      if (result.success && result.data) {
        setCreditPackages(result.data);
      } else {
        throw new Error(result.error || 'Failed to load credit packages');
      }
    } catch (error: any) {
      console.error('Error loading credit packages:', error);
      setError(error.message || 'Failed to load credit packages');
    } finally {
      setIsLoading(false);
      setAppProcessing(false);
    }
  };

  const handlePurchase = (checkoutUrl: string) => {
    // Open the checkout URL in the system's default browser
    window.electronAPI?.openExternal?.(checkoutUrl) || window.open(checkoutUrl, '_blank');
  };

  const refreshCredits = () => {
    loadCurrentCredits();
  };

  return (
    <div className="credits-screen" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '20px', gap: '20px' }}>
      <h1>Credits Management</h1>
      
      {/* Current Credits Section */}
      <div style={{
        background: '#f8f9fa',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '30px',
        border: '1px solid #e9ecef'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: '0 0 10px 0', color: '#495057' }}>Current Balance</h2>
            {isLoadingCredits ? (
              <p>Loading current credits...</p>
            ) : (
              <p style={{ fontSize: '24px', fontWeight: 'bold', margin: '0', color: '#007bff' }}>
                {currentCredits !== null ? `${currentCredits} Credits` : 'Credits unavailable'}
              </p>
            )}
          </div>
          <button
            onClick={refreshCredits}
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
            background: '#f8d7da',
            color: '#721c24',
            padding: '12px',
            borderRadius: '4px',
            marginBottom: '20px',
            border: '1px solid #f1aeb5'
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
                  border: '1px solid #dee2e6',
                  borderRadius: '8px',
                  padding: '20px',
                  background: '#ffffff',
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
                  <h3 style={{ margin: '0 0 10px 0', color: '#495057' }}>
                    {pkg.name}
                  </h3>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#007bff', margin: '10px 0' }}>
                    {pkg.value}
                  </div>
                  {pkg.discount_percent > 0 ? (
                    <div style={{
                      background: '#d4edda',
                      color: '#155724',
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
          <div style={{ textAlign: 'center', padding: '40px', color: '#6c757d' }}>
            <p>No credit packages available at the moment.</p>
            <button
              onClick={loadCreditPackages}
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
        background: '#e7f3ff',
        padding: '15px',
        borderRadius: '6px',
        marginTop: '30px',
        border: '1px solid #b3d7ff'
      }}>
        <h4 style={{ margin: '0 0 10px 0', color: '#0c5460' }}>💡 How it works:</h4>
        <ul style={{ margin: '0', paddingLeft: '20px', color: '#0c5460' }}>
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