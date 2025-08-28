import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';

export class FFmpegManager {
  private ffmpegPath: string | null = null;
  private isInitialized = false;

  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      this.ffmpegPath = await this.findFFmpeg();
      
      if (this.ffmpegPath) {
        ffmpeg.setFfmpegPath(this.ffmpegPath);
        this.isInitialized = true;
        console.log(`FFmpeg found at: ${this.ffmpegPath}`);
        return true;
      }

      console.warn('FFmpeg not found in PATH, attempting to download...');
      await this.downloadFFmpeg();
      
      this.ffmpegPath = await this.findFFmpeg();
      if (this.ffmpegPath) {
        ffmpeg.setFfmpegPath(this.ffmpegPath);
        this.isInitialized = true;
        console.log(`FFmpeg downloaded and configured at: ${this.ffmpegPath}`);
        return true;
      }

      console.error('Failed to initialize FFmpeg');
      return false;
    } catch (error) {
      console.error('Error initializing FFmpeg:', error);
      return false;
    }
  }

  private async findFFmpeg(): Promise<string | null> {
    return new Promise((resolve) => {
      const child = spawn('which', ['ffmpeg'], { stdio: 'pipe' });
      
      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0 && output.trim()) {
          resolve(output.trim());
        } else {
          resolve(null);
        }
      });

      child.on('error', () => {
        resolve(null);
      });
    });
  }

  private async downloadFFmpeg(): Promise<void> {
    try {
      const ffmpegStatic = require('ffmpeg-static');
      if (ffmpegStatic && fs.existsSync(ffmpegStatic)) {
        this.ffmpegPath = ffmpegStatic;
        console.log('Using ffmpeg-static binary');
      }
    } catch (error) {
      console.error('Failed to use ffmpeg-static:', error);
      throw new Error('FFmpeg is required but not available');
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.ffmpegPath !== null;
  }

  async extractAudioFromVideo(
    inputPath: string,
    outputPath?: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    if (!this.isReady()) {
      throw new Error('FFmpeg is not ready. Call initialize() first.');
    }

    const outputFile = outputPath || this.generateOutputPath(inputPath, '.mp3');

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .toFormat('mp3')
        .audioCodec('libmp3lame')
        .audioChannels(1)
        .audioFrequency(16000)
        .output(outputFile);

      if (onProgress) {
        command.on('progress', (progress: any) => {
          onProgress(progress.percent || 0);
        });
      }

      command
        .on('end', () => {
          resolve(outputFile);
        })
        .on('error', (error: any) => {
          reject(new Error(`FFmpeg error: ${error.message}`));
        })
        .run();
    });
  }

  async convertAudioToMp3(
    inputPath: string,
    outputPath?: string,
    onProgress?: (progress: number) => void
  ): Promise<string> {
    if (!this.isReady()) {
      throw new Error('FFmpeg is not ready. Call initialize() first.');
    }

    const outputFile = outputPath || this.generateOutputPath(inputPath, '.mp3');

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .toFormat('mp3')
        .audioCodec('libmp3lame')
        .audioChannels(1)
        .audioFrequency(16000)
        .output(outputFile);

      if (onProgress) {
        command.on('progress', (progress: any) => {
          onProgress(progress.percent || 0);
        });
      }

      command
        .on('end', () => {
          resolve(outputFile);
        })
        .on('error', (error: any) => {
          reject(new Error(`FFmpeg error: ${error.message}`));
        })
        .run();
    });
  }

  async getMediaInfo(filePath: string): Promise<{
    duration?: number;
    hasAudio: boolean;
    hasVideo: boolean;
    format?: string;
  }> {
    if (!this.isReady()) {
      throw new Error('FFmpeg is not ready. Call initialize() first.');
    }

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (error: any, metadata: any) => {
        if (error) {
          // Provide more user-friendly error messages
          let errorMessage = 'File is not a valid media file';
          
          if (error.message.includes('No such file')) {
            errorMessage = 'File not found or cannot be accessed';
          } else if (error.message.includes('Invalid data found when processing input')) {
            errorMessage = 'File is not a valid media file (appears to be a different file type)';
          } else if (error.message.includes('Invalid data') || error.message.includes('not supported')) {
            errorMessage = 'Unsupported file format or corrupted file';
          } else if (error.message.includes('Permission denied')) {
            errorMessage = 'Permission denied accessing the file';
          } else if (error.message.includes('ffprobe exited with code')) {
            errorMessage = 'File is not a valid media file';
          }
          
          reject(new Error(errorMessage));
          return;
        }

        // Check if metadata is valid
        if (!metadata || !metadata.streams || metadata.streams.length === 0) {
          reject(new Error('File contains no readable media streams'));
          return;
        }

        const hasAudio = metadata.streams.some((stream: any) => stream.codec_type === 'audio');
        const hasVideo = metadata.streams.some((stream: any) => stream.codec_type === 'video');

        // Additional validation
        if (!hasAudio && !hasVideo) {
          reject(new Error('File does not contain audio or video content'));
          return;
        }

        resolve({
          duration: metadata.format.duration,
          hasAudio,
          hasVideo,
          format: metadata.format.format_name,
        });
      });
    });
  }

  private generateOutputPath(inputPath: string, extension: string): string {
    const parsedPath = path.parse(inputPath);
    return path.join(parsedPath.dir, `${parsedPath.name}_converted${extension}`);
  }

  getFFmpegPath(): string | null {
    return this.ffmpegPath;
  }
}