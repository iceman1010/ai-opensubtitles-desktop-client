import { LanguageInfo } from '../services/api';

export interface ConsolidatedLanguage {
  id: string; // Unique identifier like 'german', 'english'
  displayName: string; // User-friendly name like 'German', 'English'
  variants: LanguageVariant[];
}

export interface LanguageVariant {
  code: string; // Original language code like 'de', 'de-DE'
  name: string; // Original name from API
  api: string; // Which API this variant comes from
}

export interface ModelLanguageCompatibility {
  [modelId: string]: string[]; // modelId -> array of language codes it supports
}

/**
 * Maps language codes to their base language
 * Only groups codes that represent the same language (same ISO 639-1 base)
 */
const LANGUAGE_CONSOLIDATION_MAP: { [code: string]: string } = {
  // German variants
  'de': 'german',
  'de-DE': 'german',
  'de-CH': 'german-ch', // Keep Swiss German separate
  
  // English variants  
  'en': 'english',
  'en-US': 'english',
  'en-GB': 'english', 
  'en-AU': 'english',
  'en-IE': 'english',
  'en-NZ': 'english',
  'en-ZA': 'english',
  'en-IN': 'english',
  'en-AB': 'english',
  'en-WL': 'english',
  'en_us': 'english',
  'en_uk': 'english',
  'en_au': 'english',
  
  // French variants
  'fr': 'french',
  'fr-FR': 'french',
  'fr-CA': 'french-ca', // Keep Canadian French separate
  
  // Spanish variants
  'es': 'spanish',
  'es-ES': 'spanish',
  'es-US': 'spanish',
  'es-MX': 'spanish-mx', // Keep Mexican Spanish separate
  'es-419': 'spanish-419', // Keep Latin American Spanish separate
  
  // Portuguese variants
  'pt': 'portuguese',
  'pt-PT': 'portuguese',
  'pt-BR': 'portuguese-br', // Keep Brazilian Portuguese separate
  
  // Chinese variants (keep separate - different writing systems)
  'zh': 'chinese-simplified',
  'zh-CN': 'chinese-simplified',
  'zh-TW': 'chinese-traditional',
  'zh-HK': 'chinese-traditional',
  
  // Arabic variants
  'ar': 'arabic',
  'ar-AE': 'arabic',
  'ar-SA': 'arabic',
  
  // Italian variants
  'it': 'italian',
  'it-IT': 'italian',
  
  // Dutch variants
  'nl': 'dutch',
  'nl-NL': 'dutch',
  
  // Russian variants
  'ru': 'russian',
  'ru-RU': 'russian',
  
  // Japanese variants
  'ja': 'japanese',
  'ja-JP': 'japanese',
  
  // Korean variants
  'ko': 'korean',
  'ko-KR': 'korean',
  
  // Norwegian variants
  'no': 'norwegian',
  'no-NO': 'norwegian',
  'nb-NO': 'norwegian',
  'nn': 'norwegian',
  
  // Other languages (add more as needed)
  'auto': 'auto-detect'
};

/**
 * Display names for consolidated languages
 */
const CONSOLIDATED_DISPLAY_NAMES: { [id: string]: string } = {
  'auto-detect': 'Auto-detect',
  'german': 'German',
  'german-ch': 'German (Switzerland)',
  'english': 'English',
  'french': 'French', 
  'french-ca': 'French (Canada)',
  'spanish': 'Spanish',
  'spanish-mx': 'Spanish (Mexico)',
  'spanish-419': 'Spanish (Latin America)',
  'portuguese': 'Portuguese',
  'portuguese-br': 'Portuguese (Brazil)',
  'chinese-simplified': 'Chinese (Simplified)',
  'chinese-traditional': 'Chinese (Traditional)',
  'arabic': 'Arabic',
  'italian': 'Italian',
  'dutch': 'Dutch',
  'russian': 'Russian',
  'japanese': 'Japanese',
  'korean': 'Korean',
  'norwegian': 'Norwegian'
};

/**
 * Consolidates language variants into grouped entries
 */
export function consolidateLanguages(
  languagesByApi: { [api: string]: LanguageInfo[] }
): ConsolidatedLanguage[] {
  const consolidatedMap = new Map<string, ConsolidatedLanguage>();
  
  // Process each API's languages
  Object.entries(languagesByApi).forEach(([api, languages]) => {
    languages.forEach(lang => {
      const consolidatedId = LANGUAGE_CONSOLIDATION_MAP[lang.language_code] || lang.language_code;
      
      if (!consolidatedMap.has(consolidatedId)) {
        consolidatedMap.set(consolidatedId, {
          id: consolidatedId,
          displayName: CONSOLIDATED_DISPLAY_NAMES[consolidatedId] || lang.language_name,
          variants: []
        });
      }
      
      const consolidated = consolidatedMap.get(consolidatedId)!;

      // Check if this exact variant (code + api combination) already exists
      const existingVariant = consolidated.variants.find(v => v.code === lang.language_code && v.api === api);
      if (!existingVariant) {
        consolidated.variants.push({
          code: lang.language_code,
          name: lang.language_name,
          api: api
        });
      }
    });
  });
  
  // Convert to array and sort
  return Array.from(consolidatedMap.values()).sort((a, b) => {
    // Auto-detect first
    if (a.id === 'auto-detect') return -1;
    if (b.id === 'auto-detect') return 1;
    
    // Then alphabetical
    return a.displayName.localeCompare(b.displayName);
  });
}

/**
 * Builds compatibility matrix: which models support which consolidated languages
 */
export function buildCompatibilityMatrix(
  languagesByApi: { [api: string]: LanguageInfo[] },
  availableApis: string[]
): { [consolidatedId: string]: string[] } {
  const compatibility: { [consolidatedId: string]: string[] } = {};
  
  // For each API, map its languages to consolidated IDs
  availableApis.forEach(api => {
    const languages = languagesByApi[api] || [];
    
    languages.forEach(lang => {
      const consolidatedId = LANGUAGE_CONSOLIDATION_MAP[lang.language_code] || lang.language_code;
      
      if (!compatibility[consolidatedId]) {
        compatibility[consolidatedId] = [];
      }
      
      if (!compatibility[consolidatedId].includes(api)) {
        compatibility[consolidatedId].push(api);
      }
    });
  });
  
  return compatibility;
}

/**
 * Gets the best variant code for a consolidated language and specific API
 */
export function getBestVariantForApi(
  consolidatedLanguage: ConsolidatedLanguage,
  api: string
): string | null {
  const apiVariants = consolidatedLanguage.variants.filter(v => v.api === api);
  
  if (apiVariants.length === 0) {
    return null;
  }
  
  // Prefer simple codes over region-specific ones
  const simpleVariant = apiVariants.find(v => !v.code.includes('-') && !v.code.includes('_'));
  if (simpleVariant) {
    return simpleVariant.code;
  }
  
  // Otherwise return the first available variant
  return apiVariants[0].code;
}

/**
 * Gets consolidated language by ID
 */
export function getConsolidatedLanguageById(
  consolidatedLanguages: ConsolidatedLanguage[],
  id: string
): ConsolidatedLanguage | undefined {
  return consolidatedLanguages.find(lang => lang.id === id);
}

/**
 * Gets consolidated language by any variant code
 */
export function getConsolidatedLanguageByCode(
  consolidatedLanguages: ConsolidatedLanguage[],
  code: string
): ConsolidatedLanguage | undefined {
  return consolidatedLanguages.find(lang => 
    lang.variants.some(variant => variant.code === code)
  );
}