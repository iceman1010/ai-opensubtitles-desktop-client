export interface TranscriptionOptions {
  language: string;
  api: string;
  returnContent?: boolean;
}

export interface TranslationOptions {
  translateFrom: string;
  translateTo: string;
  api: string;
  returnContent?: boolean;
}

export interface APIResponse<T = any> {
  correlation_id?: string;
  status: 'CREATED' | 'PENDING' | 'COMPLETED' | 'ERROR' | 'TIMEOUT';
  data?: T;
  errors?: string[];
  translation?: string;
}

export interface LanguageInfo {
  language_code: string;
  language_name: string;
}

export interface TranscriptionInfo {
  apis: string[];
  languages: LanguageInfo[] | { [apiName: string]: LanguageInfo[] };
}

export interface TranslationInfo {
  apis: string[];
  languages: { [apiName: string]: LanguageInfo[] };
}

export interface ServiceModel {
  name: string;
  display_name: string;
  description: string;
  pricing: string;
  reliability: string;
  price: number;
  languages_supported: LanguageInfo[];
}

export interface ServicesInfo {
  Translation: ServiceModel[];
  Transcription: ServiceModel[];
}

export interface CreditPackage {
  name: string;
  value: string;
  discount_percent: number;
  checkout_url: string;
}

export interface SubtitleSearchParams {
  query?: string;
  imdb_id?: string;
  tmdb_id?: string;
  parent_imdb_id?: string;
  parent_tmdb_id?: string;
  moviehash?: string;
  languages?: string;
  episode_number?: number;
  season_number?: number;
  year?: number;
  type?: string;
  page?: number;
  order_by?: string;
  order_direction?: string;
  ai_translated?: boolean;
  foreign_parts_only?: boolean;
  hearing_impaired?: boolean;
  machine_translated?: boolean;
  trusted_sources?: boolean;
  user_id?: string;
  parent_feature_id?: string;
}

export interface SubtitleDownloadParams {
  file_id: number;
  sub_format?: string;
  file_name?: string;
  in_fps?: number;
  out_fps?: number;
  timeshift?: number;
  force_download?: boolean;
}

export interface SubtitleLanguage {
  language_code: string;
  language_name: string;
}

export interface SubtitleLanguagesResponse {
  data: SubtitleLanguage[];
}

export interface FeatureSearchParams {
  feature_id?: number;
  full_search?: boolean;
  imdb_id?: string;
  query?: string;
  query_match?: 'start' | 'word' | 'exact';
  tmdb_id?: string;
  type?: 'movie' | 'tvshow' | 'episode';
  year?: number;
}

export interface FeatureAttributes {
  title?: string;
  original_title?: string;
  year?: number | string;
  kind?: string;
  imdb_id?: number;
  tmdb_id?: number;
  feature_id?: number | string;
  episode_number?: number;
  season_number?: number;
  parent_title?: string;
  parent_imdb_id?: number;
  parent_tmdb_id?: number;
  parent_feature_id?: number;
  subtitles_count?: number;
  seasons_count?: number;
  subtitles_counts?: {
    [languageCode: string]: number;
  };
  ai_subtitles_counts?: {
    [languageCode: string]: number;
  };
  title_aka?: string[];
  feature_type?: string;
  url?: string;
  img_url?: string;
  seasons?: Array<{
    season_number: number;
    episodes: Array<{
      episode_number: number;
      title: string;
      feature_id: number;
      feature_imdb_id: number;
      slug: string;
    }>;
  }>;
}

export interface Feature {
  id: string;
  type: string;
  attributes: FeatureAttributes;
}

export interface FeatureSearchResponse {
  data: Feature[];
  total_count?: number;
  total_pages?: number;
  page?: number;
  per_page?: number;
}

export interface CompletedTaskData {
  file_name: string;
  url: string;
  character_count: number;
  unit_price: number;
  total_price: number;
  credits_left: number;
  task: {
    login: string;
    loginid: string;
    id: string;
    api: string;
    language: string;
    translation?: string;
    start_time: number;
  };
  complete: number;
}

export interface DetectedLanguage {
  W3C: string;
  name: string;
  native: string;
  ISO_639_1: string;
  ISO_639_2b: string;
}

export interface LanguageDetectionResult {
  format?: string;
  type: 'text' | 'audio';
  language?: DetectedLanguage;
  duration?: number;
  media?: string;
}

export interface RecentMediaItem {
  id: number;
  time: number;
  time_str: string;
  files?: string[];
}

export interface RecentActivityItem {
  id: number;
  type: number;
  type_name: string;
  credits: number;
  time: number;
  time_str: string;
}

export interface PaymentHistoryItem {
  time: number;
  credits: number;
  reference: string | null;
  orderid: string | null;
  date: string;
  usd: string;
}

export interface ApiState {
  apiKey: string;
  token: string;
  baseURL: string;
  apiUrlParameter: string;
  username: string;
  password: string;
}
