import React, { useState, useEffect } from 'react';
import { LanguageInfo, ServiceModel, ServicesInfo } from '../services/api';
import { useAPI } from '../contexts/APIContext';
import { logger } from '../utils/errorLogger';

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

interface InfoProps {
  config: AppConfig;
  setAppProcessing: (processing: boolean, task?: string) => void;
}

// --- Layout / sort types ---
type ViewMode = 'cards' | 'table' | 'list';
type SortKey = 'price' | 'name' | 'reliability';
type SortDir = 'asc' | 'desc';
type SectionKey = 'transcription' | 'translation';
interface SortState {
  key: SortKey;
  dir: SortDir;
}

const VIEW_KEY = 'ai-os-info-view-mode';
const MOBILE_QUERY = '(max-width: 640px)';

function loadViewMode(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === 'cards' || v === 'table' || v === 'list') return v;
  } catch {
    // localStorage unavailable (private mode / restricted) - fall back to default
  }
  return 'cards';
}

function defaultDirFor(key: SortKey): SortDir {
  // most reliable first makes more sense ascending-descending-wise as "best first"
  return key === 'reliability' ? 'desc' : 'asc';
}

function parseReliability(reliability: string): number {
  switch (reliability.toLowerCase()) {
    case 'high': return 90;
    case 'medium': return 70;
    case 'low': return 50;
    default: return 0;
  }
}

function getSorted(models: ServiceModel[], s: SortState): ServiceModel[] {
  const mult = s.dir === 'asc' ? 1 : -1;
  return [...models].sort((a, b) => {
    let cmp = 0;
    if (s.key === 'price') {
      const ap = a.price ?? Infinity;
      const bp = b.price ?? Infinity;
      cmp = ap - bp;
    } else if (s.key === 'name') {
      cmp = a.display_name.localeCompare(b.display_name);
    } else {
      cmp = parseReliability(a.reliability) - parseReliability(b.reliability);
    }
    return cmp * mult;
  });
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener('change', handler);
    setMatches(mql.matches);
    return () => mql.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

function Info({ config: _config, setAppProcessing }: InfoProps) {
  const { transcriptionInfo: _contextTranscriptionInfo, translationInfo: _translationInfo, getServicesInfo, isAuthenticated, modelInfoVersion } = useAPI();

  const [servicesInfo, setServicesInfo] = useState<ServicesInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [viewMode, setViewMode] = useState<ViewMode>(() => loadViewMode());
  const [sort, setSort] = useState<Record<SectionKey, SortState>>({
    transcription: { key: 'price', dir: 'asc' },
    translation: { key: 'price', dir: 'asc' },
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const isMobile = useMediaQuery(MOBILE_QUERY);
  // Table is awkward on narrow windows: fall back to the list layout. Preference is unchanged.
  const effectiveView: ViewMode = viewMode === 'table' && isMobile ? 'list' : viewMode;

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, viewMode);
    } catch {
      // ignore write failures
    }
  }, [viewMode]);

  useEffect(() => {
    if (isAuthenticated) {
      loadModelInfo();
    }
  }, [isAuthenticated, modelInfoVersion]);

  const loadModelInfo = async () => {
    // Clear existing data to force re-render
    setServicesInfo(null);
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
      case 'high': return 'var(--success-color)';
      case 'medium': return 'var(--warning-color)';
      case 'low': return 'var(--danger-color)';
      default: return '#6c757d';
    }
  };

  const cycleSort = (section: SectionKey, key: SortKey) => {
    setSort((prev) => {
      const cur = prev[section];
      const dir: SortDir = cur.key === key ? (cur.dir === 'asc' ? 'desc' : 'asc') : defaultDirFor(key);
      return { ...prev, [section]: { key, dir } };
    });
  };

  const rowKeyFor = (section: SectionKey, modelName: string) => `${section}:${modelName}`;
  const toggleRow = (section: SectionKey, modelName: string) => {
    const k = rowKeyFor(section, modelName);
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(k)) {
        next.delete(k);
      } else {
        next.add(k);
      }
      return next;
    });
  };

  const descKeyFor = (section: SectionKey, modelName: string) => `${section}:${modelName}:desc`;
  const toggleDesc = (section: SectionKey, modelName: string) => {
    const k = descKeyFor(section, modelName);
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  // Component for rendering collapsible language list
  const LanguageList: React.FC<{ languages: LanguageInfo[] | undefined; modelName: string }> = ({ languages, modelName }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Handle undefined languages
    if (!languages) {
      return <div style={{ fontSize: '14px', color: 'var(--text-muted)', fontStyle: 'italic' }}>Language information not available</div>;
    }

    const showCollapsible = languages.length > 20;
    const displayLanguages = showCollapsible && !isExpanded ? languages.slice(0, 20) : languages;

    return (
      <div style={{ marginTop: '12px' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
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
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: '12px',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)'
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
              color: 'var(--button-bg)',
              backgroundColor: 'transparent',
              border: '1px solid var(--button-bg)',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--button-bg)';
              e.currentTarget.style.color = 'var(--button-text)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--button-bg)';
            }}
          >
            {isExpanded ? 'Show Less' : `Show All ${languages.length} Languages`}
          </button>
        )}
      </div>
    );
  };

  // --- View toggle (global, page header) ---
  const renderViewToggle = () => {
    const options: { mode: ViewMode; label: string; icon: string }[] = [
      { mode: 'cards', label: 'Cards', icon: 'fa-th-large' },
      { mode: 'table', label: 'Table', icon: 'fa-table' },
      { mode: 'list', label: 'List', icon: 'fa-list' },
    ];
    return (
      <div style={{ display: 'inline-flex', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
        {options.map((opt) => {
          const active = viewMode === opt.mode;
          const baseStyle: React.CSSProperties = {
            padding: '6px 12px',
            fontSize: '13px',
            cursor: 'pointer',
            border: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'background-color 0.2s, color 0.2s',
            backgroundColor: active ? 'var(--button-bg)' : 'var(--bg-secondary)',
            color: active ? 'var(--button-text)' : 'var(--text-secondary)',
            fontWeight: active ? '600' : '400',
          };
          return (
            <button
              key={opt.mode}
              onClick={() => setViewMode(opt.mode)}
              title={`${opt.label} view`}
              style={baseStyle}
              onMouseOver={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseOut={(e) => {
                if (!active) {
                  e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              <i className={`fas ${opt.icon}`}></i>
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  };

  // --- Per-section sort control (shown only for the list view) ---
  const renderSortControl = (section: SectionKey) => {
    const s = sort[section];
    const keys: { key: SortKey; label: string }[] = [
      { key: 'price', label: 'Price' },
      { key: 'name', label: 'Name' },
      { key: 'reliability', label: 'Reliability' },
    ];
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-secondary)' }}>
        <span>Sort by:</span>
        {keys.map((k) => {
          const active = s.key === k.key;
          const style: React.CSSProperties = {
            padding: '4px 8px',
            fontSize: '12px',
            cursor: 'pointer',
            border: `1px solid ${active ? 'var(--button-bg)' : 'var(--border-color)'}`,
            borderRadius: '4px',
            backgroundColor: active ? 'var(--button-bg)' : 'transparent',
            color: active ? 'var(--button-text)' : 'var(--text-secondary)',
            fontWeight: active ? '600' : '400',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.2s',
          };
          return (
            <button
              key={k.key}
              onClick={() => cycleSort(section, k.key)}
              title={`Sort by ${k.label.toLowerCase()}`}
              style={style}
              onMouseOver={(e) => {
                if (!active) {
                  e.currentTarget.style.borderColor = 'var(--button-bg)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }
              }}
              onMouseOut={(e) => {
                if (!active) {
                  e.currentTarget.style.borderColor = 'var(--border-color)';
                  e.currentTarget.style.color = 'var(--text-secondary)';
                }
              }}
            >
              {k.label}
              {active && <i className={`fas ${s.dir === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down'}`}></i>}
            </button>
          );
        })}
      </div>
    );
  };

  // --- Cards view (original layout, unsorted - API order) ---
  const renderCards = (models: ServiceModel[], priceAccent: string, sectionKey: string) => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
      gridAutoRows: '1fr',
      gap: '16px',
      width: '100%'
    }}>
      {models.map((model, index) => (
        <div key={`${modelInfoVersion}-${sectionKey}-${model.name}-${index}`} style={{
          padding: '20px',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          backgroundColor: 'var(--bg-secondary)',
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
              color: 'var(--text-primary)',
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
            color: 'var(--text-secondary)',
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
              color: 'var(--bg-primary)',
              fontWeight: 'bold',
              padding: '8px 12px',
              backgroundColor: priceAccent,
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
  );

  // --- Table view (sortable via clickable headers) ---
  const renderTable = (models: ServiceModel[], accent: string, section: SectionKey) => {
    const s = sort[section];
    const sorted = getSorted(models, s);
    const arrow = (key: SortKey) => (s.key === key ? <i className={`fas ${s.dir === 'asc' ? 'fa-arrow-up' : 'fa-arrow-down'}`} style={{ marginLeft: '4px' }}></i> : null);

    const thBase: React.CSSProperties = {
      padding: '10px 12px',
      textAlign: 'left',
      fontSize: '12px',
      fontWeight: '600',
      color: 'var(--text-secondary)',
      textTransform: 'uppercase',
      letterSpacing: '0.03em',
    };
    const thSortable = (active: boolean): React.CSSProperties => ({
      ...thBase,
      cursor: 'pointer',
      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
      userSelect: 'none',
    });
    const tdBase: React.CSSProperties = {
      padding: '10px 12px',
      color: 'var(--text-secondary)',
      verticalAlign: 'middle',
    };
    const langBtn = (active: boolean): React.CSSProperties => ({
      padding: '4px 10px',
      fontSize: '12px',
      cursor: 'pointer',
      border: '1px solid var(--border-color)',
      borderRadius: '12px',
      backgroundColor: active ? 'var(--button-bg)' : 'transparent',
      color: active ? 'var(--button-text)' : 'var(--button-bg)',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      transition: 'all 0.2s',
    });

    return (
      <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', minWidth: '640px' }}>
          <thead>
            <tr style={{ borderBottom: `2px solid ${accent}` }}>
              <th onClick={() => cycleSort(section, 'name')} style={thSortable(s.key === 'name')}>
                Model{arrow('name')}
              </th>
              <th onClick={() => cycleSort(section, 'reliability')} style={thSortable(s.key === 'reliability')}>
                Reliability{arrow('reliability')}
              </th>
              <th onClick={() => cycleSort(section, 'price')} style={{ ...thSortable(s.key === 'price'), textAlign: 'right' }}>
                Price{arrow('price')}
              </th>
              <th style={thBase}>Languages</th>
              <th style={thBase}>Description</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((model, i) => {
              const expanded = expandedRows.has(rowKeyFor(section, model.name));
              const descExpanded = expandedRows.has(descKeyFor(section, model.name));
              const count = model.languages_supported?.length ?? 0;
              const stripeBg = i % 2 ? 'var(--bg-tertiary)' : 'var(--bg-secondary)';
              return (
                <React.Fragment key={`${modelInfoVersion}-${section}-${model.name}-${i}`}>
                  <tr
                    style={{ backgroundColor: stripeBg }}
                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-primary)'; }}
                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = stripeBg; }}
                  >
                    <td style={{ ...tdBase, fontWeight: '600', color: 'var(--text-primary)' }}>
                      {model.display_name}
                    </td>
                    <td style={tdBase}>
                      <span style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        backgroundColor: getReliabilityColor(model.reliability),
                        color: 'white',
                        fontWeight: '600',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        display: 'inline-block',
                      }}>
                        {model.reliability}
                      </span>
                    </td>
                    <td style={{ ...tdBase, textAlign: 'right', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                      {formatPrice(model.price, model.pricing)}
                    </td>
                    <td style={tdBase}>
                      <button
                        onClick={() => toggleRow(section, model.name)}
                        style={langBtn(expanded)}
                        title={expanded ? 'Hide languages' : 'Show languages'}
                      >
                        {count} {count === 1 ? 'language' : 'languages'}
                        <i className={`fas ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                      </button>
                    </td>
                    <td
                      style={{
                        ...tdBase,
                        maxWidth: '360px',
                        whiteSpace: 'normal',
                        wordBreak: 'break-word',
                        lineHeight: '1.5',
                      }}
                    >
                      {model.description}
                    </td>
                  </tr>
                  {expanded && (
                    <tr style={{ backgroundColor: stripeBg }}>
                      <td colSpan={5} style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
                        <LanguageList languages={model.languages_supported} modelName={model.name} />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // --- List view (sortable via per-section sort control) ---
  const renderList = (models: ServiceModel[], section: SectionKey) => {
    const sorted = getSorted(models, sort[section]);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%' }}>
        {sorted.map((model, i) => {
          const expanded = expandedRows.has(rowKeyFor(section, model.name));
          const descExpanded = expandedRows.has(descKeyFor(section, model.name));
          const count = model.languages_supported?.length ?? 0;
          return (
            <div
              key={`${modelInfoVersion}-${section}-${model.name}-${i}`}
              style={{
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                backgroundColor: i % 2 ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                padding: '12px 16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 40%', minWidth: '180px' }}>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text-primary)', marginBottom: '6px' }}>
                    {model.display_name}
                  </div>
                  <span style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    backgroundColor: getReliabilityColor(model.reliability),
                    color: 'white',
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    whiteSpace: 'nowrap',
                    display: 'inline-block',
                  }}>
                    {model.reliability}
                  </span>
                </div>
                <div
                  onClick={() => toggleDesc(section, model.name)}
                  title={descExpanded ? 'Click to collapse' : 'Click to expand'}
                  style={{
                    flex: '1 1 30%',
                    minWidth: '160px',
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    whiteSpace: descExpanded ? 'normal' : 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {model.description}
                </div>
                <div style={{ flex: '0 0 auto', marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                    {formatPrice(model.price, model.pricing)}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: '8px' }}>
                <button
                  onClick={() => toggleRow(section, model.name)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    backgroundColor: expanded ? 'var(--button-bg)' : 'transparent',
                    color: expanded ? 'var(--button-text)' : 'var(--button-bg)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                  }}
                  title={expanded ? 'Hide languages' : 'Show languages'}
                >
                  {count} {count === 1 ? 'language' : 'languages'}
                  <i className={`fas ${expanded ? 'fa-chevron-up' : 'fa-chevron-down'}`}></i>
                </button>
              </div>
              {expanded && <LanguageList languages={model.languages_supported} modelName={model.name} />}
            </div>
          );
        })}
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

  const renderSection = (
    title: string,
    accent: string,
    section: SectionKey,
    models: ServiceModel[] | undefined,
    emptyText: string
  ) => {
    const hasModels = !!(models && models.length > 0);
    return (
      <section style={{ marginBottom: '40px', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, color: 'var(--text-primary)', borderBottom: `2px solid ${accent}`, paddingBottom: '8px' }}>
            {title}
          </h2>
          {effectiveView === 'list' && renderSortControl(section)}
        </div>
        {hasModels ? (
          effectiveView === 'cards' ? renderCards(models!, accent, section)
            : effectiveView === 'table' ? renderTable(models!, accent, section)
              : renderList(models!, section)
        ) : (
          <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '16px' }}>
            {emptyText}
          </p>
        )}
      </section>
    );
  };


  return (
    <>
      <div key={modelInfoVersion} className="info-container" style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '20px' }}>
      <h1>AI Model Information & Pricing</h1>
      <p style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
        Learn about the available AI models and their pricing structure. All prices are in credits.
      </p>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
        {renderViewToggle()}
      </div>

      {renderSection(
        'Transcription Models',
        'var(--info-color)',
        'transcription',
        servicesInfo?.Transcription,
        'No transcription models available. Please check your API configuration.'
      )}

      {renderSection(
        'Translation Models',
        'var(--danger-color)',
        'translation',
        servicesInfo?.Translation,
        'No translation models available. Please check your API configuration.'
      )}

      {/* Pricing Notes */}
      <section style={{
        padding: '20px',
        backgroundColor: 'var(--bg-tertiary)',
        borderLeft: '4px solid var(--info-color)',
        borderRadius: '4px',
        marginTop: '30px'
      }}>
        <h3 style={{ marginBottom: '12px', color: 'var(--info-color)' }}>Pricing Information</h3>
        <ul style={{ marginLeft: '20px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
          <li>All prices are quoted in credits, which are deducted from your account upon successful processing</li>
          <li>Transcription costs are calculated based on audio duration (per minute)</li>
          <li>Translation costs are calculated based on character count (per character)</li>
          <li>Failed operations do not consume credits</li>
           <li>Prices may vary based on selected model</li>
          <li>Pricing is subject to change - check this page for the latest information</li>
        </ul>
      </section>

      {/* Usage Tips */}
      <section style={{
        padding: '20px',
        backgroundColor: 'var(--bg-tertiary)',
        borderLeft: '4px solid var(--success-color)',
        borderRadius: '4px',
        marginTop: '20px'
      }}>
        <h3 style={{ marginBottom: '12px', color: 'var(--success-color)' }}><i className="fas fa-lightbulb"></i> Cost Optimization Tips</h3>
        <ul style={{ marginLeft: '20px', lineHeight: '1.6', color: 'var(--text-secondary)' }}>
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
