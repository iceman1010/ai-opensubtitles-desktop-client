import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectMultipleFiles: () => ipcRenderer.invoke('select-multiple-files'),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  writeFileDirectly: (content: string, filePath: string) => ipcRenderer.invoke('write-file-directly', content, filePath),
  checkFileExists: (filePath: string) => ipcRenderer.invoke('check-file-exists', filePath),
  getDirectoryName: (filePath: string) => ipcRenderer.invoke('get-directory-name', filePath),
  generateUniqueFileName: (basePath: string, extension: string) => ipcRenderer.invoke('generate-unique-filename', basePath, extension),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  readAudioFile: (filePath: string) => ipcRenderer.invoke('read-audio-file', filePath),
  saveFile: (content: string, defaultFileName: string) => ipcRenderer.invoke('save-file', content, defaultFileName),
  ffmpegReady: () => ipcRenderer.invoke('ffmpeg-ready'),
  extractAudio: (inputPath: string, outputPath?: string, onProgress?: (progress: number) => void, durationSeconds?: number) => 
    ipcRenderer.invoke('extract-audio', inputPath, outputPath, onProgress, durationSeconds),
  convertAudio: (inputPath: string, outputPath?: string, onProgress?: (progress: number) => void) => 
    ipcRenderer.invoke('convert-audio', inputPath, outputPath, onProgress),
  getMediaInfo: (filePath: string) => ipcRenderer.invoke('get-media-info', filePath),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  readTextFile: (filePath: string) => ipcRenderer.invoke('read-text-file', filePath),
  getValidToken: () => ipcRenderer.invoke('get-valid-token'),
  saveToken: (token: string) => ipcRenderer.invoke('save-token', token),
  clearToken: () => ipcRenderer.invoke('clear-token'),
  resetAllSettings: () => ipcRenderer.invoke('reset-all-settings'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  onExternalFileOpen: (callback: (event: any, filePath: string) => void) => 
    ipcRenderer.on('open-file-from-external', callback),
  removeExternalFileListener: (callback: (event: any, filePath: string) => void) => 
    ipcRenderer.removeListener('open-file-from-external', callback),
  onExternalFilesOpen: (callback: (event: any, filePaths: string[]) => void) => 
    ipcRenderer.on('open-files-from-external', callback),
  removeExternalFilesListener: (callback: (event: any, filePaths: string[]) => void) => 
    ipcRenderer.removeListener('open-files-from-external', callback),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'), 
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback: (event: any, status: { event: string, message: string }) => void) => 
    ipcRenderer.on('update-status', callback),
  removeUpdateStatusListener: (callback: (event: any, status: { event: string, message: string }) => void) => 
    ipcRenderer.removeListener('update-status', callback),
  onKeyboardShortcut: (callback: (event: any, shortcut: string) => void) => 
    ipcRenderer.on('keyboard-shortcut', callback),
  removeKeyboardShortcutListener: (callback: (event: any, shortcut: string) => void) => 
    ipcRenderer.removeListener('keyboard-shortcut', callback),
  checkFileAssociations: () => ipcRenderer.invoke('check-file-associations'),
  registerFileAssociations: () => ipcRenderer.invoke('register-file-associations'),
  testFfmpegPath: (path: string) => ipcRenderer.invoke('test-ffmpeg-path', path),
  openFfmpegDialog: () => ipcRenderer.invoke('open-ffmpeg-dialog'),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;