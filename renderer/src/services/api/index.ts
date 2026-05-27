import CacheManager from '../cache';
import * as auth from './auth';
import * as transcription from './transcription';
import * as translation from './translation';
import * as languageDetection from './languageDetection';
import * as subtitles from './subtitles';
import * as credits from './credits';
import * as files from './files';
import * as support from './support';
import {
  TranscriptionOptions,
  TranslationOptions,
  APIResponse,
  LanguageInfo,
  TranscriptionInfo,
  TranslationInfo,
  ServiceModel,
  ServicesInfo,
  CreditPackage,
  SubtitleSearchParams,
  SubtitleDownloadParams,
  SubtitleLanguage,
  SubtitleLanguagesResponse,
  FeatureSearchParams,
  FeatureAttributes,
  Feature,
  FeatureSearchResponse,
  CompletedTaskData,
  DetectedLanguage,
  LanguageDetectionResult,
  RecentMediaItem,
  RecentActivityItem,
  PaymentHistoryItem,
  ApiState,
} from './types';

export type {
  TranscriptionOptions,
  TranslationOptions,
  APIResponse,
  LanguageInfo,
  TranscriptionInfo,
  TranslationInfo,
  ServiceModel,
  ServicesInfo,
  CreditPackage,
  SubtitleSearchParams,
  SubtitleDownloadParams,
  SubtitleLanguage,
  SubtitleLanguagesResponse,
  FeatureSearchParams,
  FeatureAttributes,
  Feature,
  FeatureSearchResponse,
  CompletedTaskData,
  DetectedLanguage,
  LanguageDetectionResult,
  RecentMediaItem,
  RecentActivityItem,
  PaymentHistoryItem,
};

export class OpenSubtitlesAPI {
  private state: ApiState = {
    apiKey: '',
    token: '',
    baseURL: 'https://api.opensubtitles.com/api/v1',
    apiUrlParameter: '',
    username: '',
    password: '',
  };

  public get apiKey(): string {
    return this.state.apiKey;
  }

  private tokenRefreshPromiseHolder = { promise: null as Promise<boolean> | null };

  constructor(apiKey?: string, baseUrl?: string, apiUrlParameter?: string) {
    console.trace('[API] NEW OpenSubtitlesAPI instance created');
    if (apiKey) {
      this.setApiKey(apiKey);
    }
    if (baseUrl) {
      this.setBaseUrl(baseUrl);
    }
    if (apiUrlParameter) {
      this.setApiUrlParameter(apiUrlParameter);
    }
  }

  setBaseUrl(baseUrl: string): void {
    this.state.baseURL = baseUrl;
  }

  setApiUrlParameter(apiUrlParameter: string): void {
    this.state.apiUrlParameter = apiUrlParameter;
  }

  private getAIUrl(endpoint: string): string {
    const baseUrl = `${this.state.baseURL}/ai${endpoint}`;
    return this.state.apiUrlParameter ? `${baseUrl}${this.state.apiUrlParameter}` : baseUrl;
  }

  private getLoginUrl(endpoint: string): string {
    const baseUrl = `${this.state.baseURL}${endpoint}`;
    return this.state.apiUrlParameter ? `${baseUrl}${this.state.apiUrlParameter}` : baseUrl;
  }

  setApiKey(apiKey: string): void {
    this.state.apiKey = apiKey;
  }

  async loadCachedToken(): Promise<boolean> {
    return auth.loadCachedToken(this.state);
  }

  private async saveToken(token: string): Promise<void> {
    return auth.saveToken(token);
  }

  async clearCachedToken(): Promise<void> {
    return auth.clearCachedToken(this.state);
  }

  setCredentials(username: string, password: string): void {
    this.state.username = username;
    this.state.password = password;
  }

  async refreshToken(): Promise<boolean> {
    return auth.refreshToken(this.state, this.tokenRefreshPromiseHolder, async (u, p) => {
      this.state.username = u;
      this.state.password = p;
      return auth.login(this.state, this.getAIUrl.bind(this), this.getLoginUrl.bind(this));
    });
  }

  async login(username: string, password: string): Promise<{ success: boolean; token?: string; user_id?: number; error?: string }> {
    this.state.username = username;
    this.state.password = password;
    return auth.login(this.state, this.getAIUrl.bind(this), this.getLoginUrl.bind(this));
  }

  async getTranscriptionInfo(): Promise<{ success: boolean; data?: TranscriptionInfo; error?: string }> {
    return transcription.getTranscriptionInfo(this.state, this.getAIUrl.bind(this));
  }

  async initiateTranscription(
    audioFile: File | string,
    options: TranscriptionOptions,
  ): Promise<APIResponse> {
    return transcription.initiateTranscription(this.state, this.getAIUrl.bind(this), audioFile, options);
  }

  async checkTranscriptionStatus(correlationId: string): Promise<APIResponse<CompletedTaskData>> {
    return transcription.checkTranscriptionStatus(this.state, this.getAIUrl.bind(this), correlationId);
  }

  async getTranscriptionLanguagesForApi(apiId: string): Promise<{ success: boolean; data?: LanguageInfo[]; error?: string }> {
    return transcription.getTranscriptionLanguagesForApi(this.state, this.getAIUrl.bind(this), apiId);
  }

  async getTranslationInfo(): Promise<{ success: boolean; data?: TranslationInfo; error?: string }> {
    return translation.getTranslationInfo(this.state, this.getAIUrl.bind(this));
  }

  async initiateTranslation(
    subtitleFile: File | string,
    options: TranslationOptions,
  ): Promise<APIResponse> {
    return translation.initiateTranslation(this.state, this.getAIUrl.bind(this), subtitleFile, options);
  }

  async checkTranslationStatus(correlationId: string): Promise<APIResponse<CompletedTaskData>> {
    return translation.checkTranslationStatus(this.state, this.getAIUrl.bind(this), correlationId);
  }

  async getTranslationLanguagesForApi(apiId: string): Promise<{ success: boolean; data?: LanguageInfo[]; error?: string }> {
    return translation.getTranslationLanguagesForApi(this.state, this.getAIUrl.bind(this), apiId);
  }

  async getTranslationApisForLanguage(sourceLanguage: string, targetLanguage: string): Promise<{ success: boolean; data?: string[]; error?: string }> {
    return translation.getTranslationApisForLanguage(this.state, this.getAIUrl.bind(this), sourceLanguage, targetLanguage);
  }

  async detectLanguage(file: File | string, duration?: number): Promise<APIResponse<LanguageDetectionResult>> {
    return languageDetection.detectLanguage(this.state, this.getAIUrl.bind(this), file, duration);
  }

  async checkLanguageDetectionStatus(correlationId: string): Promise<APIResponse<LanguageDetectionResult>> {
    return languageDetection.checkLanguageDetectionStatus(this.state, this.getAIUrl.bind(this), correlationId);
  }

  async searchSubtitles(params: SubtitleSearchParams): Promise<{ success: boolean; data?: any; error?: string }> {
    return subtitles.searchSubtitles(this.state, this.getAIUrl.bind(this), params);
  }

  async searchForFeatures(params: FeatureSearchParams): Promise<{ success: boolean; data?: FeatureSearchResponse; error?: string }> {
    return subtitles.searchForFeatures(this.state, this.getAIUrl.bind(this), params);
  }

  async downloadSubtitle(params: SubtitleDownloadParams): Promise<{ success: boolean; data?: any; error?: string }> {
    return subtitles.downloadSubtitle(this.state, this.getAIUrl.bind(this), params);
  }

  async getSubtitleSearchLanguages(): Promise<{ success: boolean; data?: SubtitleLanguage[]; error?: string }> {
    return subtitles.getSubtitleSearchLanguages(this.state);
  }

  async getCredits(): Promise<{ success: boolean; credits?: number; error?: string }> {
    return credits.getCredits(this.state, this.getAIUrl.bind(this));
  }

  async getServicesInfo(): Promise<{ success: boolean; data?: ServicesInfo; error?: string }> {
    return credits.getServicesInfo(this.state, this.getAIUrl.bind(this));
  }

  async getCreditPackages(email?: string): Promise<{ success: boolean; data?: CreditPackage[]; error?: string }> {
    return credits.getCreditPackages(this.state, this.getAIUrl.bind(this), email);
  }

  async getRecentMedia(page: number = 1): Promise<{ success: boolean; data?: RecentMediaItem[]; error?: string }> {
    return credits.getRecentMedia(this.state, this.getAIUrl.bind(this), page);
  }

  async getRecentActivities(page: number = 1): Promise<{ success: boolean; data?: RecentActivityItem[]; error?: string }> {
    return credits.getRecentActivities(this.state, this.getAIUrl.bind(this), page);
  }

  async getPaymentHistory(page: number = 1): Promise<{ success: boolean; data?: PaymentHistoryItem[]; error?: string }> {
    return credits.getPaymentHistory(this.state, this.getAIUrl.bind(this), page);
  }

  async downloadFile(url: string): Promise<{ success: boolean; content?: string; error?: string }> {
    return files.downloadFile(this.state, url);
  }

  async downloadFileByMediaId(mediaId: string, fileName: string): Promise<{ success: boolean; content?: string; error?: string }> {
    return files.downloadFileByMediaId(this.state, this.getAIUrl.bind(this), mediaId, fileName);
  }

  async createSupportTicket(problem_description: string, email: string, name: string): Promise<{ success: boolean; ticket_id?: number; error?: string }> {
    return support.createSupportTicket(this.state, this.getAIUrl.bind(this), problem_description, email, name);
  }

  clearCache(): void {
    CacheManager.clear();
  }
}
