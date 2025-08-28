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
    return consolidatedLanguages.map(lang => {
      const compatibleApis = compatibilityMatrix[lang.id] || [];
      const isCompatibleWithCurrentModel = options.model ? compatibleApis.includes(options.model) : true;
      
      // Don't show the same language in both dropdowns
      const isSameAsOtherSelection = excludeLanguage === lang.id;

      let tooltip = '';
      if (!isCompatibleWithCurrentModel && compatibleApis.length > 0) {
        tooltip = `Available in: ${compatibleApis.map(api => api.toUpperCase()).join(', ')}`;
      }

      return {
        id: lang.id,
        label: lang.displayName,
        compatible: isCompatibleWithCurrentModel && !isSameAsOtherSelection,
        tooltip: tooltip || undefined
      };
    });
  };

  // Get current consolidated language for source and destination
  const currentSourceConsolidated = useMemo(() => {
    if (options.sourceLanguage === 'auto') {
      return consolidatedLanguages.find(lang => lang.id === 'auto-detect');
    }
    return getConsolidatedLanguageByCode(consolidatedLanguages, options.sourceLanguage);
  }, [consolidatedLanguages, options.sourceLanguage]);

  const currentDestConsolidated = useMemo(() => {
    return getConsolidatedLanguageByCode(consolidatedLanguages, options.destinationLanguage);
  }, [consolidatedLanguages, options.destinationLanguage]);

  // Handle language selection
  const handleLanguageSelection = (field: 'sourceLanguage' | 'destinationLanguage', consolidatedId: string) => {
    const consolidatedLang = getConsolidatedLanguageById(consolidatedLanguages, consolidatedId);
    if (!consolidatedLang) return;

    // Special handling for auto-detect
    if (consolidatedId === 'auto-detect') {
      onLanguageChange(field, 'auto');
      return;
    }

    // Get the best variant code for the current model
    const bestVariant = getBestVariantForApi(consolidatedLang, options.model);
    if (bestVariant) {
      onLanguageChange(field, bestVariant);
    }
  };

  // Handle incompatible language click - switch to compatible model
  const handleIncompatibleLanguageClick = (consolidatedId: string) => {
    const compatibleApis = compatibilityMatrix[consolidatedId] || [];
    if (compatibleApis.length > 0) {
      // Switch to the first compatible model
      onModelChange(compatibleApis[0]);
      
      // Then select the language
      setTimeout(() => {
        handleLanguageSelection('destinationLanguage', consolidatedId);
      }, 100);
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
          onIncompatibleClick={(value) => {
            // For source language, also switch model if needed
            const compatibleApis = compatibilityMatrix[value] || [];
            if (compatibleApis.length > 0) {
              onModelChange(compatibleApis[0]);
              setTimeout(() => {
                handleLanguageSelection('sourceLanguage', value);
              }, 100);
            }
          }}
          disabled={disabled}
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
          onIncompatibleClick={handleIncompatibleLanguageClick}
          disabled={disabled}
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