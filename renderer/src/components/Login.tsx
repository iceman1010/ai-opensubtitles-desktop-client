import React, { useState } from 'react';
import appConfig from '../config/appConfig.json';
import logoImage from '../assets/logo.png';

// CRITICAL: Authentication validates credentials via OpenSubtitles API before allowing app access
interface LoginProps {
  onLogin: (username: string, password: string, apiKey: string) => Promise<boolean>;
  setAppProcessing: (processing: boolean, task?: string) => void;
  isPreviewMode?: boolean;
  onCancelPreview?: () => void;
}

function Login({ onLogin, setAppProcessing, isPreviewMode, onCancelPreview }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey] = useState('YzhaGkIg6dMSJ47QoihkhikfRmvbJTn7');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
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
        setTimeout(() => setAppProcessing(false), 3000);
      }
    } catch (error) {
      setError('Login failed. Please check your credentials and try again.');
      setAppProcessing(true, 'Login failed');
      setTimeout(() => setAppProcessing(false), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '5px auto 20px auto', textAlign: 'center' }}>
      {isPreviewMode && (
        <div style={{ marginBottom: '10px' }}>
          <button
            type="button"
            onClick={onCancelPreview}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            <i className="fas fa-arrow-left" style={{ marginRight: '6px' }}></i>
            Back to App
          </button>
        </div>
      )}
      
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
          <label htmlFor="apiKey">API Key:</label>
          <input
            type="text"
            id="apiKey"
            value={apiKey}
            disabled={true}
            style={{
              backgroundColor: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              cursor: 'not-allowed'
            }}
          />
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
            <i className="fas fa-lock" style={{ marginRight: '4px' }}></i>
            Pre-configured API key
          </div>
        </div>

        <button
          type="submit"
          className="button"
          disabled={isLoading || !username || !password}
        >
          {isLoading ? 'Logging in...' : 'Login'}
        </button>
      </form>
    </div>
  );
}

export default Login;