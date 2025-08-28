import React from 'react';

export interface SmartSelectOption {
  id: string;
  label: string;
  compatible: boolean;
  tooltip?: string;
}

interface SmartSelectProps {
  value: string;
  options: SmartSelectOption[];
  onChange: (value: string) => void;
  onIncompatibleClick?: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}

const SmartSelect: React.FC<SmartSelectProps> = ({
  value,
  options,
  onChange,
  onIncompatibleClick,
  disabled = false,
  placeholder = "Select option",
  id
}) => {
  const compatibleOptions = options.filter(opt => opt.compatible);
  const incompatibleOptions = options.filter(opt => !opt.compatible);
  const selectedOption = options.find(opt => opt.id === value);

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedValue = e.target.value;
    const option = options.find(opt => opt.id === selectedValue);
    
    if (!option) return;
    
    if (option.compatible) {
      onChange(selectedValue);
    } else if (onIncompatibleClick) {
      onIncompatibleClick(selectedValue);
    }
  };

  return (
    <div className="smart-select-container">
      <select
        id={id}
        value={value}
        onChange={handleSelectChange}
        disabled={disabled}
        className="smart-select"
      >
        {!selectedOption && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        
        {/* Compatible options */}
        {compatibleOptions.map(option => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
        
        {/* Separator */}
        {incompatibleOptions.length > 0 && compatibleOptions.length > 0 && (
          <option disabled style={{ backgroundColor: '#f0f0f0', color: '#666' }}>
            ────────────────────
          </option>
        )}
        
        {/* Incompatible options */}
        {incompatibleOptions.map(option => (
          <option 
            key={option.id} 
            value={option.id}
            style={{ 
              color: '#999', 
              fontStyle: 'italic',
              backgroundColor: '#f8f8f8'
            }}
            title={option.tooltip}
          >
            ○ {option.label} {option.tooltip ? `(${option.tooltip})` : ''}
          </option>
        ))}
      </select>
      
      <style jsx>{`
        .smart-select-container {
          position: relative;
        }
        
        .smart-select {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          background-color: white;
          font-size: 14px;
          color: #333;
          cursor: pointer;
        }
        
        .smart-select:disabled {
          background-color: #f5f5f5;
          color: #666;
          cursor: not-allowed;
        }
        
        .smart-select:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }
        
        .smart-select:hover:not(:disabled) {
          border-color: #007bff;
        }
        
        /* Ensure separator option is styled correctly */
        .smart-select option[disabled] {
          background-color: #f0f0f0 !important;
          color: #666 !important;
          font-style: normal !important;
          text-align: center !important;
        }
      `}</style>
    </div>
  );
};

export default SmartSelect;