import React, { useState, useEffect, useRef } from 'react';
import { useAPI } from '../contexts/APIContext';
import { logger } from '../utils/errorLogger';

interface SupportProps {
  prefilledDescription?: string;
}

type SupportScope = 'ai' | 'other';

const Support: React.FC<SupportProps> = ({ prefilledDescription }) => {
  const { createSupportTicket } = useAPI();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [scope, setScope] = useState<SupportScope>('ai');
  const [otherService, setOtherService] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; ticketId?: number; error?: string } | null>(null);

  // Field-level validation errors
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');
  const [otherServiceError, setOtherServiceError] = useState('');

  // Track whether the prefill has been consumed so it only applies once per mount
  const prefillConsumed = useRef(false);

  // Load initial values on mount
  useEffect(() => {
    const loadSavedData = async () => {
      try {
        // Apply crash-report prefill (once per mount) — the user types their
        // own description above this block.
        if (prefilledDescription && !prefillConsumed.current) {
          prefillConsumed.current = true;
          setProblemDescription(prefilledDescription);
        }

        // Try to load saved email from config
        const config = await window.electronAPI?.getConfig?.();
        if (config?.supportEmail) {
          setEmail(config.supportEmail);
        }
      } catch (error) {
        logger.error('Support', 'Error loading saved email:', error);
      }
    };
    
    loadSavedData();
  }, [prefilledDescription]);

  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitResult(null);

    // Trim inputs
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedDescription = problemDescription.trim();
    const trimmedOtherService = otherService.trim();

    // Validate
    let hasError = false;

    if (!trimmedName) {
      setNameError('Name is required');
      hasError = true;
    } else {
      setNameError('');
    }

    if (!trimmedEmail) {
      setEmailError('Email is required');
      hasError = true;
    } else if (!validateEmail(trimmedEmail)) {
      setEmailError('Invalid email format');
      hasError = true;
    } else {
      setEmailError('');
    }

    // 'Other service' is required only when scope is 'other'
    if (scope === 'other' && !trimmedOtherService) {
      setOtherServiceError('Please specify the OpenSubtitles.com service you need help with');
      hasError = true;
    } else {
      setOtherServiceError('');
    }

    if (!trimmedDescription) {
      setDescriptionError('Problem description is required');
      hasError = true;
    } else {
      setDescriptionError('');
    }

    if (hasError) return;

    // Build the scope tag that lets osTicket filter tickets by product.
    // Injected silently — the user's textarea content is left untouched.
    const scopeTag = scope === 'ai'
      ? '[SCOPE:AI]'
      : `[SCOPE:OTHER:${trimmedOtherService}]`;
    const finalDescription = `${scopeTag} ${trimmedDescription}`;

    // Submit
    setIsSubmitting(true);
    const result = await createSupportTicket(finalDescription, trimmedEmail, trimmedName);
    setIsSubmitting(false);

    if (result.success) {
      setSubmitResult({ success: true, ticketId: result.ticket_id });
      // Persist email for future sessions
      try {
        await window.electronAPI?.saveConfig?.({ supportEmail: trimmedEmail });
      } catch (error) {
        logger.error('Support', 'Error saving email:', error);
      }
      // Reset form
      setName('');
      setEmail('');
      setProblemDescription('');
      setScope('ai');
      setOtherService('');
// Re-populate email from config (might have changed)
       try {
         const config = await window.electronAPI?.getConfig?.();
         if (config?.supportEmail) {
           setEmail(config.supportEmail);
         }
       } catch (error) {
         logger.error('Support', 'Error reloading email:', error);
       }
    } else {
      setSubmitResult({ success: false, error: result.error || 'Failed to submit support ticket' });
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      gap: '1em'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
      }}>
        <h1>
          Contact Support
        </h1>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        overflowY: 'auto'
      }}>
        {submitResult?.success ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '560px' }}>
            <div
              className="status-message"
              style={{
                padding: '20px',
                borderRadius: '8px',
                backgroundColor: 'var(--success-color)',
                color: '#fff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 600 }}>
                <i className="fas fa-check-circle"></i>
                Ticket submitted successfully!
              </div>
              {submitResult.ticketId != null && (
                <div style={{ marginTop: '8px', fontSize: '13px', opacity: 0.95, lineHeight: 1.4 }}>
                  Your ticket ID is <strong>#{submitResult.ticketId}</strong>. Our team will reply by email.
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSubmitResult(null)}
              className="btn-primary"
              style={{
                padding: '12px 24px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                width: '100%'
              }}
            >
              <i className="fas fa-plus" style={{ marginRight: '8px' }}></i>
              Submit another ticket
            </button>
          </div>
        ) : (
        <>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1em' }}>
            Need help? Fill out the form below and our support team will get back to you as soon as possible.
          </p>

        <form onSubmit={handleSubmit}>
          {/* Name Field */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="support-name"
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--text-primary)',
                marginBottom: '6px'
              }}
            >
              Name <span style={{ color: 'var(--danger-color)' }}>*</span>
            </label>
            <input
              id="support-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => !name.trim() && setNameError('Name is required')}
              disabled={isSubmitting}
              placeholder="Your name"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: nameError ? '1px solid var(--danger-color)' : '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
            />
            {nameError && (
              <span style={{
                display: 'block',
                marginTop: '4px',
                fontSize: '12px',
                color: 'var(--danger-color)'
              }}>
                {nameError}
              </span>
            )}
          </div>

          {/* Email Field */}
          <div style={{ marginBottom: '20px' }}>
            <label
              htmlFor="support-email"
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--text-primary)',
                marginBottom: '6px'
              }}
            >
              Email <span style={{ color: 'var(--danger-color)' }}>*</span>
            </label>
            <input
              id="support-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => {
                if (!email.trim()) {
                  setEmailError('Email is required');
                } else if (!validateEmail(email.trim())) {
                  setEmailError('Invalid email format');
                } else {
                  setEmailError('');
                }
              }}
              disabled={isSubmitting}
              placeholder="your.email@example.com"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: emailError ? '1px solid var(--danger-color)' : '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
            />
            {emailError && (
              <span style={{
                display: 'block',
                marginTop: '4px',
                fontSize: '12px',
                color: 'var(--danger-color)'
              }}>
                {emailError}
              </span>
            )}
            <p style={{
              marginTop: '6px',
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              fontStyle: 'italic',
              lineHeight: '1.4'
            }}>
              Your email address is stored locally on this computer and is only transmitted when you submit a support ticket. We do not retain, process, or share your email beyond responding to your specific inquiry.
            </p>
          </div>

          {/* Support Scope Field */}
          <div style={{ marginBottom: '20px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--text-primary)',
                marginBottom: '6px'
              }}
            >
              Support scope <span style={{ color: 'var(--danger-color)' }}>*</span>
            </label>
            <p style={{
              fontSize: '12px',
              color: 'var(--text-tertiary)',
              fontStyle: 'italic',
              marginBottom: '10px',
              lineHeight: '1.4'
            }}>
              This form is for the AI subtitle generator. For help with other OpenSubtitles.com services, pick the second option so we can route your request correctly.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Option A: AI.OpenSubtitles.com */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px',
                  border: `2px solid ${scope === 'ai' ? 'var(--accent-color)' : '1px solid var(--border-color)'}`,
                  borderRadius: '8px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  backgroundColor: scope === 'ai' ? 'rgba(52, 152, 219, 0.1)' : 'transparent',
                  transition: 'border-color 0.2s, background-color 0.2s'
                }}
              >
                <input
                  type="radio"
                  name="supportScope"
                  value="ai"
                  checked={scope === 'ai'}
                  onChange={() => {
                    setScope('ai');
                    setOtherServiceError('');
                  }}
                  disabled={isSubmitting}
                  style={{ marginTop: '3px' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                    <i className="fas fa-robot" style={{ marginRight: '6px' }}></i>
                    AI.OpenSubtitles.com (this app)
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    For issues with the AI subtitle generator, transcription, translation, credits, or your account here.
                  </div>
                </div>
              </label>

              {/* Option B: Other OpenSubtitles.com product */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  padding: '12px',
                  border: `2px solid ${scope === 'other' ? 'var(--accent-color)' : '1px solid var(--border-color)'}`,
                  borderRadius: '8px',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  backgroundColor: scope === 'other' ? 'rgba(52, 152, 219, 0.1)' : 'transparent',
                  transition: 'border-color 0.2s, background-color 0.2s'
                }}
              >
                <input
                  type="radio"
                  name="supportScope"
                  value="other"
                  checked={scope === 'other'}
                  onChange={() => setScope('other')}
                  disabled={isSubmitting}
                  style={{ marginTop: '3px' }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                    <i className="fas fa-globe" style={{ marginRight: '6px' }}></i>
                    Other OpenSubtitles.com product
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                    For the classic subtitle search, API, downloader, forum, or any other OpenSubtitles.com service.
                  </div>
                </div>
              </label>
            </div>

            {/* Other service text field — conditionally revealed */}
            {scope === 'other' && (
              <div style={{ marginTop: '12px' }}>
                <label
                  htmlFor="support-other-service"
                  style={{
                    display: 'block',
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'var(--text-primary)',
                    marginBottom: '6px'
                  }}
                >
                  Which service? <span style={{ color: 'var(--danger-color)' }}>*</span>
                </label>
                <input
                  id="support-other-service"
                  type="text"
                  value={otherService}
                  onChange={(e) => setOtherService(e.target.value)}
                  onBlur={() => {
                    if (scope === 'other' && !otherService.trim()) {
                      setOtherServiceError('Please specify the OpenSubtitles.com service you need help with');
                    } else {
                      setOtherServiceError('');
                    }
                  }}
                  disabled={isSubmitting}
                  placeholder="e.g. Classic subtitle search, API, Downloader, Forum..."
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '6px',
                    border: otherServiceError ? '1px solid var(--danger-color)' : '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                />
                {otherServiceError && (
                  <span style={{
                    display: 'block',
                    marginTop: '4px',
                    fontSize: '12px',
                    color: 'var(--danger-color)'
                  }}>
                    {otherServiceError}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Problem Description Field */}
          <div style={{ marginBottom: '24px' }}>
            <label
              htmlFor="support-description"
              style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '500',
                color: 'var(--text-primary)',
                marginBottom: '6px'
              }}
            >
              Problem Description <span style={{ color: 'var(--danger-color)' }}>*</span>
            </label>
            <textarea
              id="support-description"
              value={problemDescription}
              onChange={(e) => setProblemDescription(e.target.value)}
              onBlur={() => !problemDescription.trim() && setDescriptionError('Problem description is required')}
              disabled={isSubmitting}
              placeholder="Please describe your issue in detail..."
              rows={6}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: descriptionError ? '1px solid var(--danger-color)' : '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                lineHeight: '1.5',
                resize: 'vertical',
                boxSizing: 'border-box',
                outline: 'none',
                transition: 'border-color 0.2s',
                fontFamily: 'inherit'
              }}
            />
            {descriptionError && (
              <span style={{
                display: 'block',
                marginTop: '4px',
                fontSize: '12px',
                color: 'var(--danger-color)'
              }}>
                {descriptionError}
              </span>
            )}
          </div>

          {/* Inline error alert — rendered next to the action that triggered it,
              so the user sees it without scrolling away from the fields they need to fix. */}
          {submitResult?.error && (
            <div
              className="status-message"
              role="alert"
              style={{
                padding: '14px 16px',
                borderRadius: '8px',
                backgroundColor: 'var(--danger-color)',
                color: '#fff',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                fontSize: '14px',
                lineHeight: 1.4
              }}
            >
              <i className="fas fa-exclamation-circle" style={{ marginTop: '2px', flexShrink: 0 }}></i>
              <span>{submitResult.error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary"
            style={{
              padding: '12px 24px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: isSubmitting ? 'not-allowed' : 'pointer',
              width: '100%'
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Ticket'}
          </button>
        </form>
        </>
        )}
      </div>
    </div>
  );
};

export default Support;
