import React, { useState, useEffect } from 'react';
import { LanguageInfo, ServicesInfo, ServiceModel } from '../services/api';
import { useAPI } from '../contexts/APIContext';
import { logger } from '../utils/errorLogger';

interface AppConfig {
  username: string;
  password: string;
  apiKey?: string;
  lastUsedLanguage?: string;
  debugMode?: boolean;
  autoLanguageDetection?: boolean;
  credits?: {
    used: number;
    remaining: number;
  };
}

interface InfoProps {
  config: AppConfig;
  setAppProcessing: (processing: boolean, task?: string) => void;
}

function Info({ config, setAppProcessing }: InfoProps) {
  const { transcriptionInfo: contextTranscriptionInfo, translationInfo, getServicesInfo, isAuthenticated } = useAPI();
  
  const [servicesInfo, setServicesInfo] = useState<ServicesInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated) {
      loadModelInfo();
    }
  }, [isAuthenticated]);

  const loadModelInfo = async () => {
    setIsLoading(true);
    setAppProcessing(true, 'Loading model info...');

    try {
      // Load services info using centralized API
      const servicesResult = await getServicesInfo();

      if (servicesResult.success) {
        setServicesInfo(servicesResult.data || null);
      } else {
        logger.error('Info', 'Failed to load services info:', servicesResult.error);
      }

    } catch (error: any) {
      logger.error('Info', 'Failed to load model info:', error);
    } finally {
      setIsLoading(false);
      setAppProcessing(false);
    }
  };

  // Helper function to format price with proper units
  const formatPrice = (price: number | undefined, pricing: string) => {
    if (price === undefined || price === null) {
      return 'Price not available';
    }
    const unit = pricing.includes('character') ? 'per character' : 'per second';
    return `${price.toFixed(6)} credits ${unit}`;
  };

  // Helper function to get reliability color
  const getReliabilityColor = (reliability: string) => {
    switch (reliability.toLowerCase()) {
      case 'high': return '#28a745';
      case 'medium': return '#ffc107';
      case 'low': return '#dc3545';
      default: return '#6c757d';
    }
  };

  // Component for rendering collapsible language list
  const LanguageList: React.FC<{ languages: LanguageInfo[] | undefined; modelName: string }> = ({ languages, modelName }) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
    // Handle undefined languages
    if (!languages) {
      return <div style={{ fontSize: '14px', color: '#6c757d', fontStyle: 'italic' }}>Language information not available</div>;
    }
    
    const showCollapsible = languages.length > 20;
    const displayLanguages = showCollapsible && !isExpanded ? languages.slice(0, 20) : languages;

    return (
      <div style={{ marginTop: '12px' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: '#495057' }}>
          Languages Supported ({languages.length})
        </div>
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap', 
          gap: '6px',
          maxHeight: isExpanded ? 'none' : '120px',
          overflow: 'hidden'
        }}>
          {displayLanguages.map((lang, index) => (
            <span
              key={`${modelName}-${lang.language_code}-${index}`}
              style={{
                fontSize: '12px',
                padding: '4px 8px',
                backgroundColor: '#e9ecef',
                borderRadius: '12px',
                color: '#495057',
                border: '1px solid #dee2e6'
              }}
            >
              {lang.language_name}
            </span>
          ))}
        </div>
        {showCollapsible && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              marginTop: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              color: '#007bff',
              backgroundColor: 'transparent',
              border: '1px solid #007bff',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = '#007bff';
              e.currentTarget.style.color = 'white';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = '#007bff';
            }}
          >
            {isExpanded ? 'Show Less' : `Show All ${languages.length} Languages`}
          </button>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="info-container">
        <h1>AI Model Information & Pricing</h1>
        <p>Loading model information...</p>
      </div>
    );
  }


  return (
    <>
      <div className="info-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      <h1>AI Model Information & Pricing</h1>
      <p style={{ marginBottom: '30px', color: '#666' }}>
        Learn about the available AI models and their pricing structure. All prices are in credits.
      </p>

      {/* Transcription Models */}
      <section style={{ marginBottom: '40px', width: '100%' }}>
        <h2 style={{ marginBottom: '20px', color: '#333', borderBottom: '2px solid #3498db', paddingBottom: '8px' }}>
          Transcription Models
        </h2>
        {servicesInfo?.Transcription && servicesInfo.Transcription.length > 0 ? (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
            gridAutoRows: '1fr',
            gap: '16px', 
            width: '100%' 
          }}>
            {servicesInfo.Transcription.map((model) => (
              <div key={model.name} style={{
                padding: '20px',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                backgroundColor: '#fff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                display: 'grid',
                gridTemplateRows: 'auto auto 1fr auto',
                gridTemplateAreas: '"header" "description" "spacer" "footer"',
                height: '100%'
              }}>
                <div style={{ 
                  gridArea: 'header',
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center',
                  marginBottom: '12px',
                  minHeight: '72px',
                  justifyContent: 'center'
                }}>
                  <div style={{ 
                    fontSize: '18px',
                    fontWeight: 'bold', 
                    color: '#2c3e50',
                    textAlign: 'center',
                    marginBottom: '8px'
                  }}>
                    {model.display_name}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    backgroundColor: getReliabilityColor(model.reliability),
                    color: 'white',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    minWidth: '140px',
                    textAlign: 'center',
                    whiteSpace: 'nowrap'
                  }}>
                    {model.reliability} reliability
                  </div>
                </div>
                <div style={{ 
                  gridArea: 'description',
                  fontSize: '14px', 
                  color: '#666', 
                  marginBottom: '12px',
                  lineHeight: '1.5',
                  alignSelf: 'start'
                }}>
                  {model.description}
                </div>
                <div style={{ 
                  gridArea: 'footer',
                  alignSelf: 'end'
                }}>
                  <div style={{ 
                    fontSize: '16px', 
                    color: '#2196F3', 
                    fontWeight: 'bold',
                    padding: '8px 12px',
                    backgroundColor: '#e3f2fd',
                    borderRadius: '4px',
                    display: 'inline-block',
                    marginBottom: '12px'
                  }}>
                    {formatPrice(model.price, model.pricing)}
                  </div>
                  <LanguageList languages={model.languages_supported} modelName={model.name} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: '#666', fontStyle: 'italic', fontSize: '16px' }}>
            No transcription models available. Please check your API configuration.
          </p>
        )}
      </section>

      {/* Translation Models */}
      <section style={{ marginBottom: '40px', width: '100%' }}>
        <h2 style={{ marginBottom: '20px', color: '#333', borderBottom: '2px solid #e74c3c', paddingBottom: '8px' }}>
          Translation Models
        </h2>
        {servicesInfo?.Translation && servicesInfo.Translation.length > 0 ? (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
            gridAutoRows: '1fr',
            gap: '16px', 
            width: '100%' 
          }}>
            {servicesInfo.Translation.map((model) => (
              <div key={model.name} style={{
                padding: '20px',
                border: '1px solid #e0e0e0',
                borderRadius: '8px',
                backgroundColor: '#fff',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                display: 'grid',
                gridTemplateRows: 'auto auto 1fr auto',
                gridTemplateAreas: '"header" "description" "spacer" "footer"',
                height: '100%'
              }}>
                <div style={{ 
                  gridArea: 'header',
                  display: 'flex', 
                  flexDirection: 'column',
                  alignItems: 'center',
                  marginBottom: '12px',
                  minHeight: '72px',
                  justifyContent: 'center'
                }}>
                  <div style={{ 
                    fontSize: '18px',
                    fontWeight: 'bold', 
                    color: '#2c3e50',
                    textAlign: 'center',
                    marginBottom: '8px'
                  }}>
                    {model.display_name}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    padding: '4px 8px',
                    borderRadius: '12px',
                    backgroundColor: getReliabilityColor(model.reliability),
                    color: 'white',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    minWidth: '140px',
                    textAlign: 'center',
                    whiteSpace: 'nowrap'
                  }}>
                    {model.reliability} reliability
                  </div>
                </div>
                <div style={{ 
                  gridArea: 'description',
                  fontSize: '14px', 
                  color: '#666', 
                  marginBottom: '12px',
                  lineHeight: '1.5',
                  alignSelf: 'start'
                }}>
                  {model.description}
                </div>
                <div style={{ 
                  gridArea: 'footer',
                  alignSelf: 'end'
                }}>
                  <div style={{ 
                    fontSize: '16px', 
                    color: '#e74c3c', 
                    fontWeight: 'bold',
                    padding: '8px 12px',
                    backgroundColor: '#ffebee',
                    borderRadius: '4px',
                    display: 'inline-block',
                    marginBottom: '12px'
                  }}>
                    {formatPrice(model.price, model.pricing)}
                  </div>
                  <LanguageList languages={model.languages_supported} modelName={model.name} />
                </div>
              </div>
            ))}
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
    </>
  );
}

export default Info;