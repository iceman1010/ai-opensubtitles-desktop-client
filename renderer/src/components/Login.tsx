import React, { useState } from 'react';
import appConfig from '../config/appConfig.json';
import logoImage from '../assets/logo.png';

// CRITICAL: Authentication validates credentials via OpenSubtitles API before allowing app access
interface LoginProps {
  onLogin: (username: string, password: string, apiKey: string) => Promise<boolean>;
  setAppProcessing: (processing: boolean, task?: string) => void;
}

function Login({ onLogin, setAppProcessing }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !apiKey) {
      return;
    }

    setIsLoading(true);
    setError('');
    setAppProcessing(true, 'Logging in...');
    try {
      const success = await onLogin(username, password, apiKey);
      if (!success) {
        setError('Login failed. Please check your credentials.');
        setAppProcessing(true, 'Login failed');
        // Clear the failed status after 3 seconds
        setTimeout(() => setAppProcessing(false), 3000);
      }
      // Note: setAppProcessing(false) is handled in App.tsx handleLogin on success
    } catch (error) {
      setError('Login failed. Please check your credentials and try again.');
      setAppProcessing(true, 'Login failed');
      // Clear the failed status after 3 seconds
      setTimeout(() => setAppProcessing(false), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '5px auto 20px auto', textAlign: 'center' }}>
      {/* Logo at the top */}
      <div style={{ marginBottom: '10px' }}>
        <img 
          src={logoImage} 
          alt="AI.Opensubtitles.com Logo" 
          style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            objectFit: 'cover'
          }}
        />
      </div>
      
      <h1 style={{ marginBottom: '10px', fontSize: '16px' }}>Welcome to AI.Opensubtitles.com Client</h1>
      <p style={{ marginBottom: '20px', textAlign: 'left' }}>Please enter your OpenSubtitles.com credentials to continue.</p>
      
      {error && (
        <div className="status-message error">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
        <div className="form-group">
          <label htmlFor="username">Username:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={isLoading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="apiKey">
            API Key:
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              style={{
                marginLeft: '10px',
                padding: '4px 8px',
                backgroundColor: '#007BFF',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Need Help?
            </button>
          </label>
          <input
            type="text"
            id="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            required
            disabled={isLoading}
            placeholder="Your OpenSubtitles API Key"
          />
        </div>

        <button
          type="submit"
          className="button"
          disabled={isLoading || !username || !password || !apiKey}
        >
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>

      {showHelpModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            maxWidth: '800px',
            width: '90%',
            maxHeight: '90%',
            borderRadius: '10px',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{
              padding: '20px',
              borderBottom: '1px solid #ddd',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#f8f9fa',
              borderRadius: '10px 10px 0 0'
            }}>
              <h2 style={{ margin: 0, color: '#2c3e50' }}>🔑 How to Obtain Your OpenSubtitles API Key</h2>
              <button
                onClick={() => setShowHelpModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: '#666',
                  padding: '0',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{
              padding: '20px',
              overflowY: 'auto',
              flex: 1,
              textAlign: 'left'
            }}>
              <div style={{
                backgroundColor: '#d1ecf1',
                color: '#0c5460',
                padding: '15px',
                border: '1px solid #bee5eb',
                borderRadius: '5px',
                marginBottom: '20px'
              }}>
                <strong>ℹ️ What is an API Key?</strong><br/>
                An API Key is a unique identifier that authenticates your application when making requests to the OpenSubtitles service. It's required to use this desktop client.
              </div>

              <h3 style={{ color: '#3498db', marginTop: '20px', marginBottom: '15px' }}>📋 Step-by-Step Instructions</h3>
              
              <div style={{
                backgroundColor: '#ecf0f1',
                padding: '15px',
                margin: '15px 0',
                borderLeft: '5px solid #3498db',
                borderRadius: '5px'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <span style={{
                    backgroundColor: '#3498db',
                    color: 'white',
                    width: '25px',
                    height: '25px',
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '10px',
                    fontWeight: 'bold',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>1</span>
                  <div>
                    <strong>Create an OpenSubtitles Account</strong><br/>
                    Visit <a href="https://www.opensubtitles.com" target="_blank" style={{ color: '#3498db' }}>opensubtitles.com</a> and create a new account if you don't have one.
                  </div>
                </div>
              </div>

              <div style={{
                backgroundColor: '#ecf0f1',
                padding: '15px',
                margin: '15px 0',
                borderLeft: '5px solid #3498db',
                borderRadius: '5px'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <span style={{
                    backgroundColor: '#3498db',
                    color: 'white',
                    width: '25px',
                    height: '25px',
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '10px',
                    fontWeight: 'bold',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>2</span>
                  <div>
                    <strong>Sign In to Your Account</strong><br/>
                    Log in to your OpenSubtitles account using your username and password.
                  </div>
                </div>
              </div>

              <div style={{
                backgroundColor: '#ecf0f1',
                padding: '15px',
                margin: '15px 0',
                borderLeft: '5px solid #3498db',
                borderRadius: '5px'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <span style={{
                    backgroundColor: '#3498db',
                    color: 'white',
                    width: '25px',
                    height: '25px',
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '10px',
                    fontWeight: 'bold',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>3</span>
                  <div>
                    <strong>Navigate to API Consumers</strong><br/>
                    Click on your profile icon in the upper-right corner, then select <strong>"API consumers"</strong> from the dropdown menu.
                  </div>
                </div>
              </div>

              <div style={{
                backgroundColor: '#ecf0f1',
                padding: '15px',
                margin: '15px 0',
                borderLeft: '5px solid #3498db',
                borderRadius: '5px'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <span style={{
                    backgroundColor: '#3498db',
                    color: 'white',
                    width: '25px',
                    height: '25px',
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '10px',
                    fontWeight: 'bold',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>4</span>
                  <div>
                    <strong>Create New API Consumer</strong><br/>
                    Click the <strong>"NEW CONSUMER"</strong> button and fill in:
                    <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                      <li><strong>Name:</strong> AIOpenSubtitlesClient <em>(or any alphanumeric name)</em></li>
                      <li><strong>Description:</strong> Desktop application for subtitle processing</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div style={{
                backgroundColor: '#ecf0f1',
                padding: '15px',
                margin: '15px 0',
                borderLeft: '5px solid #3498db',
                borderRadius: '5px'
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <span style={{
                    backgroundColor: '#3498db',
                    color: 'white',
                    width: '25px',
                    height: '25px',
                    borderRadius: '50%',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginRight: '10px',
                    fontWeight: 'bold',
                    flexShrink: 0,
                    marginTop: '2px'
                  }}>5</span>
                  <div>
                    <strong>Copy Your API Key</strong><br/>
                    Once created, copy the generated API key and paste it into the field above.
                  </div>
                </div>
              </div>

              <div style={{
                backgroundColor: '#fff3cd',
                color: '#856404',
                padding: '15px',
                border: '1px solid #ffeaa7',
                borderRadius: '5px',
                margin: '20px 0'
              }}>
                <strong>🔐 Keep Your API Key Secure</strong><br/>
                Treat your API Key like a password - never share it publicly or store it in unsecured locations.
              </div>
            </div>

            <div style={{
              padding: '15px 20px',
              borderTop: '1px solid #ddd',
              backgroundColor: '#f8f9fa',
              borderRadius: '0 0 10px 10px',
              textAlign: 'center'
            }}>
              <button
                onClick={() => setShowHelpModal(false)}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#007BFF',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Got it, thanks!
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Login;