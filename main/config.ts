import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface AppConfig {
  username: string;
  password: string;
  apiKey?: string;
  lastUsedLanguage?: string;
  debugMode?: boolean;
  debugLevel?: number;
  checkUpdatesOnStart?: boolean;
  autoRemoveCompletedFiles?: boolean;
  cacheExpirationHours?: number;
  betaTest?: boolean;
  ffmpegPath?: string;
  apiBaseUrl?: string;
  autoLanguageDetection?: boolean;
  credits?: {
    used: number;
    remaining: number;
  };
}

export class ConfigManager {
  private configPath: string;
  private config: AppConfig;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.configPath = path.join(userDataPath, 'config.json');
    this.config = this.loadConfig();
  }

  private debug(level: number, category: string, message: string, ...args: any[]) {
    const debugLevel = this.config.debugLevel ?? 0;

    if (debugLevel >= level) {
      console.log(`[${category}] ${message}`, ...args);
    }
  }

  private loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }

    return {
      username: '',
      password: '',
      apiKey: 'YzhaGkIg6dMSJ47QoihkhikfRmvbJTn7',
      debugMode: false,
      checkUpdatesOnStart: true,
      autoRemoveCompletedFiles: false,
      cacheExpirationHours: 24,
      betaTest: false,
      ffmpegPath: '',
      apiBaseUrl: 'https://api.opensubtitles.com/api/v1',
      autoLanguageDetection: true,
    };
  }

  getConfig(): AppConfig {
    return { ...this.config };
  }

  saveConfig(newConfig: Partial<AppConfig>): boolean {
    try {
      this.config = { ...this.config, ...newConfig };
      
      const userDataPath = app.getPath('userData');
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }

      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving config:', error);
      return false;
    }
  }

  updateCredits(used: number, remaining: number): void {
    this.config.credits = { used, remaining };
    this.saveConfig({});
  }

  isConfigured(): boolean {
    return !!(this.config.username && this.config.password && this.config.apiKey);
  }

  // Token management - separate from user config
  private getTokenPath(): string {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'auth_token.txt');
  }

  saveToken(token: string): boolean {
    try {
      const userDataPath = app.getPath('userData');
      if (!fs.existsSync(userDataPath)) {
        fs.mkdirSync(userDataPath, { recursive: true });
      }
      
      fs.writeFileSync(this.getTokenPath(), token, 'utf8');
      return true;
    } catch (error) {
      console.error('Error saving token:', error);
      return false;
    }
  }

  getValidToken(): string | null {
    try {
      const tokenPath = this.getTokenPath();
      
      if (!fs.existsSync(tokenPath)) {
        return null;
      }
      
      // Check if token file is less than 6 hours old
      const stats = fs.statSync(tokenPath);
      const fileAge = Date.now() - stats.mtime.getTime();
      const sixHours = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

      if (fileAge > sixHours) {
        // Token is too old, delete it
        fs.unlinkSync(tokenPath);
        return null;
      }
      
      // Token is valid, return it
      return fs.readFileSync(tokenPath, 'utf8');
    } catch (error) {
      console.error('Error reading token:', error);
      return null;
    }
  }

  isTokenExpiredForHibernation(): boolean {
    try {
      const tokenPath = this.getTokenPath();

      if (!fs.existsSync(tokenPath)) {
        return true; // No token means expired
      }

      // Check if token file is older than 6 hours
      const stats = fs.statSync(tokenPath);
      const fileAge = Date.now() - stats.mtime.getTime();
      const sixHours = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

      return fileAge > sixHours;
    } catch (error) {
      console.error('Error checking token age:', error);
      return true; // Assume expired on error
    }
  }

  clearToken(): void {
    try {
      const tokenPath = this.getTokenPath();
      if (fs.existsSync(tokenPath)) {
        fs.unlinkSync(tokenPath);
      }
    } catch (error) {
      console.error('Error clearing token:', error);
    }
  }

  resetAllSettings(): boolean {
    try {
      this.debug(3, 'Config', '=== RESET SETTINGS DEBUG ===');
      this.debug(3, 'Config', 'Config path:', this.configPath);
      this.debug(3, 'Config', 'Config file exists:', fs.existsSync(this.configPath));
      
      // Clear config file
      if (fs.existsSync(this.configPath)) {
        this.debug(2, 'Config', 'Deleting config file...');
        fs.unlinkSync(this.configPath);
        this.debug(2, 'Config', 'Config file deleted successfully');
      }
      
      // Clear token file
      this.debug(2, 'Config', 'Clearing token...');
      this.clearToken();
      this.debug(2, 'Config', 'Token cleared successfully');
      
      // Reset in-memory config to defaults
      this.debug(2, 'Config', 'Resetting in-memory config...');
      this.config = {
        username: '',
        password: '',
        apiKey: '',
        debugMode: false,
        checkUpdatesOnStart: true,
        apiBaseUrl: 'https://api.opensubtitles.com/api/v1',
        autoLanguageDetection: true,
      };
      this.debug(2, 'Config', 'In-memory config reset successfully');
      
      this.debug(2, 'Config', 'All settings have been reset successfully');
      this.debug(3, 'Config', '=== END RESET SETTINGS DEBUG ===');
      return true;
    } catch (error) {
      console.error('=== RESET SETTINGS ERROR ===');
      console.error('Error resetting settings:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      console.error('=== END RESET SETTINGS ERROR ===');
      return false;
    }
  }
}