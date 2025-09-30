import { app, BrowserWindow, ipcMain, dialog, session, shell, globalShortcut, Menu, powerMonitor } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import { ConfigManager } from './config';
import { FFmpegManager } from './ffmpeg';
import { initializePowerSaveBlocker, cleanupPowerSaveBlocker } from './powerSaveBlocker';
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

  private debug(level: number, category: string, message: string, ...args: any[]) {
    const config = this.configManager.getConfig();
    const debugLevel = config.debugLevel ?? 0;

    if (debugLevel >= level) {
      console.log(`[${category}] ${message}`, ...args);
    }
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
    const userConfig = await this.configManager.getConfig();
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
      this.debug(1, 'Main', 'Failed to load user-agent from config, using fallback:', error);
    }
    
    this.debug(2, 'Main', 'Setting User-Agent to:', customUserAgent);
    
    // Set globally for the default session
    session.defaultSession.setUserAgent(customUserAgent);
    
    await this.createWindow();
    await this.setupIPC();
    await this.setupAutoUpdater();
    const appConfig = this.configManager.getConfig();
    this.ffmpegManager.setDebugLevel(appConfig.debugLevel ?? 0);
    await this.ffmpegManager.initialize(appConfig.ffmpegPath);
  }

  private async createWindow() {
    // Check if debug mode is enabled
    const windowConfig = await this.configManager.getConfig();
    const isDebugMode = windowConfig.debugMode || false;
    
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
      this.debug(1, 'Main', 'Debug mode enabled - opening DevTools');
    }

    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      this.mainWindow.loadURL('http://localhost:5173');
      // this.mainWindow.webContents.openDevTools(); // Commented out for cleaner UI
    } else {
      // Smart path resolution for different packaging formats
      const rendererPath = path.join(__dirname, '../renderer/index.html');
      
      this.debug(3, 'Renderer', '=== RENDERER PATH DEBUG ===');
      this.debug(3, 'Renderer', '__dirname:', __dirname);
      this.debug(3, 'Renderer', 'In app.asar:', __dirname.includes('app.asar'));
      this.debug(3, 'Renderer', 'rendererPath:', rendererPath);
      this.debug(3, 'Renderer', 'rendererPath exists:', require('fs').existsSync(rendererPath));

      // List directory contents for debugging
      try {
        const parentDir = path.dirname(rendererPath);
        this.debug(3, 'Renderer', 'Parent dir:', parentDir);
        this.debug(3, 'Renderer', 'Parent dir contents:', require('fs').readdirSync(parentDir));
      } catch (err) {
        this.debug(3, 'Renderer', 'Could not list parent dir:', err instanceof Error ? err.message : err);
      }

      this.debug(3, 'Renderer', '==========================');
      
      await this.mainWindow.loadFile(rendererPath);
    }

    // Force show the window and add error handling
    this.mainWindow.show();
    this.mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Failed to load:', errorCode, errorDescription);
    });

    this.mainWindow.webContents.on('dom-ready', () => {
      this.debug(2, 'Main', 'DOM ready');
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
          {
            label: 'Check for Updates...',
            accelerator: 'Command+U',
            click: async () => {
              await this.checkForUpdates();
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
            {
              label: 'Check for Updates...',
              accelerator: 'Ctrl+U',
              click: async () => {
                await this.checkForUpdates();
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
    this.debug(2, 'AutoUpdater', '=== AUTO-UPDATER SETUP ===');
    this.debug(2, 'AutoUpdater', 'Environment:', process.env.NODE_ENV);
    this.debug(2, 'AutoUpdater', 'Is Development:', isDev);
    
    if (isDev) {
      this.debug(2, 'AutoUpdater', 'Skipping auto-updater setup in development mode');
      return;
    }

    try {
      this.debug(2, 'AutoUpdater', 'Configuring auto-updater for GitHub releases...');
      
      // Configure auto-updater for GitHub releases
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'iceman1010',
        repo: 'ai-opensubtitles-desktop-client'
      });
      
      // Fix version comparison issues with missing releases
      autoUpdater.allowPrerelease = false;
      
      this.debug(2, 'AutoUpdater', 'Auto-updater feed URL set successfully');
    } catch (error) {
      console.error('Failed to configure auto-updater:', error);
    }

    // Set up auto-updater event handlers
    autoUpdater.on('checking-for-update', () => {
      this.debug(2, 'AutoUpdater', 'Checking for update...');
      this.sendUpdateStatus('checking-for-update', 'Checking for updates...');
    });

    autoUpdater.on('update-available', (info) => {
      this.debug(2, 'AutoUpdater', 'Update available:', info);
      this.sendUpdateStatus('update-available', `Update available: v${info.version}`);
    });

    autoUpdater.on('update-not-available', (info) => {
      this.debug(2, 'AutoUpdater', 'Update not available:', info);
      this.sendUpdateStatus('update-not-available', 'You have the latest version');
    });

    autoUpdater.on('error', (err) => {
      console.error('Update error:', err);
      this.sendUpdateStatus('update-error', `Update error: ${err.message}`);
    });

    autoUpdater.on('download-progress', (progressObj) => {
      const logMessage = `Download speed: ${progressObj.bytesPerSecond} - Downloaded ${progressObj.percent}% (${progressObj.transferred}/${progressObj.total})`;
      this.debug(3, 'AutoUpdater', logMessage);
      this.sendUpdateStatus('update-downloading', `Downloading update: ${Math.round(progressObj.percent)}%`);
    });

    autoUpdater.on('update-downloaded', (info) => {
      this.debug(2, 'AutoUpdater', 'Update downloaded:', info);
      this.sendUpdateStatus('update-downloaded', `Update ready: v${info.version}`);
    });

    // Check for updates on startup if enabled
    const updateConfig = await this.configManager.getConfig();
    if (updateConfig.checkUpdatesOnStart) {
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
    this.debug(3, 'UpdateCheck', '=== UPDATE CHECK DEBUG ===');
    this.debug(3, 'UpdateCheck', 'Environment:', process.env.NODE_ENV);
    this.debug(3, 'UpdateCheck', 'Is Development:', isDev);
    this.debug(3, 'UpdateCheck', 'Platform:', process.platform);
    this.debug(3, 'UpdateCheck', 'App Version:', require('../../package.json').version);
    
    if (isDev) {
      this.debug(2, 'UpdateCheck', 'Update check skipped in development mode');
      this.sendUpdateStatus('update-not-available', 'Updates not available in development mode');
      return;
    }

    try {
      this.debug(2, 'UpdateCheck', 'Starting update check...');
      this.debug(3, 'UpdateCheck', 'AutoUpdater feed URL:', {
        provider: 'github',
        owner: 'iceman1010',
        repo: 'ai-opensubtitles-desktop-client'
      });
      
      const result = await autoUpdater.checkForUpdates();
      this.debug(3, 'UpdateCheck', 'Update check result:', result);
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
    this.debug(3, 'UpdateCheck', '=== END UPDATE CHECK DEBUG ===');
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

  private setupPowerMonitoring(debugEnabled: boolean = false) {
    const debug = (message: string, ...args: any[]) => {
      if (debugEnabled) {
        console.log(`[PowerMonitor] ${message}`, ...args);
      }
    };

    // Set up power monitoring events
    powerMonitor.on('suspend', () => {
      debug('System is suspending');
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('system-suspend');
      }
    });

    powerMonitor.on('resume', () => {
      debug('System is resuming from suspend');
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('system-resume');
      }
    });

    powerMonitor.on('lock-screen', () => {
      debug('Screen is locked');
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('screen-lock');
      }
    });

    powerMonitor.on('unlock-screen', () => {
      debug('Screen is unlocked');
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('screen-unlock');
      }
    });

    debug('Power monitoring initialized');
  }

  private async setupIPC() {
    // Initialize PowerSaveBlocker with debug mode based on config
    const config = this.configManager.getConfig();
    const debugEnabled = config.debugMode || false;
    initializePowerSaveBlocker(debugEnabled);

    // Setup power monitoring for hibernation detection
    this.setupPowerMonitoring(debugEnabled);

    ipcMain.handle('get-config', () => {
      return this.configManager.getConfig();
    });

    ipcMain.handle('save-config', async (_, config) => {
      const result = this.configManager.saveConfig(config);
      // Update debug level
      if (config.debugLevel !== undefined) {
        this.ffmpegManager.setDebugLevel(config.debugLevel);
      }
      // Reinitialize FFmpeg if the path changed
      if (config.ffmpegPath !== undefined) {
        this.ffmpegManager = new (require('./ffmpeg').FFmpegManager)();
        this.ffmpegManager.setDebugLevel(config.debugLevel ?? 0);
        await this.ffmpegManager.initialize(config.ffmpegPath);
      }
      return result;
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
      
      this.debug(2, 'Main', 'Multiple file dialog requested');
      
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
      
      this.debug(3, 'Main', 'Dialog options:', dialogOptions);
      
      const result = await dialog.showOpenDialog(this.mainWindow, dialogOptions);
      
      this.debug(3, 'Main', 'Dialog result:', {
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
          this.debug(2, 'Main', 'Deleted file:', filePath);
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

    ipcMain.handle('is-token-expired-for-hibernation', () => {
      return this.configManager.isTokenExpiredForHibernation();
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

    // FFmpeg handlers
    ipcMain.handle('test-ffmpeg-path', async (_, path: string) => {
      return this.testFfmpegPath(path);
    });

    ipcMain.handle('open-ffmpeg-dialog', async () => {
      return this.openFfmpegDialog();
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
          this.debug(1, 'FileAssoc', `Failed to associate .${ext}:`, error);
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
          this.debug(1, 'FileAssoc', `Failed to associate .${ext}:`, error);
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
      this.debug(2, 'Main', 'Sending single file to Single File screen:', filePaths[0]);
      this.mainWindow.webContents.send('open-file-from-external', filePaths[0]);
    } else if (filePaths.length > 1) {
      // Multiple files - send to Batch screen
      this.debug(2, 'Main', `Sending ${filePaths.length} files to Batch screen:`, filePaths);
      this.mainWindow.webContents.send('open-files-from-external', filePaths);
    }
  }

  private async testFfmpegPath(path: string): Promise<{success: boolean, message: string}> {
    if (!path.trim()) {
      return { success: false, message: 'Path is empty. Use auto-detection instead.' };
    }

    this.debug(2, 'FFmpeg', `Testing FFmpeg path: ${path}`);
    
    return new Promise((resolve) => {
      const { spawn } = require('child_process');
      const child = spawn(path, ['-version'], { stdio: 'pipe' });
      
      let output = '';
      child.stdout.on('data', (data: any) => {
        output += data.toString();
      });

      child.on('close', (code: number) => {
        const success = code === 0;
        const message = success 
          ? `FFmpeg path is valid and working: ${path}`
          : `FFmpeg path failed to execute. Exit code: ${code}`;
        
        this.debug(2, 'FFmpeg', `FFmpeg test result: ${success ? 'SUCCESS' : 'FAILED'} - ${message}`);
        resolve({ success, message });
      });

      child.on('error', (error: any) => {
        const message = `FFmpeg path not found or not executable: ${error.message}`;
        this.debug(1, 'FFmpeg', `FFmpeg test error: ${message}`);
        resolve({ success: false, message });
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        child.kill();
        const message = 'FFmpeg test timed out after 5 seconds';
        this.debug(1, 'FFmpeg', message);
        resolve({ success: false, message });
      }, 5000);
    });
  }

  private async openFfmpegDialog(): Promise<{filePath?: string, cancelled: boolean}> {
    if (!this.mainWindow) {
      return { cancelled: true };
    }

    try {
      const { dialog } = require('electron');
      const os = require('os');
      
      // Platform-specific default paths and filters
      let defaultPath = '';
      let filters: any[] = [];
      
      if (os.platform() === 'win32') {
        // Windows
        filters = [
          { name: 'Executable Files', extensions: ['exe'] },
          { name: 'All Files', extensions: ['*'] }
        ];
      } else {
        // macOS/Linux - no extension needed
        filters = [{ name: 'All Files', extensions: ['*'] }];
        
        // Suggest common paths based on platform
        if (os.platform() === 'darwin') {
          defaultPath = '/usr/local/bin'; // Start in common macOS location
        } else {
          defaultPath = '/usr/bin'; // Start in common Linux location
        }
      }
      
      const result = await dialog.showOpenDialog(this.mainWindow, {
        title: 'Select FFmpeg Executable',
        defaultPath,
        filters,
        properties: ['openFile']
      });

      this.debug(3, 'FFmpeg', 'FFmpeg file dialog result:', result);
      
      if (result.canceled || !result.filePaths.length) {
        return { cancelled: true };
      }

      return { filePath: result.filePaths[0], cancelled: false };
    } catch (error) {
      console.error('Error opening FFmpeg dialog:', error);
      return { cancelled: true };
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

  // Cleanup PowerSaveBlocker
  cleanupPowerSaveBlocker();

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', async () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    await mainApp.initialize();
  }
});