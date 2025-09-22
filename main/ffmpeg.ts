import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';

export class FFmpegManager {
  private ffmpegPath: string | null = null;
  private isInitialized = false;
  private debugLevel: number = 0;

  setDebugLevel(level: number): void {
    this.debugLevel = level;
  }

  private debug(level: number, category: string, message: string, ...args: any[]) {
    if (this.debugLevel >= level) {
      console.log(`[${category}] ${message}`, ...args);
    }
  }

  async initialize(customPath?: string): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      // Try custom path first if provided
      if (customPath && customPath.trim()) {
        this.debug(2, 'FFmpeg', `Trying custom FFmpeg path: ${customPath}`);
        if (await this.testFFmpegPath(customPath)) {
          this.ffmpegPath = customPath;
          ffmpeg.setFfmpegPath(this.ffmpegPath);
          this.isInitialized = true;
          this.debug(2, 'FFmpeg', `FFmpeg using custom path: ${this.ffmpegPath}`);
          return true;
        } else {
          this.debug(1, 'FFmpeg', `Custom FFmpeg path failed, falling back to auto-detection: ${customPath}`);
        }
      }

      this.ffmpegPath = await this.findFFmpeg();
      
      if (this.ffmpegPath) {
        ffmpeg.setFfmpegPath(this.ffmpegPath);
        this.isInitialized = true;
        this.debug(2, 'FFmpeg', `FFmpeg found at: ${this.ffmpegPath}`);
        return true;
      }

      console.warn('FFmpeg not found in PATH, attempting to download...');
      await this.downloadFFmpeg();
      
      this.ffmpegPath = await this.findFFmpeg();
      if (this.ffmpegPath) {
        ffmpeg.setFfmpegPath(this.ffmpegPath);
        this.isInitialized = true;
        this.debug(2, 'FFmpeg', `FFmpeg downloaded and configured at: ${this.ffmpegPath}`);
        return true;
      }

      console.error('=== FFmpeg INITIALIZATION FAILED ===');
      console.error('FFmpeg could not be found or downloaded.');
      console.error('This will prevent media file processing and language detection.');
      console.error('Possible solutions:');
      console.error('1. Install FFmpeg using your package manager (brew install ffmpeg, apt install ffmpeg, etc.)');
      console.error('2. Set a custom FFmpeg path in Preferences');
      console.error('3. Ensure FFmpeg is in your system PATH');
      console.error('=== END FFmpeg ERROR ===');
      return false;
    } catch (error) {
      console.error('=== FFmpeg INITIALIZATION ERROR ===');
      console.error('Error initializing FFmpeg:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        customPath: customPath || 'none provided'
      });
      console.error('=== END FFmpeg ERROR ===');
      return false;
    }
  }

  private async findFFmpeg(): Promise<string | null> {
    // Try multiple approaches for better macOS compatibility
    const possiblePaths = [
      'ffmpeg', // System PATH
      '/usr/local/bin/ffmpeg', // Homebrew default (Intel)
      '/opt/homebrew/bin/ffmpeg', // Homebrew default (Apple Silicon)
      '/usr/bin/ffmpeg', // System default
      '/usr/local/Cellar/ffmpeg', // Alternative Homebrew location
      process.env.FFMPEG_PATH // User-defined environment variable
    ].filter(Boolean); // Remove any undefined values

    this.debug(3, 'FFmpeg', '=== FFmpeg PATH DETECTION START ===');
    this.debug(3, 'FFmpeg', 'Searching for FFmpeg in multiple locations...');
    this.debug(3, 'FFmpeg', 'Possible paths to check:', possiblePaths);

    // First try the traditional 'which' command
    this.debug(3, 'FFmpeg', 'Step 1: Trying which/where command...');
    const whichResult = await this.tryWhichCommand();
    if (whichResult) {
      this.debug(2, 'FFmpeg', `✅ FFmpeg found via 'which' command: ${whichResult}`);
      return whichResult;
    }
    this.debug(3, 'FFmpeg', '❌ which/where command failed or returned no result');

    // Then try each possible path
    this.debug(3, 'FFmpeg', 'Step 2: Testing predefined paths...');
    for (const testPath of possiblePaths) {
      if (testPath) {
        this.debug(3, 'FFmpeg', `  Testing: ${testPath}`);
        if (await this.testFFmpegPath(testPath)) {
          this.debug(2, 'FFmpeg', `  ✅ FFmpeg found at: ${testPath}`);
          return testPath;
        }
        this.debug(3, 'FFmpeg', `  ❌ Failed: ${testPath}`);
      }
    }

    // If all else fails, try to find it via Homebrew
    this.debug(3, 'FFmpeg', 'Step 3: Trying Homebrew detection...');
    const brewResult = await this.tryHomebrewPath();
    if (brewResult) {
      this.debug(2, 'FFmpeg', `✅ FFmpeg found via Homebrew: ${brewResult}`);
      return brewResult;
    }
    this.debug(3, 'FFmpeg', '❌ Homebrew detection failed');

    this.debug(3, 'FFmpeg', '=== FFmpeg PATH DETECTION END ===');
    this.debug(1, 'FFmpeg', '⚠️  FFmpeg not found in any standard locations');
    return null;
  }

  private async tryWhichCommand(): Promise<string | null> {
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

  private async testFFmpegPath(path: string): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn(path, ['-version'], { stdio: 'pipe' });
      
      child.on('close', (code) => {
        resolve(code === 0);
      });

      child.on('error', () => {
        resolve(false);
      });

      // Timeout after 5 seconds
      setTimeout(() => {
        child.kill();
        resolve(false);
      }, 5000);
    });
  }

  private async tryHomebrewPath(): Promise<string | null> {
    return new Promise((resolve) => {
      const child = spawn('brew', ['--prefix', 'ffmpeg'], { stdio: 'pipe' });
      
      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0 && output.trim()) {
          const brewPath = path.join(output.trim(), 'bin', 'ffmpeg');
          this.testFFmpegPath(brewPath).then((isValid) => {
            resolve(isValid ? brewPath : null);
          });
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
        this.debug(2, 'FFmpeg', 'Using ffmpeg-static binary');
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
    onProgress?: (progress: number) => void,
    durationSeconds?: number
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
      
      // Add duration limit if specified (for language detection: first 3 minutes)
      if (durationSeconds) {
        command.duration(durationSeconds);
      }

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