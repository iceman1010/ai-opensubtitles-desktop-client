import { useCallback } from 'react';
import { logger } from '../utils/errorLogger';

export interface AutoDetectFailureHookResult {
  handleAutoDetectFailure: (type: 'transcription' | 'translation', reason: string) => void;
}

export const useAutoDetectFailure = (): AutoDetectFailureHookResult => {
  const handleAutoDetectFailure = useCallback(async (type: 'transcription' | 'translation', reason: string) => {
    logger.error('AutoDetectFailure', `Auto ${type} detect failure - ${reason}`, {
      type,
      reason,
      timestamp: new Date().toISOString()
    });

    if (window.electronAPI?.handleAutoDetectFailure) {
      await window.electronAPI.handleAutoDetectFailure(type, reason);
    }
  }, []);

  return {
    handleAutoDetectFailure
  };
};