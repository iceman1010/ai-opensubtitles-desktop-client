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
    border: '1px solid var(--input-border)',
    borderRadius: 4,
    backgroundColor: 'var(--input-bg)',
    fontSize: 14,
    color: 'var(--text-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    WebkitAppearance: 'none',
    appearance: 'none'
  };

  const disabledSelectStyles: React.CSSProperties = {
    ...selectStyles,
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-muted)'
  };

  return (
    <div style={containerStyles}>
      <style>{`
        .smart-select:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.15);
        }
        
        .smart-select:hover:not(:disabled) {
          border-color: var(--primary-color);
        }
        
        .smart-select option[disabled] {
          background-color: var(--bg-tertiary) !important;
          color: var(--text-muted) !important;
          font-style: normal !important;

        }

        .smart-select option.smart-select-separator {
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
          <option disabled className="smart-select-separator" style={{ backgroundColor: '#f0f0f0', color: '#666' }}>
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
            {option.label} {option.tooltip ? `(${option.tooltip})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
};

export default SmartSelect;