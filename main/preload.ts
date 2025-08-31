import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config: any) => ipcRenderer.invoke('save-config', config),
  selectFile: () => ipcRenderer.invoke('select-file'),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  readAudioFile: (filePath: string) => ipcRenderer.invoke('read-audio-file', filePath),
  saveFile: (content: string, defaultFileName: string) => ipcRenderer.invoke('save-file', content, defaultFileName),
  ffmpegReady: () => ipcRenderer.invoke('ffmpeg-ready'),
  extractAudio: (inputPath: string, outputPath?: string, onProgress?: (progress: number) => void) => 
    ipcRenderer.invoke('extract-audio', inputPath, outputPath, onProgress),
  convertAudio: (inputPath: string, outputPath?: string, onProgress?: (progress: number) => void) => 
    ipcRenderer.invoke('convert-audio', inputPath, outputPath, onProgress),
  getMediaInfo: (filePath: string) => ipcRenderer.invoke('get-media-info', filePath),
  deleteFile: (filePath: string) => ipcRenderer.invoke('delete-file', filePath),
  readTextFile: (filePath: string) => ipcRenderer.invoke('read-text-file', filePath),
  getValidToken: () => ipcRenderer.invoke('get-valid-token'),
  saveToken: (token: string) => ipcRenderer.invoke('save-token', token),
  clearToken: () => ipcRenderer.invoke('clear-token'),
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  onExternalFileOpen: (callback: (event: any, filePath: string) => void) => 
    ipcRenderer.on('open-file-from-external', callback),
  removeExternalFileListener: (callback: (event: any, filePath: string) => void) => 
    ipcRenderer.removeListener('open-file-from-external', callback),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'), 
  installUpdate: () => ipcRenderer.invoke('install-update'),
  onUpdateStatus: (callback: (event: any, status: { event: string, message: string }) => void) => 
    ipcRenderer.on('update-status', callback),
  removeUpdateStatusListener: (callback: (event: any, status: { event: string, message: string }) => void) => 
    ipcRenderer.removeListener('update-status', callback),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;