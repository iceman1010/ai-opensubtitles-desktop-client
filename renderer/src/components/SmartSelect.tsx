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

  const containerStyles: React.CSSProperties = {
    position: 'relative'
  };

  const selectStyles: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #ddd',
    borderRadius: 4,
    backgroundColor: 'white',
    fontSize: 14,
    color: '#333',
    cursor: disabled ? 'not-allowed' : 'pointer'
  };

  const disabledSelectStyles: React.CSSProperties = {
    ...selectStyles,
    backgroundColor: '#f5f5f5',
    color: '#666'
  };

  return (
    <div style={containerStyles}>
      <style>{`
        .smart-select:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }
        
        .smart-select:hover:not(:disabled) {
          border-color: #007bff;
        }
        
        .smart-select option[disabled] {
          background-color: #f0f0f0 !important;
          color: #666 !important;
          font-style: normal !important;
          text-align: center !important;
        }
      `}</style>
      
      <select
        id={id}
        value={value}
        onChange={handleSelectChange}
        disabled={disabled}
        className="smart-select"
        style={disabled ? disabledSelectStyles : selectStyles}
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
    </div>
  );
};

export default SmartSelect;