import React, { useState, useEffect } from 'react';
import networkConfigManager from '../utils/networkConfig';

interface NetworkSimulationPanelProps {
  isVisible?: boolean;
  onToggle?: () => void;
}

const NetworkSimulationPanel: React.FC<NetworkSimulationPanelProps> = ({ 
  isVisible = false, 
  onToggle 
}) => {
  const [simulationEnabled, setSimulationEnabled] = useState(false);
  const [stats, setStats] = useState(networkConfigManager.getSimulationStats());
  const [config, setConfig] = useState(networkConfigManager.getConfig());

  useEffect(() => {
    setSimulationEnabled(networkConfigManager.isSimulationEnabled());
    setStats(networkConfigManager.getSimulationStats());
    setConfig(networkConfigManager.getConfig());
  }, []);

  const toggleSimulation = () => {
    if (simulationEnabled) {
      networkConfigManager.disableSimulation();
    } else {
      networkConfigManager.enableSimulation();
    }
    setSimulationEnabled(!simulationEnabled);
    setStats(networkConfigManager.getSimulationStats());
  };

  const resetStats = () => {
    networkConfigManager.disableSimulation();
    networkConfigManager.enableSimulation();
    setStats(networkConfigManager.getSimulationStats());
  };

  if (!isVisible) {
    return (
      <button 
        onClick={onToggle}
        className="dev-panel-toggle"
        title="Open Network Simulation Panel"
      >
        🔧
        <style jsx>{`
          .dev-panel-toggle {
            position: fixed;
            bottom: 35px;
            right: 10px;
            width: 30px;
            height: 30px;
            border: 1px solid #ccc;
            border-radius: 50%;
            background: #f8f9fa;
            cursor: pointer;
            font-size: 14px;
            z-index: 999;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          
          .dev-panel-toggle:hover {
            background: #e9ecef;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          }
        `}</style>
      </button>
    );
  }

  return (
    <div className="dev-panel">
      <div className="dev-panel-header">
        <h3>Network Simulation</h3>
        <button onClick={onToggle} className="close-btn">×</button>
      </div>
      
      <div className="dev-panel-content">
        <div className="control-group">
          <label>
            <input 
              type="checkbox" 
              checked={simulationEnabled}
              onChange={toggleSimulation}
            />
            Enable Error Simulation
          </label>
        </div>
        
        {simulationEnabled && (
          <>
            <div className="stats-group">
              <h4>Current Stats</h4>
              <p>Consecutive Errors: {stats.consecutiveErrors}/{config.development.simulationSettings.consecutiveErrorLimit}</p>
              <p>Last Error Type: {stats.lastErrorType || 'None'}</p>
              <p>Global Probability: {(config.development.simulationSettings.globalProbability * 100).toFixed(1)}%</p>
              <button onClick={resetStats} className="reset-btn">Reset Stats</button>
            </div>
            
            <div className="error-types">
              <h4>Error Types & Probabilities</h4>
              {Object.entries(config.development.errorSimulation).map(([type, typeConfig]) => (
                <div key={type} className={`error-type ${typeConfig.enabled ? 'enabled' : 'disabled'}`}>
                  <span className="type-name">{type}</span>
                  <span className="probability">{(typeConfig.probability * 100).toFixed(1)}%</span>
                  <div className="status-indicator" title={typeConfig.enabled ? 'Enabled' : 'Disabled'}>
                    {typeConfig.enabled ? '●' : '○'}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="info-note">
              <p><strong>Note:</strong> Error simulation only works in development mode. Errors are automatically retried according to configuration.</p>
            </div>
          </>
        )}
      </div>
      
      <style jsx>{`
        .dev-panel {
          position: fixed;
          bottom: 35px;
          right: 10px;
          width: 320px;
          max-height: 500px;
          background: white;
          border: 1px solid #ddd;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          overflow-y: auto;
        }
        
        .dev-panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid #eee;
          background: #f8f9fa;
          border-radius: 8px 8px 0 0;
        }
        
        .dev-panel-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: #495057;
        }
        
        .close-btn {
          border: none;
          background: none;
          font-size: 18px;
          cursor: pointer;
          color: #6c757d;
          padding: 0;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .close-btn:hover {
          color: #495057;
        }
        
        .dev-panel-content {
          padding: 16px;
        }
        
        .control-group {
          margin-bottom: 16px;
        }
        
        .control-group label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
        }
        
        .stats-group {
          margin-bottom: 16px;
          padding: 12px;
          background: #f8f9fa;
          border-radius: 4px;
        }
        
        .stats-group h4 {
          margin: 0 0 8px 0;
          font-size: 12px;
          font-weight: 600;
          color: #495057;
        }
        
        .stats-group p {
          margin: 4px 0;
          font-size: 11px;
          color: #6c757d;
        }
        
        .reset-btn {
          margin-top: 8px;
          padding: 4px 8px;
          font-size: 11px;
          border: 1px solid #ccc;
          border-radius: 3px;
          background: white;
          cursor: pointer;
        }
        
        .reset-btn:hover {
          background: #f8f9fa;
        }
        
        .error-types h4 {
          margin: 0 0 8px 0;
          font-size: 12px;
          font-weight: 600;
          color: #495057;
        }
        
        .error-type {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 8px;
          margin-bottom: 4px;
          border-radius: 3px;
          font-size: 11px;
        }
        
        .error-type.enabled {
          background: #e8f5e8;
          border-left: 3px solid #28a745;
        }
        
        .error-type.disabled {
          background: #f8f8f8;
          border-left: 3px solid #6c757d;
          opacity: 0.7;
        }
        
        .type-name {
          font-weight: 500;
        }
        
        .probability {
          font-weight: 600;
          color: #007bff;
        }
        
        .status-indicator {
          font-size: 12px;
        }
        
        .error-type.enabled .status-indicator {
          color: #28a745;
        }
        
        .error-type.disabled .status-indicator {
          color: #6c757d;
        }
        
        .info-note {
          margin-top: 16px;
          padding: 12px;
          background: #fff3cd;
          border-left: 3px solid #ffc107;
          border-radius: 0 4px 4px 0;
        }
        
        .info-note p {
          margin: 0;
          font-size: 11px;
          color: #856404;
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
};

export default NetworkSimulationPanel;