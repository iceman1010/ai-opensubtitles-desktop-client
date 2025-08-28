import React, { useState, useEffect } from 'react';
import { OpenSubtitlesAPI, LanguageInfo, TranscriptionInfo, TranslationInfo } from '../services/api';
import { logger } from '../utils/errorLogger';

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

interface InfoProps {
  config: AppConfig;
}

function Info({ config }: InfoProps) {
  const [transcriptionInfo, setTranscriptionInfo] = useState<TranscriptionInfo | null>(null);
  const [translationInfo, setTranslationInfo] = useState<TranslationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [api] = useState(() => new OpenSubtitlesAPI());

  useEffect(() => {
    loadModelInfo();
  }, [config]);

  const loadModelInfo = async () => {
    if (!config.apiKey) return;
    
    setIsLoading(true);
    api.setApiKey(config.apiKey);

    try {
      // Try to load cached token first
      const hasToken = await api.loadCachedToken();
      
      if (!hasToken) {
        // Login with credentials to get fresh token
        const loginResult = await api.login(config.username, config.password);
        if (!loginResult.success) {
          throw new Error(loginResult.error || 'Login failed');
        }
      }

      // Load both transcription and translation info
      const [transcriptionResult, translationResult] = await Promise.all([
        api.getTranscriptionInfo(),
        api.getTranslationInfo()
      ]);

      if (transcriptionResult.success) {
        setTranscriptionInfo(transcriptionResult.data || null);
      } else {
        logger.error('Info', 'Failed to load transcription info:', transcriptionResult.error);
      }

      if (translationResult.success) {
        setTranslationInfo(translationResult.data || null);
      } else {
        logger.error('Info', 'Failed to load translation info:', translationResult.error);
      }

    } catch (error: any) {
      logger.error('Info', 'Failed to load model info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Mock pricing data - you'll provide actual data later
  const modelPricing = {
    transcription: {
      'whisper-1': { price: 0.006, unit: 'per minute', description: 'OpenAI Whisper v1 - Fast and accurate speech recognition for most audio files' },
      'whisper-large': { price: 0.012, unit: 'per minute', description: 'OpenAI Whisper Large - Higher accuracy for complex audio, accents, and noisy environments' },
      'speech-to-text': { price: 0.004, unit: 'per minute', description: 'Basic speech recognition - Good for clear audio and simple transcription tasks' }
    },
    translation: {
      'deepl': { price: 0.02, unit: 'per 500 chars', description: 'DeepL - Premium neural machine translation with superior quality and nuance' },
      'google': { price: 0.015, unit: 'per 500 chars', description: 'Google Translate - Fast and reliable translation supporting 100+ languages' },
      'azure': { price: 0.018, unit: 'per 500 chars', description: 'Microsoft Azure Translator - Enterprise-grade translation with custom models' }
    }
  };

  const transcriptionApis = Array.isArray(transcriptionInfo?.apis) ? transcriptionInfo.apis : [];
  const translationApis = Array.isArray(translationInfo?.apis) ? translationInfo.apis : [];

  if (isLoading) {
    return (
      <div className="info-screen" style={{ padding: '20px' }}>
        <h1>AI Model Information & Pricing</h1>
        <p>Loading model information...</p>
      </div>
    );
  }

  return (
    <div className="info-screen" style={{ padding: '20px', maxWidth: '800px' }}>
      <h1>AI Model Information & Pricing</h1>
      <p style={{ marginBottom: '30px', color: '#666' }}>
        Learn about the available AI models and their pricing structure. All prices are in credits.
      </p>

      {/* Transcription Models */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ marginBottom: '20px', color: '#333', borderBottom: '2px solid #3498db', paddingBottom: '8px' }}>
          Transcription Models
        </h2>
        {transcriptionApis.length > 0 ? (
          <div style={{ display: 'grid', gap: '16px' }}>
            {transcriptionApis.map(api => {
              const pricing = modelPricing.transcription[api] || { 
                price: '?', 
                unit: 'per minute', 
                description: 'Pricing information will be available soon' 
              };
              return (
                <div key={api} style={{
                  padding: '20px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  backgroundColor: '#fff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ 
                    fontSize: '18px',
                    fontWeight: 'bold', 
                    marginBottom: '8px',
                    color: '#2c3e50'
                  }}>
                    {api.toUpperCase()}
                  </div>
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#666', 
                    marginBottom: '12px',
                    lineHeight: '1.5'
                  }}>
                    {pricing.description}
                  </div>
                  <div style={{ 
                    fontSize: '16px', 
                    color: '#2196F3', 
                    fontWeight: 'bold',
                    padding: '8px 12px',
                    backgroundColor: '#e3f2fd',
                    borderRadius: '4px',
                    display: 'inline-block'
                  }}>
                    {pricing.price} credits {pricing.unit}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: '#666', fontStyle: 'italic', fontSize: '16px' }}>
            No transcription models available. Please check your API configuration.
          </p>
        )}
      </section>

      {/* Translation Models */}
      <section style={{ marginBottom: '40px' }}>
        <h2 style={{ marginBottom: '20px', color: '#333', borderBottom: '2px solid #e74c3c', paddingBottom: '8px' }}>
          Translation Models
        </h2>
        {translationApis.length > 0 ? (
          <div style={{ display: 'grid', gap: '16px' }}>
            {translationApis.map(api => {
              const pricing = modelPricing.translation[api] || { 
                price: '?', 
                unit: 'per 500 chars', 
                description: 'Pricing information will be available soon' 
              };
              return (
                <div key={api} style={{
                  padding: '20px',
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px',
                  backgroundColor: '#fff',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                }}>
                  <div style={{ 
                    fontSize: '18px',
                    fontWeight: 'bold', 
                    marginBottom: '8px',
                    color: '#2c3e50'
                  }}>
                    {api.toUpperCase()}
                  </div>
                  <div style={{ 
                    fontSize: '14px', 
                    color: '#666', 
                    marginBottom: '12px',
                    lineHeight: '1.5'
                  }}>
                    {pricing.description}
                  </div>
                  <div style={{ 
                    fontSize: '16px', 
                    color: '#e74c3c', 
                    fontWeight: 'bold',
                    padding: '8px 12px',
                    backgroundColor: '#ffebee',
                    borderRadius: '4px',
                    display: 'inline-block'
                  }}>
                    {pricing.price} credits {pricing.unit}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p style={{ color: '#666', fontStyle: 'italic', fontSize: '16px' }}>
            No translation models available. Please check your API configuration.
          </p>
        )}
      </section>

      {/* Pricing Notes */}
      <section style={{
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderLeft: '4px solid #17a2b8',
        borderRadius: '4px',
        marginTop: '30px'
      }}>
        <h3 style={{ marginBottom: '12px', color: '#17a2b8' }}>Pricing Information</h3>
        <ul style={{ marginLeft: '20px', lineHeight: '1.6', color: '#495057' }}>
          <li>All prices are quoted in credits, which are deducted from your account upon successful processing</li>
          <li>Transcription costs are calculated based on audio duration (per minute)</li>
          <li>Translation costs are calculated based on character count (per 500 characters)</li>
          <li>Failed or cancelled operations do not consume credits</li>
          <li>Prices may vary based on language complexity and audio quality</li>
          <li>Pricing is subject to change - check this page for the latest information</li>
        </ul>
      </section>

      {/* Usage Tips */}
      <section style={{
        padding: '20px',
        backgroundColor: '#d4edda',
        borderLeft: '4px solid #28a745',
        borderRadius: '4px',
        marginTop: '20px'
      }}>
        <h3 style={{ marginBottom: '12px', color: '#155724' }}>💡 Cost Optimization Tips</h3>
        <ul style={{ marginLeft: '20px', lineHeight: '1.6', color: '#155724' }}>
          <li>Use audio preprocessing to improve quality and reduce processing time</li>
          <li>Choose the appropriate model - basic models work well for clear audio</li>
          <li>For translations, shorter text segments are often more cost-effective</li>
          <li>Consider batch processing multiple files to optimize credit usage</li>
        </ul>
      </section>
    </div>
  );
}

export default Info;