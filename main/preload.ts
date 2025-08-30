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
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;