import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

export interface AppConfig {
  username: string;
  password: string;
  apiKey?: string;
  lastUsedLanguage?: string;
  debugMode?: boolean;
  checkUpdatesOnStart?: boolean;
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
      apiKey: '',
      debugMode: false,
      checkUpdatesOnStart: true,
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
      
      // Check if token file is less than 12 hours old
      const stats = fs.statSync(tokenPath);
      const fileAge = Date.now() - stats.mtime.getTime();
      const twelveHours = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
      
      if (fileAge > twelveHours) {
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
}