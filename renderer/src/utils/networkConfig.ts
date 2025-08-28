import networkConfig from '../../../shared/networkConfig.json';
import { logger } from './errorLogger';

export interface NetworkConfig {
  retry: {
    enabled: boolean;
    maxAttempts: number;
    defaultBaseDelay: number;
    timeouts: {
      request: number;
      connection: number;
    };
  };
  errorTypes: {
    [key: string]: {
      enabled: boolean;
      statusCodes: number[];
      keywords: string[];
      maxRetries: number;
      delays: number[];
      maxDelay: number;
    };
  };
  backoffStrategy: {
    type: string;
    multiplier: number;
    jitter: boolean;
    jitterPercent: number;
  };
  logging: {
    enabled: boolean;
    logRetries: boolean;
    logErrors: boolean;
    logSuccess: boolean;
    logSimulation: boolean;
  };
  userMessages: {
    [key: string]: string;
  };
  statusBar: {
    enabled: boolean;
    showNetworkStatus: boolean;
    showProcessingStatus: boolean;
    showVersion: boolean;
    height: number;
    connectionRestoreDisplayTime: number;
    animations: {
      enabled: boolean;
      pulseOnRestore: boolean;
      spinOnProcessing: boolean;
    };
  };
  development: {
    simulateErrors: boolean;
    simulationMode: string;
    simulationSettings: {
      globalProbability: number;
      consecutiveErrorLimit: number;
      resetAfterSuccess: boolean;
    };
    errorSimulation: {
      [key: string]: {
        enabled: boolean;
        probability: number;
        statusCodes: number[];
        messages: string[];
        responseTexts: string[];
      };
    };
  };
}

class NetworkConfigManager {
  private config: NetworkConfig = networkConfig as NetworkConfig;
  private isDevelopment: boolean;
  private simulationState = {
    consecutiveErrors: 0,
    lastErrorType: null as string | null
  };

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development';
    this.logConfig();
  }

  private logConfig(): void {
    if (this.config.logging.enabled) {
      logger.info('NetworkConfig', 'Network configuration loaded', {
        retryEnabled: this.config.retry.enabled,
        maxAttempts: this.config.retry.maxAttempts,
        simulationEnabled: this.isDevelopment && this.config.development.simulateErrors,
        enabledErrorTypes: Object.keys(this.config.errorTypes).filter(
          key => this.config.errorTypes[key].enabled
        )
      });
    }
  }

  getConfig(): NetworkConfig {
    return this.config;
  }

  isRetryEnabled(): boolean {
    return this.config.retry.enabled;
  }

  getMaxRetries(): number {
    return this.config.retry.maxAttempts;
  }

  getErrorTypeConfig(type: string) {
    return this.config.errorTypes[type];
  }

  getUserMessage(errorType: string): string {
    return this.config.userMessages[errorType] || this.config.userMessages.unknown;
  }

  isSimulationEnabled(): boolean {
    return this.isDevelopment && this.config.development.simulateErrors;
  }

  shouldSimulateError(): { simulate: boolean; errorType?: string; error?: Error } {
    if (!this.isSimulationEnabled()) {
      return { simulate: false };
    }

    // Check consecutive error limit
    if (this.simulationState.consecutiveErrors >= this.config.development.simulationSettings.consecutiveErrorLimit) {
      if (this.config.logging.logSimulation) {
        logger.info('NetworkConfig', 'Skipping error simulation due to consecutive error limit');
      }
      return { simulate: false };
    }

    // Check global probability
    if (Math.random() > this.config.development.simulationSettings.globalProbability) {
      return { simulate: false };
    }

    // Select error type to simulate
    const errorType = this.selectErrorType();
    if (!errorType) {
      return { simulate: false };
    }

    const simulatedError = this.createSimulatedError(errorType);
    
    // Update simulation state
    this.simulationState.consecutiveErrors++;
    this.simulationState.lastErrorType = errorType;

    if (this.config.logging.logSimulation) {
      logger.info('NetworkConfig', `Simulating ${errorType} error`, {
        consecutiveErrors: this.simulationState.consecutiveErrors,
        error: simulatedError.message,
        status: (simulatedError as any).status
      });
    }

    return { 
      simulate: true, 
      errorType, 
      error: simulatedError 
    };
  }

  private selectErrorType(): string | null {
    const enabledTypes = Object.keys(this.config.development.errorSimulation)
      .filter(type => this.config.development.errorSimulation[type].enabled);

    if (enabledTypes.length === 0) {
      return null;
    }

    // Weighted random selection based on probability
    const totalProbability = enabledTypes.reduce(
      (sum, type) => sum + this.config.development.errorSimulation[type].probability, 
      0
    );

    let random = Math.random() * totalProbability;
    
    for (const type of enabledTypes) {
      random -= this.config.development.errorSimulation[type].probability;
      if (random <= 0) {
        return type;
      }
    }

    return enabledTypes[0]; // Fallback
  }

  private createSimulatedError(errorType: string): Error {
    const errorConfig = this.config.development.errorSimulation[errorType];
    
    // Select random message and status code
    const message = errorConfig.messages[Math.floor(Math.random() * errorConfig.messages.length)];
    const statusCode = errorConfig.statusCodes.length > 0 
      ? errorConfig.statusCodes[Math.floor(Math.random() * errorConfig.statusCodes.length)]
      : 0;
    const responseText = errorConfig.responseTexts.length > 0
      ? errorConfig.responseTexts[Math.floor(Math.random() * errorConfig.responseTexts.length)]
      : '';

    const error = new Error(`[SIMULATED] ${message}`);
    
    // Add metadata for error categorization
    (error as any).status = statusCode;
    (error as any).responseText = responseText;
    (error as any).simulated = true;
    (error as any).simulationType = errorType;

    return error;
  }

  onRequestSuccess(): void {
    if (this.config.development.simulationSettings.resetAfterSuccess) {
      this.simulationState.consecutiveErrors = 0;
      this.simulationState.lastErrorType = null;
      
      if (this.config.logging.logSimulation && this.simulationState.consecutiveErrors > 0) {
        logger.info('NetworkConfig', 'Reset simulation state after successful request');
      }
    }
  }

  applyJitter(delay: number): number {
    if (!this.config.backoffStrategy.jitter) {
      return delay;
    }

    const jitterAmount = delay * (this.config.backoffStrategy.jitterPercent / 100);
    const jitter = (Math.random() * 2 - 1) * jitterAmount; // -jitterAmount to +jitterAmount
    
    return Math.max(100, Math.round(delay + jitter)); // Minimum 100ms delay
  }

  getDelayForErrorType(errorType: string, attemptNumber: number): number {
    const errorConfig = this.config.errorTypes[errorType];
    
    if (!errorConfig || attemptNumber >= errorConfig.delays.length) {
      // Use last delay or fallback to exponential backoff
      const baseDelay = errorConfig?.delays[errorConfig.delays.length - 1] || this.config.retry.defaultBaseDelay;
      return this.applyJitter(Math.min(baseDelay * Math.pow(this.config.backoffStrategy.multiplier, attemptNumber), errorConfig?.maxDelay || 30000));
    }

    return this.applyJitter(errorConfig.delays[attemptNumber]);
  }

  // Development helper methods
  enableSimulation(): void {
    if (this.isDevelopment) {
      this.config.development.simulateErrors = true;
      logger.info('NetworkConfig', 'Error simulation enabled');
    }
  }

  disableSimulation(): void {
    this.config.development.simulateErrors = false;
    this.simulationState.consecutiveErrors = 0;
    this.simulationState.lastErrorType = null;
    logger.info('NetworkConfig', 'Error simulation disabled');
  }

  getSimulationStats() {
    return {
      enabled: this.isSimulationEnabled(),
      consecutiveErrors: this.simulationState.consecutiveErrors,
      lastErrorType: this.simulationState.lastErrorType,
      limit: this.config.development.simulationSettings.consecutiveErrorLimit
    };
  }
}

export const networkConfigManager = new NetworkConfigManager();
export default networkConfigManager;