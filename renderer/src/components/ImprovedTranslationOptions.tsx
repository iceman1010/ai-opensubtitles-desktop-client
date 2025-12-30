import React, { useMemo } from 'react';
import { TranslationInfo } from '../services/api';
import SmartSelect, { SmartSelectOption } from './SmartSelect';
import {
  consolidateLanguages,
  buildCompatibilityMatrix,
  getBestVariantForApi,
  getConsolidatedLanguageById,
  getConsolidatedLanguageByCode,
  ConsolidatedLanguage
} from '../utils/languageMapper';
import * as fileFormatsConfig from '../../../shared/fileFormats.json';
import { logger } from '../utils/errorLogger';

interface ImprovedTranslationOptionsProps {
  options: {
    sourceLanguage: string;
    destinationLanguage: string;
    model: string;
    format: string;
  };
  translationInfo: TranslationInfo | null;
  onModelChange: (model: string) => void;
  onLanguageChange: (field: 'sourceLanguage' | 'destinationLanguage', language: string) => void;
  onFormatChange: (format: string) => void;
  disabled?: boolean;
}

const ImprovedTranslationOptions: React.FC<ImprovedTranslationOptionsProps> = ({
  options,
  translationInfo,
  onModelChange,
  onLanguageChange,
  onFormatChange,
  disabled = false
}) => {
  // Process and consolidate languages
  const { consolidatedLanguages, compatibilityMatrix } = useMemo(() => {
    if (!translationInfo) {
      return { consolidatedLanguages: [], compatibilityMatrix: {} };
    }

    const consolidated = consolidateLanguages(translationInfo.languages);
    const compatibility = buildCompatibilityMatrix(
      translationInfo.languages,
      translationInfo.apis
    );

    return {
      consolidatedLanguages: consolidated,
      compatibilityMatrix: compatibility
    };
  }, [translationInfo]);

  // Track if language data is ready for current model
  const isLanguageDataReady = useMemo(() => {
    if (!translationInfo || !options.model) return false;

    // Check if at least one language has variants for the current model
    return consolidatedLanguages.some(lang =>
      lang.variants.some(v => v.api === options.model)
    );
  }, [consolidatedLanguages, options.model, translationInfo]);

  // Build model options
  const modelOptions: SmartSelectOption[] = useMemo(() => {
    if (!translationInfo) return [];

    return translationInfo.apis.map(api => ({
      id: api,
      label: api.toUpperCase(),
      compatible: true // All models are always compatible for model selection
    }));
  }, [translationInfo]);

  // Build language options based on current selections
  const buildLanguageOptions = (excludeLanguage?: string): SmartSelectOption[] => {
    return consolidatedLanguages
      .filter(lang => {
        const compatibleApis = compatibilityMatrix[lang.id] || [];
        const isCompatibleWithCurrentModel = options.model ? compatibleApis.includes(options.model) : true;
        const isSameAsOtherSelection = excludeLanguage === lang.id;

        // Only include compatible languages that aren't selected in the other dropdown
        return isCompatibleWithCurrentModel && !isSameAsOtherSelection;
      })
      .map(lang => ({
        id: lang.id,
        label: lang.displayName,
        compatible: true // All returned languages are compatible
      }));
  };

  // Get current consolidated language for source and destination
  const currentSourceConsolidated = useMemo(() => {
    logger.debug(2, 'ImprovedTranslationOptions', 'Calculating currentSourceConsolidated', {
      sourceLanguage: options.sourceLanguage,
      consolidatedLanguagesCount: consolidatedLanguages.length
    });

    if (options.sourceLanguage === 'auto') {
      const autoDetect = consolidatedLanguages.find(lang => lang.id === 'auto-detect');
      logger.debug(2, 'ImprovedTranslationOptions', 'Auto-detect found', autoDetect);
      return autoDetect;
    }

    const found = getConsolidatedLanguageByCode(consolidatedLanguages, options.sourceLanguage);
    logger.debug(2, 'ImprovedTranslationOptions', 'getConsolidatedLanguageByCode result', {
      searchCode: options.sourceLanguage,
      found: found ? { id: found.id, name: found.name, primaryCode: found.primaryCode } : null
    });

    return found;
  }, [consolidatedLanguages, options.sourceLanguage]);

  const currentDestConsolidated = useMemo(() => {
    return getConsolidatedLanguageByCode(consolidatedLanguages, options.destinationLanguage);
  }, [consolidatedLanguages, options.destinationLanguage]);

  // Handle language selection
  const handleLanguageSelection = (field: 'sourceLanguage' | 'destinationLanguage', consolidatedId: string) => {
    logger.debug(2, 'ImprovedTranslationOptions', 'handleLanguageSelection called', {
      field,
      consolidatedId,
      currentModel: options.model,
      currentOptions: options
    });

    // Guard against race condition - wait for language data to be ready
    if (!isLanguageDataReady && consolidatedId !== 'auto-detect') {
      logger.warn('ImprovedTranslationOptions', 'Language data not ready yet, deferring selection');
      return;
    }

    const consolidatedLang = getConsolidatedLanguageById(consolidatedLanguages, consolidatedId);
    if (!consolidatedLang) {
      logger.error('ImprovedTranslationOptions', `No consolidated language found for ID: ${consolidatedId}`);
      return;
    }

    logger.debug(2, 'ImprovedTranslationOptions', 'Found consolidated language', {
      name: consolidatedLang.name,
      primaryCode: consolidatedLang.primaryCode,
      variants: consolidatedLang.variants
    });

    // Special handling for auto-detect
    if (consolidatedId === 'auto-detect') {
      logger.debug(2, 'ImprovedTranslationOptions', `Setting auto-detect for ${field}`);
      onLanguageChange(field, 'auto');
      return;
    }

    // Get the best variant code for the current model
    const bestVariant = getBestVariantForApi(consolidatedLang, options.model);
    logger.debug(2, 'ImprovedTranslationOptions', 'getBestVariantForApi result', {
      model: options.model,
      bestVariant,
      allVariants: consolidatedLang.variants,
      availableVariantsForModel: consolidatedLang.variants.filter(v => v.api === options.model)
    });

    if (bestVariant) {
      logger.debug(2, 'ImprovedTranslationOptions', 'Calling onLanguageChange with', { field, bestVariant });
      onLanguageChange(field, bestVariant);
    } else {
      // This should never happen since we only show compatible languages
      logger.error('ImprovedTranslationOptions', `No variant found for compatible language ${consolidatedId}`, {
        consolidatedLang,
        model: options.model
      });
      // Don't call onLanguageChange - abort the selection
      return;
    }
  };

  return (
    <div className="options-container">
      <h3>Translation Options</h3>
      
      <div className="form-group">
        <label htmlFor="translation-model">Model:</label>
        <SmartSelect
          id="translation-model"
          value={options.model}
          options={modelOptions}
          onChange={onModelChange}
          disabled={disabled}
          placeholder="Select AI Model"
        />
      </div>

      <div className="form-group">
        <label htmlFor="source-language">Source Language:</label>
        <SmartSelect
          id="source-language"
          value={currentSourceConsolidated?.id || ''}
          options={buildLanguageOptions(currentDestConsolidated?.id)}
          onChange={(value) => handleLanguageSelection('sourceLanguage', value)}
          disabled={disabled || !isLanguageDataReady}
          placeholder="Select Source Language"
        />
      </div>

      <div className="form-group">
        <label htmlFor="destination-language">Destination Language:</label>
        <SmartSelect
          id="destination-language"
          value={currentDestConsolidated?.id || ''}
          options={buildLanguageOptions(currentSourceConsolidated?.id)}
          onChange={(value) => handleLanguageSelection('destinationLanguage', value)}
          disabled={disabled || !isLanguageDataReady}
          placeholder="Select Destination Language"
        />
      </div>

      <div className="form-group">
        <label htmlFor="translation-format">Export Format:</label>
        <select
          id="translation-format"
          value={options.format}
          onChange={(e) => onFormatChange(e.target.value)}
          disabled={disabled}
        >
          {fileFormatsConfig.subtitle.map(format => (
            <option key={format} value={format}>
              {format.toUpperCase()}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default ImprovedTranslationOptions;