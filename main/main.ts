import { app, BrowserWindow, ipcMain, dialog, session, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { ConfigManager } from './config';
import { FFmpegManager } from './ffmpeg';
import * as fileFormatsConfig from '../shared/fileFormats.json';

class MainApp {
  private mainWindow: BrowserWindow | null = null;
  private configManager: ConfigManager;
  private ffmpegManager: FFmpegManager;
  private pendingFilePath: string | null = null;

  constructor() {
    this.configManager = new ConfigManager();
    this.ffmpegManager = new FFmpegManager();
  }

  async initialize() {
    // Parse command line arguments for file path
    this.parseCommandLineArguments(process.argv);

    // Enforce single instance
    const gotTheLock = app.requestSingleInstanceLock();
    
    if (!gotTheLock) {
      // Another instance is already running - show warning and exit
      console.warn('Another instance of the application is already running.');
      app.quit();
      return;
    }

    // Handle when someone tries to run a second instance
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      // Parse the file path from second instance
      const filePath = this.parseCommandLineArguments(commandLine);
      
      // Focus the existing window
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.focus();
        
        // Send the file path to renderer if provided
        if (filePath) {
          this.mainWindow.webContents.send('open-file-from-external', filePath);
        }
      }
    });

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
    await this.setupAutoUpdater();
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

    // Send pending file path to renderer once the window is ready
    this.mainWindow.webContents.once('did-finish-load', () => {
      if (this.pendingFilePath) {
        this.mainWindow!.webContents.send('open-file-from-external', this.pendingFilePath);
        this.pendingFilePath = null;
      }
    });
  }

  private parseCommandLineArguments(argv: string[]): string | null {
    // Skip the first argument (executable path) and second (script path in dev mode)
    // Look for a file path argument
    const fileArg = argv.find((arg, index) => {
      // Skip electron executable and main script
      if (index < 2) return false;
      
      // Skip electron flags
      if (arg.startsWith('--')) return false;
      
      // Check if it's a valid file path
      try {
        const fs = require('fs');
        return fs.existsSync(arg);
      } catch {
        return false;
      }
    });

    // Validate file extension
    if (fileArg && this.isValidFileExtension(fileArg)) {
      // Store for initial load if window isn't ready yet
      if (!this.mainWindow || !this.mainWindow.webContents) {
        this.pendingFilePath = fileArg;
      }
      return fileArg;
    }

    return null;
  }

  private isValidFileExtension(filePath: string): boolean {
    const ext = path.extname(filePath).toLowerCase().slice(1);
    const allFormats = [
      ...fileFormatsConfig.video,
      ...fileFormatsConfig.audio,
      ...fileFormatsConfig.subtitle
    ];
    return allFormats.includes(ext);
  }

  private async setupAutoUpdater() {
    // Skip auto-updater setup in development
    const isDev = process.env.NODE_ENV === 'development';
    console.log('=== AUTO-UPDATER SETUP ===');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Is Development:', isDev);
    
    if (isDev) {
      console.log('Skipping auto-updater setup in development mode');
      return;
    }

    try {
      console.log('Configuring auto-updater for GitHub releases...');
      
      // Configure auto-updater for GitHub releases
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'iceman1010',
        repo: 'ai-opensubtitles-desktop-client'
      });
      
      console.log('Auto-updater feed URL set successfully');
    } catch (error) {
      console.error('Failed to configure auto-updater:', error);
    }

    // Set up auto-updater event handlers
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for update...');
      this.sendUpdateStatus('checking-for-update', 'Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
      console.log('Update available:', info);
      this.sendUpdateStatus('update-available', `Update available: v${info.version}`);
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('Update not available:', info);
      this.sendUpdateStatus('update-not-available', 'You have the latest version');
    });

    autoUpdater.on('error', (err) => {
      console.error('Update error:', err);
      this.sendUpdateStatus('update-error', `Update error: ${err.message}`);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
      console.log(logMessage);
      this.sendUpdateStatus('update-downloading', `Downloading update: ${Math.round(progressObj.percent)}%`);
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded:', info);
      this.sendUpdateStatus('update-downloaded', `Update ready: v${info.version}`);
    });

    // Check for updates on startup if enabled
    const config = await this.configManager.getConfig();
    if (config.checkUpdatesOnStart) {
      setTimeout(() => {
        this.checkForUpdates();
      }, 3000); // Wait 3 seconds after startup
    }
  }

  private sendUpdateStatus(event: string, message: string) {
    if (this.mainWindow) {
      this.mainWindow.webContents.send('update-status', { event, message });
    }
  }

  private async checkForUpdates() {
    const isDev = process.env.NODE_ENV === 'development';
    console.log('=== UPDATE CHECK DEBUG ===');
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Is Development:', isDev);
    console.log('Platform:', process.platform);
    console.log('App Version:', require('../../package.json').version);
    
    if (isDev) {
      console.log('Update check skipped in development mode');
      this.sendUpdateStatus('update-not-available', 'Updates not available in development mode');
      return;
    }

    try {
      console.log('Starting update check...');
      console.log('AutoUpdater feed URL:', {
        provider: 'github',
        owner: 'iceman1010',
        repo: 'ai-opensubtitles-desktop-client'
      });
      
      const result = await autoUpdater.checkForUpdates();
      console.log('Update check result:', result);
    } catch (error) {
      console.error('Failed to check for updates:', error);
      console.error('Error details:', {
        name: error instanceof Error ? error.name : 'Unknown',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.sendUpdateStatus('update-error', `Update check failed: ${errorMessage}`);
    }
    console.log('=== END UPDATE CHECK DEBUG ===');
  }

  private async downloadAndInstallUpdate() {
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      this.sendUpdateStatus('update-error', 'Downloads not available in development mode');
      return;
    }

    try {
      await autoUpdater.downloadUpdate();
    } catch (error) {
      console.error('Failed to download update:', error);
      this.sendUpdateStatus('update-error', 'Failed to download update');
    }
  }

  private installUpdate() {
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      this.sendUpdateStatus('update-error', 'Install not available in development mode');
      return;
    }

    autoUpdater.quitAndInstall();
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

    ipcMain.handle('open-external', async (_, url: string) => {
      try {
        await shell.openExternal(url);
        return true;
      } catch (error) {
        console.error('Failed to open external URL:', error);
        return false;
      }
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

    // Auto-updater IPC handlers
    ipcMain.handle('check-for-updates', async () => {
      await this.checkForUpdates();
    });

    ipcMain.handle('download-update', async () => {
      await this.downloadAndInstallUpdate();
    });

    ipcMain.handle('install-update', () => {
      this.installUpdate();
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