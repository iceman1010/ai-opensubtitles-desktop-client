/**
 * Single source of truth for the persisted application config.
 * Shared between the Electron main process (main/config.ts ConfigManager)
 * and the renderer (components receive it via props and window.electronAPI).
 */
export interface AppConfig {
  username: string;
  password: string;
  apiKey?: string;
  lastUsedLanguage?: string;
  debugMode?: boolean;
  debugLevel?: number;
  checkUpdatesOnStart?: boolean;
  autoRemoveCompletedFiles?: boolean;
  cacheExpirationHours?: number;
  betaTest?: boolean;
  ffmpegPath?: string;
  apiBaseUrl?: string;
  apiUrlParameter?: string;
  userId?: number;
  supportEmail?: string;
  autoLanguageDetection?: boolean;
  audio_language_detection_time?: number;
  pollingIntervalSeconds?: number;
  pollingTimeoutSeconds?: number;
  defaultFilenameFormat?: string;
  apiConnectivityTestIntervalMinutes?: number;
  persistDownloadQueue?: boolean;
  hideRecentMediaInfoPanel?: boolean;
  darkMode?: boolean;
  preferredTranslationModel?: string;
  preferredTranslationLanguage?: string;
  preferredTranscriptionEngine?: string;
  credits?: {
    used: number;
    remaining: number;
  };
}
