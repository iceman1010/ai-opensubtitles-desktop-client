import { app, BrowserWindow, ipcMain, dialog, session } from 'electron';
import * as path from 'path';
import { ConfigManager } from './config';
import { FFmpegManager } from './ffmpeg';
import * as fileFormatsConfig from '../shared/fileFormats.json';

class MainApp {
  private mainWindow: BrowserWindow | null = null;
  private configManager: ConfigManager;
  private ffmpegManager: FFmpegManager;

  constructor() {
    this.configManager = new ConfigManager();
    this.ffmpegManager = new FFmpegManager();
  }

  async initialize() {
    await app.whenReady();
    
    // Get user-agent from config, fallback to hardcoded value
    const config = await this.configManager.getConfig();
    let customUserAgent = 'API_Test_AI.OS'; // fallback
    
    try {
      const appConfigPath = path.join(__dirname, '../renderer/src/config/appConfig.json');
      const fs = require('fs');
      if (fs.existsSync(appConfigPath)) {
        const appConfig = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'));
        if (appConfig.userAgent) {
          customUserAgent = appConfig.userAgent;
        }
      }
    } catch (error) {
      console.warn('Failed to load user-agent from config, using fallback:', error);
    }
    
    console.log('Setting User-Agent to:', customUserAgent);
    
    // Set globally for the default session
    session.defaultSession.setUserAgent(customUserAgent);
    
    await this.createWindow();
    await this.setupIPC();
    await this.ffmpegManager.initialize();
  }

  private async createWindow() {
    // Check if debug mode is enabled
    const config = await this.configManager.getConfig();
    const isDebugMode = config.debugMode || false;
    
    this.mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js'),
      },
      show: true,
    });
    
    // Open DevTools if debug mode is enabled
    if (isDebugMode) {
      this.mainWindow.webContents.openDevTools();
      console.log('Debug mode enabled - opening DevTools');
    }

    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      this.mainWindow.loadURL('http://localhost:5173');
      // this.mainWindow.webContents.openDevTools(); // Commented out for cleaner UI
    } else {
      await this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    // Force show the window and add error handling
    this.mainWindow.show();
    this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load:', errorCode, errorDescription);
    });

    this.mainWindow.webContents.on('dom-ready', () => {
      console.log('DOM ready');
    });

    this.mainWindow.on('closed', () => {
      this.mainWindow = null;
    });
  }

  private async setupIPC() {
    ipcMain.handle('get-config', () => {
      return this.configManager.getConfig();
    });

    ipcMain.handle('save-config', async (_, config) => {
      return this.configManager.saveConfig(config);
    });

    ipcMain.handle('select-file', async () => {
      if (!this.mainWindow) return null;

      const allMediaExtensions = [
        ...fileFormatsConfig.video,
        ...fileFormatsConfig.audio,
        ...fileFormatsConfig.subtitle
      ];

      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openFile'],
        filters: [
          { name: 'Media Files', extensions: allMediaExtensions },
          { name: 'Video Files', extensions: fileFormatsConfig.video },
          { name: 'Audio Files', extensions: fileFormatsConfig.audio },
          { name: 'Subtitle Files', extensions: fileFormatsConfig.subtitle },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      return result.canceled ? null : result.filePaths[0];
    });

    ipcMain.handle('read-file', async (_, filePath: string) => {
      try {
        const fs = require('fs');
        const buffer = fs.readFileSync(filePath);
        const fileName = filePath.split('/').pop() || 'file';
        return {
          buffer: Array.from(buffer),
          fileName: fileName
        };
      } catch (error) {
        console.error('Failed to read file:', error);
        throw error;
      }
    });

    ipcMain.handle('ffmpeg-ready', () => {
      return this.ffmpegManager.isReady();
    });

    ipcMain.handle('extract-audio', async (_, inputPath: string, outputPath?: string, onProgress?: (progress: number) => void) => {
      try {
        return await this.ffmpegManager.extractAudioFromVideo(inputPath, outputPath, onProgress);
      } catch (error) {
        console.error('Audio extraction failed:', error);
        throw error;
      }
    });

    ipcMain.handle('convert-audio', async (_, inputPath: string, outputPath?: string, onProgress?: (progress: number) => void) => {
      try {
        return await this.ffmpegManager.convertAudioToMp3(inputPath, outputPath, onProgress);
      } catch (error) {
        console.error('Audio conversion failed:', error);
        throw error;
      }
    });

    ipcMain.handle('get-media-info', async (_, filePath: string) => {
      try {
        return await this.ffmpegManager.getMediaInfo(filePath);
      } catch (error) {
        console.error('Media info extraction failed:', error);
        throw error;
      }
    });

    ipcMain.handle('read-audio-file', async (_, filePath: string) => {
      try {
        const fs = require('fs');
        const buffer = fs.readFileSync(filePath);
        const fileName = filePath.split('/').pop() || 'file';
        return {
          buffer: Array.from(buffer),
          fileName: fileName
        };
      } catch (error) {
        console.error('Failed to read audio file:', error);
        throw error;
      }
    });

    ipcMain.handle('delete-file', async (_, filePath: string) => {
      try {
        const fs = require('fs');
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('Deleted file:', filePath);
        }
      } catch (error) {
        console.error('Failed to delete file:', filePath, error);
        throw error;
      }
    });

    ipcMain.handle('read-text-file', async (_, filePath: string) => {
      try {
        const fs = require('fs');
        const content = fs.readFileSync(filePath, 'utf8');
        const fileName = filePath.split('/').pop() || 'file';
        return {
          content,
          fileName
        };
      } catch (error) {
        console.error('Failed to read text file:', error);
        throw error;
      }
    });

    // Token management IPC handlers
    ipcMain.handle('get-valid-token', () => {
      return this.configManager.getValidToken();
    });

    ipcMain.handle('save-token', (_, token: string) => {
      return this.configManager.saveToken(token);
    });

    ipcMain.handle('clear-token', () => {
      this.configManager.clearToken();
    });

    ipcMain.handle('save-file', async (_, content: string, defaultFileName: string) => {
      if (!this.mainWindow) return null;

      const result = await dialog.showSaveDialog(this.mainWindow, {
        defaultPath: defaultFileName,
        filters: [
          { name: 'Subtitle Files', extensions: fileFormatsConfig.subtitle },
          { name: 'Text Files', extensions: ['txt'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      });

      if (result.canceled || !result.filePath) {
        return null;
      }

      try {
        const fs = require('fs');
        fs.writeFileSync(result.filePath, content, 'utf8');
        return result.filePath;
      } catch (error) {
        console.error('Failed to save file:', error);
        throw error;
      }
    });
  }
}

const mainApp = new MainApp();

app.on('ready', () => {
  mainApp.initialize();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await mainApp.initialize();
  }
});