import React, { useState } from 'react';
import appConfig from '../config/appConfig.json';

interface LoginProps {
  onLogin: (username: string, password: string, apiKey: string) => Promise<boolean>;
}

function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !apiKey) {
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      const success = await onLogin(username, password, apiKey);
      if (!success) {
        setError('Login failed. Please check your credentials.');
      }
    } catch (error) {
      setError('Login failed. Please check your credentials and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '400px', margin: '50px auto' }}>
      <h1>Welcome to {appConfig.name}</h1>
      <p>Please enter your OpenSubtitles credentials to continue.</p>
      
      {error && (
        <div className="status-message error">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit}>
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
            type="password"
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
    </div>
  );
}

export default Login;