import { app, BrowserWindow, ipcMain, dialog, session, shell, globalShortcut, Menu } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { ConfigManager } from './config';
import { FFmpegManager } from './ffmpeg';
import * as fileFormatsConfig from '../shared/fileFormats.json';

class MainApp {
  private mainWindow: BrowserWindow | null = null;
  private configManager: ConfigManager;
  private ffmpegManager: FFmpegManager;
  private pendingFilePaths: string[] = [];

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
      // Parse the file paths from second instance
      const filePaths = this.parseCommandLineArguments(commandLine);
      
      // Focus the existing window
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) this.mainWindow.restore();
        this.mainWindow.focus();
        
        // Send the file paths to renderer if provided
        if (filePaths.length > 0) {
          this.sendFilesToRenderer(filePaths);
        }
      }
    });

    await app.whenReady();
    
    // Get user-agent from config, fallback to hardcoded value
    const config = await this.configManager.getConfig();
    let customUserAgent = 'API_Test_AI.OS'; // fallback
    
    try {
      const appConfigPath = path.join(__dirname, '../../renderer/src/config/appConfig.json');
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

    // Send pending file paths to renderer once the window is ready
    this.mainWindow.webContents.once('did-finish-load', () => {
      if (this.pendingFilePaths.length > 0) {
        this.sendFilesToRenderer(this.pendingFilePaths);
        this.pendingFilePaths = [];
      }
    });

    // Register keyboard shortcuts
    this.registerShortcuts();
    
    // Setup application menu
    this.setupMenu();
  }

  private parseCommandLineArguments(argv: string[]): string[] {
    // Skip the first argument (executable path) and second (script path in dev mode)
    // Look for file path arguments
    const fileArgs: string[] = [];
    
    for (let i = 2; i < argv.length; i++) {
      const arg = argv[i];
      
      // Skip electron flags
      if (arg.startsWith('--')) continue;
      
      // Check if it's a valid file path
      try {
        const fs = require('fs');
        if (fs.existsSync(arg) && this.isValidFileExtension(arg)) {
          fileArgs.push(arg);
        }
      } catch {
        // Invalid file, skip
        continue;
      }
    }

    // Store for initial load if window isn't ready yet
    if (fileArgs.length > 0 && (!this.mainWindow || !this.mainWindow.webContents)) {
      this.pendingFilePaths = fileArgs;
    }
    
    return fileArgs;
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

  private registerShortcuts() {
    // F1 - Open Help
    globalShortcut.register('F1', () => {
      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('keyboard-shortcut', 'help');
      }
    });

    // Ctrl+1-5 - Navigation shortcuts
    globalShortcut.register('CommandOrControl+1', () => {
      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('keyboard-shortcut', 'navigate-main');
      }
    });

    globalShortcut.register('CommandOrControl+2', () => {
      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('keyboard-shortcut', 'navigate-batch');
      }
    });

    globalShortcut.register('CommandOrControl+3', () => {
      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('keyboard-shortcut', 'navigate-info');
      }
    });

    globalShortcut.register('CommandOrControl+4', () => {
      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('keyboard-shortcut', 'navigate-credits');
      }
    });

    globalShortcut.register('CommandOrControl+P', () => {
      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('keyboard-shortcut', 'navigate-preferences');
      }
    });

    globalShortcut.register('CommandOrControl+U', () => {
      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('keyboard-shortcut', 'navigate-update');
      }
    });

    globalShortcut.register('CommandOrControl+?', () => {
      if (this.mainWindow && this.mainWindow.webContents) {
        this.mainWindow.webContents.send('keyboard-shortcut', 'help');
      }
    });
  }

  private setupMenu() {
    const isMac = process.platform === 'darwin';
    
    const template: Electron.MenuItemConstructorOptions[] = [
      // App Menu (macOS only)
      ...(isMac ? [{
        label: 'AI.Opensubtitles.com Client',
        submenu: [
          { role: 'about' as const },
          { type: 'separator' as const },
          {
            label: 'Preferences...',
            accelerator: 'Command+,',
            click: () => {
              if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('keyboard-shortcut', 'navigate-preferences');
              }
            }
          },
          { type: 'separator' as const },
          { role: 'hide' as const },
          { role: 'hideOthers' as const },
          { role: 'unhide' as const },
          { type: 'separator' as const },
          { role: 'quit' as const }
        ]
      }] : []),

      // File Menu
      {
        label: 'File',
        submenu: [
          {
            label: 'Open File...',
            accelerator: 'CmdOrCtrl+O',
            click: async () => {
              if (this.mainWindow && this.mainWindow.webContents) {
                const result = await dialog.showOpenDialog(this.mainWindow, {
                  filters: [
                    { name: 'Video Files', extensions: fileFormatsConfig.video },
                    { name: 'Audio Files', extensions: fileFormatsConfig.audio },
                    { name: 'Subtitle Files', extensions: fileFormatsConfig.subtitle },
                    { name: 'All Files', extensions: ['*'] }
                  ],
                  properties: ['openFile']
                });

                if (!result.canceled && result.filePaths.length > 0) {
                  this.mainWindow.webContents.send('open-file-from-external', result.filePaths[0]);
                }
              }
            }
          },
          { type: 'separator' },
          ...(isMac ? [
            { role: 'close' as const }
          ] : [
            {
              label: 'Preferences...',
              accelerator: 'Ctrl+,',
              click: () => {
                if (this.mainWindow && this.mainWindow.webContents) {
                  this.mainWindow.webContents.send('keyboard-shortcut', 'navigate-preferences');
                }
              }
            },
            { type: 'separator' as const },
            { role: 'quit' as const }
          ])
        ]
      },

      // Edit Menu
      {
        label: 'Edit',
        submenu: [
          { role: 'undo' as const },
          { role: 'redo' as const },
          { type: 'separator' as const },
          { role: 'cut' as const },
          { role: 'copy' as const },
          { role: 'paste' as const },
          { role: 'selectAll' as const }
        ]
      },

      // View Menu
      {
        label: 'View',
        submenu: [
          {
            label: 'Main',
            accelerator: 'CmdOrCtrl+1',
            click: () => {
              if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('keyboard-shortcut', 'navigate-main');
              }
            }
          },
          {
            label: 'Batch Processing',
            accelerator: 'CmdOrCtrl+2',
            click: () => {
              if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('keyboard-shortcut', 'navigate-batch');
              }
            }
          },
          {
            label: 'Info',
            accelerator: 'CmdOrCtrl+3',
            click: () => {
              if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('keyboard-shortcut', 'navigate-info');
              }
            }
          },
          {
            label: 'Credits',
            accelerator: 'CmdOrCtrl+4',
            click: () => {
              if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('keyboard-shortcut', 'navigate-credits');
              }
            }
          },
          { type: 'separator' },
          {
            label: 'Updates',
            accelerator: 'CmdOrCtrl+U',
            click: () => {
              if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('keyboard-shortcut', 'navigate-update');
              }
            }
          },
          { type: 'separator' },
          { role: 'reload' as const },
          { role: 'forceReload' as const },
          { role: 'toggleDevTools' as const },
          { type: 'separator' },
          { role: 'resetZoom' as const },
          { role: 'zoomIn' as const },
          { role: 'zoomOut' as const },
          { type: 'separator' },
          { role: 'togglefullscreen' as const }
        ]
      },

      // Window Menu
      {
        label: 'Window',
        submenu: [
          { role: 'minimize' as const },
          ...(isMac ? [
            { type: 'separator' as const },
            { role: 'front' as const },
            { type: 'separator' as const },
            { role: 'window' as const }
          ] : [
            { role: 'close' as const }
          ])
        ]
      },

      // Help Menu
      {
        label: 'Help',
        submenu: [
          {
            label: 'Help & Documentation',
            accelerator: 'F1',
            click: () => {
              if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('keyboard-shortcut', 'help');
              }
            }
          },
          {
            label: 'Keyboard Shortcuts',
            accelerator: 'CmdOrCtrl+?',
            click: () => {
              if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('keyboard-shortcut', 'help');
              }
            }
          },
          { type: 'separator' },
          {
            label: 'Visit AI.Opensubtitles.com',
            click: async () => {
              await shell.openExternal('https://ai.opensubtitles.com');
            }
          },
          {
            label: 'Report Issue',
            click: async () => {
              await shell.openExternal('https://github.com/iceman1010/ai-opensubtitles-desktop-client/issues');
            }
          },
          ...(isMac ? [] : [
            { type: 'separator' as const },
            {
              label: 'About AI.Opensubtitles.com Client',
              click: () => {
                if (this.mainWindow && this.mainWindow.webContents) {
                  this.mainWindow.webContents.send('keyboard-shortcut', 'navigate-info');
                }
              }
            }
          ])
        ]
      }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
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

    ipcMain.handle('select-multiple-files', async () => {
      if (!this.mainWindow) return [];
      
      console.log('Main: Multiple file dialog requested');
      
      const allMediaExtensions = [
        ...fileFormatsConfig.video,
        ...fileFormatsConfig.audio,
        ...fileFormatsConfig.subtitle
      ];
      
      const dialogOptions = {
        properties: ['openFile', 'multiSelections'] as ('openFile' | 'multiSelections')[],
        buttonLabel: 'Select Files',
        title: 'Select Multiple Files for Batch Processing',
        filters: [
          { name: 'Media Files', extensions: allMediaExtensions },
          { name: 'Video Files', extensions: fileFormatsConfig.video },
          { name: 'Audio Files', extensions: fileFormatsConfig.audio },
          { name: 'Subtitle Files', extensions: fileFormatsConfig.subtitle },
          { name: 'All Files', extensions: ['*'] }
        ]
      };
      
      console.log('Main: Dialog options:', dialogOptions);
      
      const result = await dialog.showOpenDialog(this.mainWindow, dialogOptions);
      
      console.log('Main: Dialog result:', {
        canceled: result.canceled,
        filePaths: result.filePaths,
        filePathsLength: result.filePaths?.length
      });
      
      return result.canceled ? [] : result.filePaths;
    });

    // Directory selection handler
    ipcMain.handle('select-directory', async () => {
      if (!this.mainWindow) return null;
      
      const result = await dialog.showOpenDialog(this.mainWindow, {
        properties: ['openDirectory'],
        buttonLabel: 'Select Directory',
        title: 'Select Output Directory'
      });
      
      return result.canceled ? null : result.filePaths[0];
    });

    // File operation handlers for batch processing
    ipcMain.handle('write-file-directly', async (_, content: string, filePath: string) => {
      try {
        const fs = require('fs');
        const path = require('path');
        
        // Ensure directory exists
        const dir = path.dirname(filePath);
        fs.mkdirSync(dir, { recursive: true });
        
        // Write file
        fs.writeFileSync(filePath, content, 'utf8');
        return filePath;
      } catch (error: any) {
        throw new Error(`Failed to write file: ${error?.message || 'Unknown error'}`);
      }
    });

    ipcMain.handle('check-file-exists', async (_, filePath: string) => {
      try {
        const fs = require('fs');
        fs.accessSync(filePath);
        return true;
      } catch {
        return false;
      }
    });

    ipcMain.handle('get-directory-name', async (_, filePath: string) => {
      const path = require('path');
      return path.dirname(filePath);
    });

    ipcMain.handle('generate-unique-filename', async (_, basePath: string, extension: string) => {
      const fs = require('fs');
      const path = require('path');
      
      let finalPath = `${basePath}.${extension}`;
      let counter = 1;
      
      // Keep checking until we find a unique name
      while (fs.existsSync(finalPath)) {
        finalPath = `${basePath}_${counter}.${extension}`;
        counter++;
      }
      
      return finalPath;
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

    ipcMain.handle('extract-audio', async (_, inputPath: string, outputPath?: string, onProgress?: (progress: number) => void, durationSeconds?: number) => {
      try {
        return await this.ffmpegManager.extractAudioFromVideo(inputPath, outputPath, onProgress, durationSeconds);
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

    ipcMain.handle('reset-all-settings', () => {
      return this.configManager.resetAllSettings();
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

    // File association handlers
    ipcMain.handle('check-file-associations', async () => {
      return this.checkFileAssociations();
    });

    ipcMain.handle('register-file-associations', async () => {
      return this.registerFileAssociations();
    });
  }

  private async checkFileAssociations(): Promise<{registered: boolean, associatedFormats: string[]}> {
    try {
      const os = require('os');
      const platform = os.platform();
      
      if (platform === 'win32') {
        return this.checkWindowsFileAssociations();
      } else if (platform === 'linux') {
        return this.checkLinuxFileAssociations();
      } else if (platform === 'darwin') {
        return this.checkMacOSFileAssociations();
      } else {
        return { registered: false, associatedFormats: [] };
      }
    } catch (error) {
      console.error('Error checking file associations:', error);
      return { registered: false, associatedFormats: [] };
    }
  }

  private async checkWindowsFileAssociations(): Promise<{registered: boolean, associatedFormats: string[]}> {
    try {
      const { execSync } = require('child_process');
      const allFormats = [
        ...fileFormatsConfig.video,
        ...fileFormatsConfig.audio,
        ...fileFormatsConfig.subtitle
      ];
      
      const associatedFormats: string[] = [];
      
      for (const ext of allFormats) {
        try {
          const result = execSync(`assoc .${ext}`, { encoding: 'utf8', stdio: 'pipe' });
          if (result.includes('AI.Opensubtitles.com Client') || result.includes('OpenSubtitles')) {
            associatedFormats.push(ext);
          }
        } catch {
          // Extension not associated, continue
        }
      }
      
      return {
        registered: associatedFormats.length > 0,
        associatedFormats
      };
    } catch (error) {
      console.error('Error checking Windows file associations:', error);
      return { registered: false, associatedFormats: [] };
    }
  }

  private async checkLinuxFileAssociations(): Promise<{registered: boolean, associatedFormats: string[]}> {
    try {
      const fs = require('fs');
      const os = require('os');
      const path = require('path');
      
      const desktopFile = path.join(os.homedir(), '.local/share/applications/ai-opensubtitles-client.desktop');
      const mimeListFile = path.join(os.homedir(), '.local/share/applications/mimeinfo.cache');
      
      let registered = false;
      const associatedFormats: string[] = [];
      
      // Check if our desktop file exists
      if (fs.existsSync(desktopFile)) {
        registered = true;
        // For simplicity, assume all formats are associated if desktop file exists
        associatedFormats.push(...fileFormatsConfig.video, ...fileFormatsConfig.audio, ...fileFormatsConfig.subtitle);
      }
      
      return { registered, associatedFormats };
    } catch (error) {
      console.error('Error checking Linux file associations:', error);
      return { registered: false, associatedFormats: [] };
    }
  }

  private async checkMacOSFileAssociations(): Promise<{registered: boolean, associatedFormats: string[]}> {
    try {
      const { execSync } = require('child_process');
      const allFormats = [
        ...fileFormatsConfig.video,
        ...fileFormatsConfig.audio,
        ...fileFormatsConfig.subtitle
      ];
      
      const associatedFormats: string[] = [];
      
      for (const ext of allFormats) {
        try {
          const result = execSync(`duti -x .${ext}`, { encoding: 'utf8', stdio: 'pipe' });
          if (result.includes('ai-opensubtitles-client') || result.includes('AI.Opensubtitles.com Client')) {
            associatedFormats.push(ext);
          }
        } catch {
          // Extension not associated, continue
        }
      }
      
      return {
        registered: associatedFormats.length > 0,
        associatedFormats
      };
    } catch (error) {
      console.error('Error checking macOS file associations:', error);
      return { registered: false, associatedFormats: [] };
    }
  }

  private async registerFileAssociations(): Promise<{success: boolean, message: string}> {
    try {
      const os = require('os');
      const platform = os.platform();
      
      if (platform === 'win32') {
        return this.registerWindowsFileAssociations();
      } else if (platform === 'linux') {
        return this.registerLinuxFileAssociations();
      } else if (platform === 'darwin') {
        return this.registerMacOSFileAssociations();
      } else {
        return {
          success: false,
          message: `File associations not supported on ${platform}`
        };
      }
    } catch (error) {
      console.error('Error registering file associations:', error);
      return {
        success: false,
        message: `Failed to register file associations: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async registerWindowsFileAssociations(): Promise<{success: boolean, message: string}> {
    try {
      const { execSync } = require('child_process');
      const path = require('path');
      
      const appPath = process.execPath;
      const allFormats = [
        ...fileFormatsConfig.video,
        ...fileFormatsConfig.audio,
        ...fileFormatsConfig.subtitle
      ];
      
      for (const ext of allFormats) {
        try {
          // Associate file extension with our app
          execSync(`ftype OpenSubtitles.${ext}="${appPath}" "%1"`, { stdio: 'pipe' });
          execSync(`assoc .${ext}=OpenSubtitles.${ext}`, { stdio: 'pipe' });
        } catch (error) {
          console.error(`Failed to associate .${ext}:`, error);
        }
      }
      
      return {
        success: true,
        message: `Registered ${allFormats.length} file types successfully`
      };
    } catch (error) {
      console.error('Error registering Windows file associations:', error);
      return {
        success: false,
        message: `Failed to register Windows file associations: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async registerLinuxFileAssociations(): Promise<{success: boolean, message: string}> {
    try {
      const fs = require('fs');
      const os = require('os');
      const path = require('path');
      const { execSync } = require('child_process');
      
      const homeDir = os.homedir();
      const applicationsDir = path.join(homeDir, '.local/share/applications');
      const desktopFile = path.join(applicationsDir, 'ai-opensubtitles-client.desktop');
      
      // Ensure applications directory exists
      fs.mkdirSync(applicationsDir, { recursive: true });
      
      // Create desktop entry
      const desktopEntry = `[Desktop Entry]
Version=1.0
Type=Application
Name=AI.Opensubtitles.com Client
Comment=Desktop client for AI.Opensubtitles.com
Exec=${process.execPath} %f
Icon=ai-opensubtitles-client
StartupNotify=true
NoDisplay=false
MimeType=`;
      
      // Add MIME types for all supported formats
      const allFormats = [
        ...fileFormatsConfig.video,
        ...fileFormatsConfig.audio,
        ...fileFormatsConfig.subtitle
      ];
      
      const videoMimes = fileFormatsConfig.video.map(ext => `video/${ext}`).join(';');
      const audioMimes = fileFormatsConfig.audio.map(ext => `audio/${ext}`).join(';');
      const subtitleMimes = fileFormatsConfig.subtitle.map(ext => `application/${ext}`).join(';');
      
      const fullDesktopEntry = desktopEntry + [videoMimes, audioMimes, subtitleMimes].join(';') + ';\n';
      
      // Write desktop file
      fs.writeFileSync(desktopFile, fullDesktopEntry, 'utf8');
      
      // Make executable
      fs.chmodSync(desktopFile, '755');
      
      // Update mime database
      try {
        execSync('update-desktop-database ~/.local/share/applications/', { stdio: 'pipe' });
      } catch {
        // Non-critical if update-desktop-database fails
      }
      
      return {
        success: true,
        message: `Created desktop entry for ${allFormats.length} file types`
      };
    } catch (error) {
      console.error('Error registering Linux file associations:', error);
      return {
        success: false,
        message: `Failed to register Linux file associations: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private async registerMacOSFileAssociations(): Promise<{success: boolean, message: string}> {
    try {
      const { execSync } = require('child_process');
      const allFormats = [
        ...fileFormatsConfig.video,
        ...fileFormatsConfig.audio,
        ...fileFormatsConfig.subtitle
      ];
      
      const bundleId = 'com.ai-opensubtitles.desktop-client';
      
      for (const ext of allFormats) {
        try {
          execSync(`duti -s ${bundleId} .${ext} all`, { stdio: 'pipe' });
        } catch (error) {
          console.error(`Failed to associate .${ext}:`, error);
        }
      }
      
      return {
        success: true,
        message: `Registered ${allFormats.length} file types successfully`
      };
    } catch (error) {
      console.error('Error registering macOS file associations:', error);
      return {
        success: false,
        message: `Failed to register macOS file associations: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  private sendFilesToRenderer(filePaths: string[]) {
    if (!this.mainWindow || !this.mainWindow.webContents) return;
    
    if (filePaths.length === 1) {
      // Single file - send to Single File screen
      console.log('Sending single file to Single File screen:', filePaths[0]);
      this.mainWindow.webContents.send('open-file-from-external', filePaths[0]);
    } else if (filePaths.length > 1) {
      // Multiple files - send to Batch screen
      console.log(`Sending ${filePaths.length} files to Batch screen:`, filePaths);
      this.mainWindow.webContents.send('open-files-from-external', filePaths);
    }
  }
}

const mainApp = new MainApp();

app.on('ready', () => {
  mainApp.initialize();
});

app.on('window-all-closed', () => {
  // Unregister all global shortcuts
  globalShortcut.unregisterAll();
  
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await mainApp.initialize();
  }
});