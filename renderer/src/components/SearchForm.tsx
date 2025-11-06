import React, { useState, useEffect } from 'react';
import { SubtitleSearchParams, SubtitleLanguage } from '../services/api';
import { useAPI } from '../contexts/APIContext';

interface SearchFormProps {
  onSearch: (params: SubtitleSearchParams) => void;
  isLoading: boolean;
}

interface SearchFormState {
  query: string;
  languages: string;
  imdb_id: string;
  year: string;
  type: string;
  ai_translated: boolean;
  hearing_impaired: boolean;
  trusted_sources: boolean;
  showAdvanced: boolean;
}


const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'movie', label: 'Movies' },
  { value: 'episode', label: 'TV Episodes' },
];

function SearchForm({ onSearch, isLoading }: SearchFormProps) {
  const { getSubtitleSearchLanguages } = useAPI();
  const [languageOptions, setLanguageOptions] = useState<SubtitleLanguage[]>([]);
  const [languagesLoading, setLanguagesLoading] = useState(true);
  const [languagesError, setLanguagesError] = useState<string | null>(null);

  const [formState, setFormState] = useState<SearchFormState>({
    query: '',
    languages: 'en',
    imdb_id: '',
    year: '',
    type: '',
    ai_translated: false,
    hearing_impaired: false,
    trusted_sources: false,
    showAdvanced: false,
  });

  useEffect(() => {
    const loadLanguages = async () => {
      try {
        setLanguagesLoading(true);
        setLanguagesError(null);
        const response = await getSubtitleSearchLanguages();

        if (response.success && response.data) {
          setLanguageOptions(response.data);
        } else {
          setLanguagesError(response.error || 'Failed to load languages');
        }
      } catch (error) {
        setLanguagesError('Failed to load languages');
      } finally {
        setLanguagesLoading(false);
      }
    };

    loadLanguages();
  }, [getSubtitleSearchLanguages]);

  const handleInputChange = (field: keyof SearchFormState, value: string | boolean) => {
    setFormState(prev => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formState.query.trim()) {
      return;
    }

    const searchParams: SubtitleSearchParams = {
      query: formState.query.trim(),
      languages: formState.languages,
    };

    // Add optional parameters only if they have values
    if (formState.imdb_id.trim()) {
      searchParams.imdb_id = formState.imdb_id.trim();
    }

    if (formState.year.trim()) {
      const yearNum = parseInt(formState.year.trim());
      if (!isNaN(yearNum)) {
        searchParams.year = yearNum;
      }
    }

    if (formState.type) {
      searchParams.type = formState.type;
    }

    // Add boolean filters
    if (formState.ai_translated) {
      searchParams.ai_translated = true;
    }

    if (formState.hearing_impaired) {
      searchParams.hearing_impaired = true;
    }

    if (formState.trusted_sources) {
      searchParams.trusted_sources = true;
    }

    onSearch(searchParams);
  };

  const toggleAdvanced = () => {
    setFormState(prev => ({
      ...prev,
      showAdvanced: !prev.showAdvanced,
    }));
  };

  return (
    <div className="search-form" style={{
      background: 'var(--bg-secondary)',
      padding: '20px',
      borderRadius: '8px',
      marginBottom: '20px',
      border: '1px solid var(--border-color)',
    }}>
      <form onSubmit={handleSubmit}>
        {/* Primary Search */}
        <div style={{ marginBottom: '15px' }}>
          <div className="search-form-container">
            <div className="search-input-row">
              <input
                type="text"
                placeholder="🔍 Search movies & TV shows..."
                value={formState.query}
                onChange={(e) => handleInputChange('query', e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  fontSize: '16px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                }}
                disabled={isLoading}
              />
            </div>

            <div className="search-controls-row">
              <select
                value={formState.languages}
                onChange={(e) => handleInputChange('languages', e.target.value)}
                style={{
                  padding: '12px',
                  fontSize: '14px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  minWidth: '120px',
                  flex: 1,
                }}
                disabled={isLoading || languagesLoading}
              >
                {languagesLoading ? (
                  <option value="en">Loading languages...</option>
                ) : languagesError ? (
                  <option value="en">Error loading languages</option>
                ) : (
                  languageOptions.map(lang => (
                    <option key={lang.language_code} value={lang.language_code}>
                      {lang.language_name}
                    </option>
                  ))
                )}
              </select>

              <select
                value={formState.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
                style={{
                  padding: '12px',
                  fontSize: '14px',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  background: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  minWidth: '120px',
                  flex: 1,
                }}
                disabled={isLoading}
              >
                {TYPE_OPTIONS.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>

              <button
                type="submit"
                disabled={isLoading || !formState.query.trim()}
                style={{
                  padding: '12px 24px',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  background: formState.query.trim() ? 'var(--primary-color)' : 'var(--bg-disabled)',
                  color: formState.query.trim() ? 'var(--button-text)' : 'var(--text-disabled)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  cursor: formState.query.trim() ? 'pointer' : 'not-allowed',
                  minWidth: '100px',
                  flexShrink: 0,
                }}
              >
                {isLoading ? '🔄 Searching...' : '🔍 Search'}
              </button>
            </div>
          </div>
        </div>

        {/* Advanced Options Toggle */}
        <div style={{ marginBottom: '10px' }}>
          <button
            type="button"
            onClick={toggleAdvanced}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary-color)',
              fontSize: '14px',
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
            disabled={isLoading}
          >
            {formState.showAdvanced ? '▼ Hide Advanced Options' : '▶ Show Advanced Options'}
          </button>
        </div>

        {/* Advanced Options */}
        {formState.showAdvanced && (
          <div style={{
            padding: '15px',
            background: 'var(--bg-primary)',
            borderRadius: '6px',
            border: '1px solid var(--border-color)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>

              {/* IMDb ID */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: 'var(--text-secondary)' }}>
                  IMDb ID (e.g., tt0133093)
                </label>
                <input
                  type="text"
                  placeholder="tt0133093"
                  value={formState.imdb_id}
                  onChange={(e) => handleInputChange('imdb_id', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '14px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                  disabled={isLoading}
                />
              </div>

              {/* Year */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '5px', color: 'var(--text-secondary)' }}>
                  Release Year
                </label>
                <input
                  type="number"
                  placeholder="2023"
                  min="1900"
                  max="2030"
                  value={formState.year}
                  onChange={(e) => handleInputChange('year', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '14px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '4px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                  }}
                  disabled={isLoading}
                />
              </div>
            </div>

            {/* Quality Filters */}
            <div style={{ marginTop: '15px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', marginBottom: '10px', color: 'var(--text-secondary)' }}>
                Quality Filters
              </label>
              <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>

                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    checked={formState.ai_translated}
                    onChange={(e) => handleInputChange('ai_translated', e.target.checked)}
                    style={{ marginRight: '8px' }}
                    disabled={isLoading}
                  />
                  🤖 AI Translated
                </label>

                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    checked={formState.hearing_impaired}
                    onChange={(e) => handleInputChange('hearing_impaired', e.target.checked)}
                    style={{ marginRight: '8px' }}
                    disabled={isLoading}
                  />
                  🦻 Hearing Impaired
                </label>

                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: '14px' }}>
                  <input
                    type="checkbox"
                    checked={formState.trusted_sources}
                    onChange={(e) => handleInputChange('trusted_sources', e.target.checked)}
                    style={{ marginRight: '8px' }}
                    disabled={isLoading}
                  />
                  ⭐ Trusted Sources Only
                </label>
              </div>
            </div>
          </div>
        )}
      </form>

      <style>{`
        .search-form-container {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .search-input-row {
          display: flex;
        }

        .search-controls-row {
          display: flex;
          gap: 10px;
          align-items: center;
        }

        @media (max-width: 759px) {
          .search-controls-row {
            flex-direction: column;
            gap: 8px;
            align-items: stretch;
          }
        }

        @media (min-width: 1000px) {
          .search-form-container {
            flex-direction: row;
            align-items: center;
          }

          .search-input-row {
            flex: 1;
            margin-right: 10px;
          }

          .search-controls-row {
            flex-shrink: 0;
          }
        }
      `}</style>
    </div>
  );
}

export default SearchForm;