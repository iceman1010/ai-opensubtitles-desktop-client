import React, { useMemo } from 'react';
import { TranscriptionInfo } from '../services/api';
import SmartSelect, { SmartSelectOption } from './SmartSelect';
import { 
  consolidateLanguages, 
  buildCompatibilityMatrix, 
  getBestVariantForApi,
  getConsolidatedLanguageById,
  getConsolidatedLanguageByCode
} from '../utils/languageMapper';
import * as fileFormatsConfig from '../../../shared/fileFormats.json';

interface ImprovedTranscriptionOptionsProps {
  options: {
    language: string;
    model: string;
    format: string;
  };
  setOptions: React.Dispatch<React.SetStateAction<{
    language: string;
    model: string;
    format: string;
  }>>;
  transcriptionInfo: TranscriptionInfo | null;
  disabled?: boolean;
}

const ImprovedTranscriptionOptions: React.FC<ImprovedTranscriptionOptionsProps> = ({
  options,
  setOptions,
  transcriptionInfo,
  disabled = false
}) => {
  // Process and consolidate languages
  const { consolidatedLanguages, compatibilityMatrix } = useMemo(() => {
    if (!transcriptionInfo) {
      return { consolidatedLanguages: [], compatibilityMatrix: {} };
    }

    // Handle both possible language structures
    let languagesByApi: { [api: string]: any[] } = {};
    
    if (Array.isArray(transcriptionInfo.languages)) {
      // Direct array - assume all APIs support all languages
      transcriptionInfo.apis.forEach(api => {
        languagesByApi[api] = transcriptionInfo.languages as any[];
      });
    } else if (typeof transcriptionInfo.languages === 'object') {
      // Grouped by API
      languagesByApi = transcriptionInfo.languages;
    }

    const consolidated = consolidateLanguages(languagesByApi);
    const compatibility = buildCompatibilityMatrix(
      languagesByApi, 
      transcriptionInfo.apis
    );

    return { 
      consolidatedLanguages: consolidated, 
      compatibilityMatrix: compatibility 
    };
  }, [transcriptionInfo]);

  // Build model options
  const modelOptions: SmartSelectOption[] = useMemo(() => {
    if (!transcriptionInfo) return [];

    return transcriptionInfo.apis.map(api => ({
      id: api,
      label: api.toUpperCase(),
      compatible: true // All models are always compatible for model selection
    }));
  }, [transcriptionInfo]);

  // Build language options based on current model selection
  const languageOptions: SmartSelectOption[] = useMemo(() => {
    return consolidatedLanguages.map(lang => {
      const compatibleApis = compatibilityMatrix[lang.id] || [];
      const isCompatibleWithCurrentModel = options.model ? compatibleApis.includes(options.model) : true;

      let tooltip = '';
      if (!isCompatibleWithCurrentModel && compatibleApis.length > 0) {
        tooltip = `Available in: ${compatibleApis.map(api => api.toUpperCase()).join(', ')}`;
      }

      return {
        id: lang.id,
        label: lang.displayName,
        compatible: isCompatibleWithCurrentModel,
        tooltip: tooltip || undefined
      };
    });
  }, [consolidatedLanguages, compatibilityMatrix, options.model]);

  // Get current consolidated language
  const currentConsolidated = useMemo(() => {
    if (options.language === 'auto') {
      return consolidatedLanguages.find(lang => lang.id === 'auto-detect');
    }
    return getConsolidatedLanguageByCode(consolidatedLanguages, options.language);
  }, [consolidatedLanguages, options.language]);

  // Handle model change
  const handleModelChange = (newModel: string) => {
    setOptions(prev => ({ ...prev, model: newModel }));
    
    // If current language is not compatible with new model, switch to auto-detect
    if (currentConsolidated) {
      const compatibleApis = compatibilityMatrix[currentConsolidated.id] || [];
      if (!compatibleApis.includes(newModel)) {
        setOptions(prev => ({ ...prev, language: 'auto' }));
      }
    }
  };

  // Handle language selection
  const handleLanguageSelection = (consolidatedId: string) => {
    const consolidatedLang = getConsolidatedLanguageById(consolidatedLanguages, consolidatedId);
    if (!consolidatedLang) return;

    // Special handling for auto-detect
    if (consolidatedId === 'auto-detect') {
      setOptions(prev => ({ ...prev, language: 'auto' }));
      return;
    }

    // Get the best variant code for the current model
    const bestVariant = getBestVariantForApi(consolidatedLang, options.model);
    if (bestVariant) {
      setOptions(prev => ({ ...prev, language: bestVariant }));
    }
  };

  // Handle incompatible language click - switch to compatible model
  const handleIncompatibleLanguageClick = (consolidatedId: string) => {
    const compatibleApis = compatibilityMatrix[consolidatedId] || [];
    if (compatibleApis.length > 0) {
      // Switch to the first compatible model
      const newModel = compatibleApis[0];
      setOptions(prev => ({ ...prev, model: newModel }));
      
      // Then select the language
      setTimeout(() => {
        handleLanguageSelection(consolidatedId);
      }, 100);
    }
  };

  return (
    <div className="options-container">
      <h3>Transcription Options</h3>
      
      <div className="form-group">
        <label htmlFor="transcription-model">Model:</label>
        <SmartSelect
          id="transcription-model"
          value={options.model}
          options={modelOptions}
          onChange={handleModelChange}
          disabled={disabled}
          placeholder="Select AI Model"
        />
      </div>

      <div className="form-group">
        <label htmlFor="transcription-language">Source Language:</label>
        <SmartSelect
          id="transcription-language"
          value={currentConsolidated?.id || ''}
          options={languageOptions}
          onChange={handleLanguageSelection}
          onIncompatibleClick={handleIncompatibleLanguageClick}
          disabled={disabled}
          placeholder="Select Language"
        />
      </div>

      <div className="form-group">
        <label htmlFor="transcription-format">Export Format:</label>
        <select
          id="transcription-format"
          value={options.format}
          onChange={(e) => setOptions(prev => ({ ...prev, format: e.target.value }))}
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

export default ImprovedTranscriptionOptions;