import React, { useState, useEffect } from 'react';
import { useAPI } from '../contexts/APIContext';
import { logger } from '../utils/errorLogger';

const Support: React.FC = () => {
  const { createSupportTicket } = useAPI();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [problemDescription, setProblemDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; ticketId?: number; error?: string } | null>(null);

  // Field-level validation errors
  const [nameError, setNameError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [descriptionError, setDescriptionError] = useState('');

  // Load initial values on mount
  useEffect(() => {
    const loadSavedData = async () => {
      try {
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
  }, []);

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

    if (!trimmedDescription) {
      setDescriptionError('Problem description is required');
      hasError = true;
    } else {
      setDescriptionError('');
    }

    if (hasError) return;

    // Submit
    setIsSubmitting(true);
    const result = await createSupportTicket(trimmedDescription, trimmedEmail, trimmedName);
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
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1em' }}>
          Need help? Fill out the form below and our support team will get back to you as soon as possible.
        </p>

        {submitResult?.success ? (
          <div
            className="status-message"
            style={{
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: 'var(--success-color)',
              color: '#fff',
              marginBottom: '20px'
            }}
          >
            <i className="fas fa-check-circle" style={{ marginRight: '8px' }}></i>
            Ticket submitted successfully!
          </div>
        ) : submitResult?.error ? (
          <div
            className="status-message"
            style={{
              padding: '16px',
              borderRadius: '8px',
              backgroundColor: 'var(--danger-color)',
              color: '#fff',
              marginBottom: '20px'
            }}
          >
            <i className="fas fa-exclamation-circle" style={{ marginRight: '8px' }}></i>
            {submitResult.error}
          </div>
        ) : null}

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
      </div>
    </div>
  );
};

export default Support;
