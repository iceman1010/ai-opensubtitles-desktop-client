import { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom';
import type { QualityReport, QualityDefect, ReadabilityReport, ReadabilityProblem } from '../services/api';

interface QualityReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  quality?: QualityReport | null;
  readability?: ReadabilityReport | null;
  qualityRefund?: number | null;
  fileName?: string;
}

type TabId = 'summary' | 'defects' | 'readability';

const RATIO_LABELS: Record<string, string> = {
  content_loss: 'Content loss',
  timestamp_drift: 'Timestamp drift',
  partial_translation: 'Partial translation',
  merged: 'Merged captions',
  verbatim_copy: 'Verbatim copy',
  near_verbatim_copy: 'Near-verbatim copy',
  unexpected_script: 'Unexpected script',
  unaligned: 'Unaligned',
};

const RATIO_ORDER = [
  'content_loss',
  'timestamp_drift',
  'partial_translation',
  'merged',
  'verbatim_copy',
  'near_verbatim_copy',
  'unexpected_script',
  'unaligned',
];

const DEFECT_LABELS: Record<string, string> = {
  invalid_format: 'Invalid format',
  missing_caption: 'Missing caption',
  partial_translation: 'Partial translation',
  timestamp_mismatch: 'Timestamp mismatch',
  untranslated_copy: 'Untranslated copy',
  edited_copy: 'Edited copy',
  unexpected_script: 'Unexpected script',
  merged_captions: 'Merged captions',
  split_captions: 'Split captions',
  extra_caption: 'Extra caption',
  format_mismatch: 'Format mismatch',
  source_parse_failed: 'Source parse failed',
  same_language_passthrough: 'Same-language passthrough',
};

const ISSUE_LABELS: Record<string, string> = {
  reading_speed: 'Reading speed',
  line_length: 'Line length',
  line_count: 'Line count',
};

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(2)}%`;
}

function formatTimecode(seconds: number): string {
  const s = Math.floor(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function label(key: string, labels: Record<string, string>): string {
  return labels[key] || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function StatChip({ label: chipLabel, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      padding: '8px 14px',
      backgroundColor: 'var(--bg-tertiary)',
      borderRadius: '6px',
      border: '1px solid var(--border-light)',
      minWidth: '100px',
    }}>
      <div style={{ fontSize: '17px', fontWeight: '600', color: color || 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{chipLabel}</div>
    </div>
  );
}

function RatioRow({ ratioKey, ratio, threshold }: { ratioKey: string; threshold: number | null; ratio: number }) {
  const exceeded = threshold !== null && ratio > threshold;
  const fill = threshold === null
    ? Math.min(ratio * 100, 100)
    : threshold > 0
      ? Math.min((ratio / threshold) * 100, 100)
      : ratio > 0 ? 100 : 0;
  const barColor = threshold === null
    ? 'var(--text-muted)'
    : exceeded ? 'var(--danger-color)' : 'var(--success-color)';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
      <div style={{ width: '170px', fontSize: '13px', color: 'var(--text-primary)', flexShrink: 0 }}>
        {label(ratioKey, RATIO_LABELS)}
      </div>
      <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{
          width: `${fill}%`,
          height: '100%',
          backgroundColor: barColor,
          borderRadius: '3px',
          transition: 'width 0.3s ease',
        }} />
      </div>
      <div style={{ width: '90px', textAlign: 'right', fontSize: '13px', fontFamily: 'monospace', color: exceeded ? 'var(--danger-color)' : 'var(--text-primary)', flexShrink: 0 }}>
        {formatPercent(ratio)}
      </div>
      <div style={{ width: '80px', textAlign: 'right', fontSize: '11px', color: 'var(--text-secondary)', flexShrink: 0 }}>
        {threshold === null ? 'advisory' : `max ${formatPercent(threshold)}`}
      </div>
    </div>
  );
}

function DefectGroup({ type, defects }: { type: string; defects: QualityDefect[] }) {
  const isError = defects[0]?.severity === 'error';
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px',
        fontSize: '13px', fontWeight: '600',
        color: isError ? 'var(--danger-color)' : '#e67e22',
      }}>
        <i className={isError ? 'fas fa-times-circle' : 'fas fa-exclamation-triangle'}></i>
        <span>{label(type, DEFECT_LABELS)}</span>
        <span style={{
          padding: '1px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: '500',
          backgroundColor: isError ? 'rgba(220, 53, 69, 0.15)' : 'rgba(230, 126, 34, 0.15)',
        }}>{defects.length}</span>
      </div>
      {defects.map((d, i) => (
        <div key={i} style={{
          padding: '8px 12px', marginBottom: '4px',
          backgroundColor: 'var(--bg-tertiary)',
          borderLeft: `3px solid ${isError ? 'var(--danger-color)' : '#e67e22'}`,
          borderRadius: '4px', fontSize: '13px', color: 'var(--text-primary)',
          lineHeight: 1.5,
        }}>
          {d.message}
        </div>
      ))}
    </div>
  );
}

function ReadabilityProblemRow({ problem }: { problem: ReadabilityProblem }) {
  const critical = problem.severity === 'critical';
  return (
    <div style={{
      padding: '10px 14px',
      backgroundColor: 'var(--bg-tertiary)',
      borderLeft: `3px solid ${critical ? 'var(--danger-color)' : '#e67e22'}`,
      borderRadius: '4px',
      marginBottom: '6px',
      fontSize: '13px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', color: 'var(--text-secondary)', fontSize: '12px' }}>
        <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>#{problem.caption}</span>
        <span style={{
          padding: '1px 6px', borderRadius: '3px', fontSize: '10px', fontWeight: '600',
          backgroundColor: critical ? 'rgba(220, 53, 69, 0.15)' : 'rgba(230, 126, 34, 0.15)',
          color: critical ? 'var(--danger-color)' : '#e67e22',
        }}>{problem.severity}</span>
        <span style={{ fontFamily: 'monospace' }}>
          {formatTimecode(problem.start_seconds)} &rarr; {formatTimecode(problem.end_seconds)}
        </span>
        <span>{problem.duration_seconds.toFixed(1)}s</span>
        <span>{problem.chars} chars</span>
        {problem.cps !== null && <span>{problem.cps.toFixed(1)} cps</span>}
      </div>
      <div style={{ marginTop: '6px', color: 'var(--text-primary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
        {problem.text}
      </div>
      <div style={{ marginTop: '6px', display: 'flex', gap: '10px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--text-secondary)' }}>
        {problem.issues.map((issue, i) => (
          <span key={i}>
            <i className="fas fa-circle" style={{ fontSize: '5px', verticalAlign: 'middle', marginRight: '4px', color: issue.severity === 'critical' ? 'var(--danger-color)' : '#e67e22' }}></i>
            {label(issue.type, ISSUE_LABELS)}: {issue.type === 'reading_speed' ? `${issue.value.toFixed(1)} cps` : `${issue.value}`} (limit {issue.type === 'reading_speed' ? `${issue.limit.toFixed(1)}` : issue.limit})
          </span>
        ))}
      </div>
    </div>
  );
}

function QualityReportModal({ isOpen, onClose, quality, readability, qualityRefund, fileName }: QualityReportModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('summary');
  const [readabilityFilter, setReadabilityFilter] = useState<'all' | 'critical' | 'minor'>('all');

  useEffect(() => {
    if (isOpen) {
      setActiveTab('summary');
      setReadabilityFilter('all');
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  const defectGroups = useMemo(() => {
    if (!quality?.defects) return [];
    const groups = new Map<string, QualityDefect[]>();
    for (const defect of quality.defects) {
      const list = groups.get(defect.type) || [];
      list.push(defect);
      groups.set(defect.type, list);
    }
    return Array.from(groups.entries())
      .sort((a, b) => {
        const aErr = a[1][0]?.severity === 'error' ? 0 : 1;
        const bErr = b[1][0]?.severity === 'error' ? 0 : 1;
        return aErr - bErr || b[1].length - a[1].length;
      });
  }, [quality]);

  const filteredProblems = useMemo(() => {
    if (!readability?.problems) return [];
    if (readabilityFilter === 'all') return readability.problems;
    return readability.problems.filter(p => p.severity === readabilityFilter);
  }, [readability, readabilityFilter]);

  if (!isOpen) return null;

  const hasQuality = !!quality;
  const hasReadability = !!readability;
  const valid = quality?.valid ?? true;
  const verdictColor = valid ? 'var(--success-color)' : 'var(--danger-color)';

  const tabs: { id: TabId; label: string; badge?: number; disabled: boolean }[] = [
    { id: 'summary', label: 'Summary', disabled: !hasQuality && !hasReadability },
    { id: 'defects', label: 'Defects', badge: quality?.defect_count, disabled: !hasQuality },
    { id: 'readability', label: 'Readability', badge: readability ? Object.values(readability.problems_by_type || {}).reduce((a, b) => a + b, 0) : undefined, disabled: !hasReadability },
  ];

  return ReactDOM.createPortal(
    <div
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: '12px',
          width: '90vw',
          maxWidth: '900px',
          height: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          border: '1px solid var(--border-color)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <h2 style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            overflow: 'hidden',
          }}>
            <i className="fas fa-clipboard-check" style={{ color: verdictColor, flexShrink: 0 }}></i>
            <span>Translation Quality Report</span>
            {fileName && (
              <span style={{ fontSize: '12px', fontWeight: '400', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                &middot; {fileName}
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              fontSize: '24px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: '4px 8px',
              lineHeight: 1,
              flexShrink: 0,
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Verdict banner */}
        {hasQuality && (
          <div style={{
            padding: '12px 20px',
            backgroundColor: valid ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)',
            borderBottom: `1px solid ${valid ? 'rgba(40, 167, 69, 0.3)' : 'rgba(220, 53, 69, 0.3)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            flexShrink: 0,
          }}>
            <span style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              fontSize: '15px', fontWeight: '600', color: verdictColor,
            }}>
              <i className={valid ? 'fas fa-check-circle' : 'fas fa-times-circle'}></i>
              {valid ? 'Translation passed the quality check' : 'Translation failed the quality check'}
            </span>
            {quality && quality.error_count > 0 && (
              <span style={{ fontSize: '12px', color: 'var(--danger-color)' }}>
                {quality.error_count} error{quality.error_count !== 1 ? 's' : ''}
              </span>
            )}
            {quality && quality.warning_count > 0 && (
              <span style={{ fontSize: '12px', color: '#e67e22' }}>
                {quality.warning_count} warning{quality.warning_count !== 1 ? 's' : ''}
              </span>
            )}
            {typeof qualityRefund === 'number' && qualityRefund > 0 && (
              <span style={{
                display: 'flex', alignItems: 'center', gap: '6px',
                padding: '3px 10px', borderRadius: '4px', fontSize: '12px', fontWeight: '600',
                backgroundColor: 'rgba(155, 89, 182, 0.15)', color: '#9b59b6',
              }}>
                <i className="fas fa-coins"></i>
                {qualityRefund} credits refunded
              </span>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex',
          gap: '4px',
          padding: '8px 20px 0 20px',
          borderBottom: '1px solid var(--border-color)',
          flexShrink: 0,
        }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => !tab.disabled && setActiveTab(tab.id)}
              disabled={tab.disabled}
              style={{
                padding: '8px 14px',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${activeTab === tab.id ? 'var(--primary-color)' : 'transparent'}`,
                color: tab.disabled ? 'var(--text-disabled)' : activeTab === tab.id ? 'var(--primary-color)' : 'var(--text-secondary)',
                fontSize: '13px',
                fontWeight: activeTab === tab.id ? '600' : '500',
                cursor: tab.disabled ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              {tab.label}
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span style={{
                  padding: '1px 7px', borderRadius: '10px', fontSize: '11px', fontWeight: '500',
                  backgroundColor: activeTab === tab.id ? 'var(--primary-color)' : 'var(--bg-tertiary)',
                  color: activeTab === tab.id ? 'var(--button-text)' : 'var(--text-secondary)',
                }}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {activeTab === 'summary' && (
            <div>
              {hasQuality ? (
                <>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    <StatChip label="Source captions" value={String(quality!.quality.source_captions)} />
                    <StatChip label="Aligned pairs" value={String(quality!.quality.aligned_pairs)} />
                    <StatChip
                      label="Errors"
                      value={String(quality!.error_count)}
                      color={quality!.error_count > 0 ? 'var(--danger-color)' : 'var(--success-color)'}
                    />
                    <StatChip
                      label="Warnings"
                      value={String(quality!.warning_count)}
                      color={quality!.warning_count > 0 ? '#e67e22' : undefined}
                    />
                    {readability && <StatChip label="Avg reading speed" value={`${readability.avg_cps.toFixed(1)} cps`} />}
                    {readability && <StatChip label="Max reading speed" value={`${readability.max_cps.toFixed(1)} cps`} />}
                  </div>

                  {!valid && quality!.quality.reasons.length > 0 && (
                    <div style={{
                      padding: '10px 14px', marginBottom: '20px',
                      backgroundColor: 'rgba(220, 53, 69, 0.1)',
                      border: '1px solid rgba(220, 53, 69, 0.3)',
                      borderRadius: '6px',
                    }}>
                      <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--danger-color)', marginBottom: '6px' }}>
                        <i className="fas fa-exclamation-circle" style={{ marginRight: '6px' }}></i>
                        Limits exceeded:
                      </div>
                      {quality!.quality.reasons.map((reason, i) => (
                        <div key={i} style={{ fontSize: '13px', color: 'var(--text-primary)', padding: '2px 0' }}>
                          {reason}
                        </div>
                      ))}
                    </div>
                  )}

                  <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text-primary)' }}>Quality ratios</h4>
                  <div style={{ padding: '4px 0' }}>
                    {RATIO_ORDER.map(key => (
                      <RatioRow
                        key={key}
                        ratioKey={key}
                        ratio={(quality!.quality.ratios as Record<string, number>)[key]}
                        threshold={(quality!.quality.thresholds as Record<string, number | null>)[key] ?? null}
                      />
                    ))}
                  </div>
                </>
              ) : hasReadability ? (
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <StatChip label="Captions" value={String(readability!.captions)} />
                  <StatChip label="Avg reading speed" value={`${readability!.avg_cps.toFixed(1)} cps`} />
                  <StatChip label="Max reading speed" value={`${readability!.max_cps.toFixed(1)} cps`} />
                  <StatChip label="Longest line" value={`${readability!.max_cpl} chars`} />
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                  No quality data available for this result.
                </div>
              )}
            </div>
          )}

          {activeTab === 'defects' && (
            <div>
              {defectGroups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                  <i className="fas fa-check-circle" style={{ fontSize: '24px', color: 'var(--success-color)', marginBottom: '12px', display: 'block' }}></i>
                  No defects reported.
                </div>
              ) : (
                defectGroups.map(([type, defects]) => (
                  <DefectGroup key={type} type={type} defects={defects} />
                ))
              )}
            </div>
          )}

          {activeTab === 'readability' && (
            <div>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                <StatChip label="Captions" value={String(readability!.captions)} />
                <StatChip label="Analyzed" value={String(readability!.analyzed)} />
                <StatChip label="Avg speed" value={`${readability!.avg_cps.toFixed(1)} cps`} />
                <StatChip label="Max speed" value={`${readability!.max_cps.toFixed(1)} cps`} color={readability!.max_cps > readability!.thresholds.max_cps ? 'var(--danger-color)' : undefined} />
                <StatChip label="Longest line" value={`${readability!.max_cpl} chars`} color={readability!.max_cpl > readability!.thresholds.max_cpl ? 'var(--danger-color)' : undefined} />
              </div>

              <div style={{
                fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px',
                display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap',
              }}>
                <span>
                  Limits: {readability!.thresholds.max_cps} cps, {readability!.thresholds.max_cpl} chars/line, {readability!.thresholds.max_lines} lines
                </span>
                {Object.entries(readability!.problems_by_type || {}).map(([type, count]) => (
                  <span key={type} style={{
                    padding: '2px 8px', borderRadius: '4px',
                    backgroundColor: 'var(--bg-tertiary)', fontSize: '11px',
                  }}>
                    {label(type, ISSUE_LABELS)}: {count}
                  </span>
                ))}
              </div>

              {readability!.problems.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                  {(['all', 'critical', 'minor'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setReadabilityFilter(f)}
                      style={{
                        padding: '4px 12px', fontSize: '12px',
                        borderRadius: '4px', cursor: 'pointer',
                        border: `1px solid ${readabilityFilter === f ? 'var(--primary-color)' : 'var(--border-color)'}`,
                        backgroundColor: readabilityFilter === f ? 'var(--primary-color)' : 'transparent',
                        color: readabilityFilter === f ? 'var(--button-text)' : 'var(--text-secondary)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {f}
                      {f !== 'all' && ` (${readability!.problems.filter(p => p.severity === f).length})`}
                    </button>
                  ))}
                </div>
              )}

              {readability!.problems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)' }}>
                  <i className="fas fa-check-circle" style={{ fontSize: '24px', color: 'var(--success-color)', marginBottom: '12px', display: 'block' }}></i>
                  Every caption is within the readability limits.
                </div>
              ) : (
                filteredProblems.map(problem => (
                  <ReadabilityProblemRow key={problem.caption} problem={problem} />
                ))
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          flexShrink: 0,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '500',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'background 0.2s ease',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default QualityReportModal;