import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
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

      this.logPlatformSpecificError();
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
    // Get platform-specific possible paths
    const possiblePaths = this.getPlatformSpecificPaths();

    this.debug(3, 'FFmpeg', '=== FFmpeg PATH DETECTION START ===');
    this.debug(3, 'FFmpeg', `Platform: ${process.platform}, Architecture: ${process.arch}`);
    this.debug(3, 'FFmpeg', 'Searching for FFmpeg in multiple locations...');
    this.debug(3, 'FFmpeg', 'Possible paths to check:', possiblePaths);

    // Step 1: Try system PATH via which/where command
    this.debug(3, 'FFmpeg', 'Step 1: Trying system PATH via which/where command...');
    const whichResult = await this.tryWhichCommand();
    if (whichResult) {
      this.debug(2, 'FFmpeg', `✅ FFmpeg found via system PATH: ${whichResult}`);
      return whichResult;
    }
    this.debug(3, 'FFmpeg', '❌ System PATH search failed');

    // Step 2: Try predefined platform-specific paths
    this.debug(3, 'FFmpeg', 'Step 2: Testing platform-specific predefined paths...');
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

    // Step 3: Try package manager detection (Homebrew on macOS)
    if (process.platform === 'darwin') {
      this.debug(3, 'FFmpeg', 'Step 3: Trying Homebrew detection...');
      const brewResult = await this.tryHomebrewPath();
      if (brewResult) {
        this.debug(2, 'FFmpeg', `✅ FFmpeg found via Homebrew: ${brewResult}`);
        return brewResult;
      }
      this.debug(3, 'FFmpeg', '❌ Homebrew detection failed');
    }

    this.debug(3, 'FFmpeg', '=== FFmpeg PATH DETECTION END ===');
    this.debug(1, 'FFmpeg', '⚠️  FFmpeg not found in any standard locations');
    return null;
  }

  private getPlatformSpecificPaths(): string[] {
    const paths: string[] = [];

    // Always include user-defined environment variable first
    if (process.env.FFMPEG_PATH) {
      paths.push(process.env.FFMPEG_PATH);
    }

    switch (process.platform) {
      case 'win32':
        // Windows-specific paths
        paths.push(
          'ffmpeg', // System PATH (if user installed)
          'C:\\ffmpeg\\bin\\ffmpeg.exe', // Common manual installation
          'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
          'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe',
          path.join(process.env.LOCALAPPDATA || '', 'ffmpeg', 'bin', 'ffmpeg.exe'),
          path.join(process.env.PROGRAMFILES || '', 'ffmpeg', 'bin', 'ffmpeg.exe'),
          path.join(process.env['PROGRAMFILES(X86)'] || '', 'ffmpeg', 'bin', 'ffmpeg.exe')
        );
        break;

      case 'darwin':
        // macOS-specific paths (Intel + Apple Silicon)
        paths.push(
          'ffmpeg', // System PATH
          '/usr/local/bin/ffmpeg', // Homebrew Intel Mac
          '/opt/homebrew/bin/ffmpeg', // Homebrew Apple Silicon Mac
          '/usr/bin/ffmpeg', // System default
          '/usr/local/Cellar/ffmpeg', // Alternative Homebrew location (will be tested with bin/ appended)
          '/opt/local/bin/ffmpeg', // MacPorts
          '/Applications/ffmpeg', // Some app-style installations
          path.join(process.env.HOME || '', 'bin', 'ffmpeg') // User local installation
        );
        break;

      case 'linux':
      default:
        // Linux and other Unix-like systems
        paths.push(
          'ffmpeg', // System PATH
          '/usr/bin/ffmpeg', // System package manager
          '/usr/local/bin/ffmpeg', // Manual/source installation
          '/opt/ffmpeg/bin/ffmpeg', // Alternative installation
          '/snap/bin/ffmpeg', // Snap package
          '/var/lib/flatpak/exports/bin/ffmpeg', // Flatpak
          path.join(process.env.HOME || '', 'bin', 'ffmpeg'), // User local installation
          path.join(process.env.HOME || '', '.local', 'bin', 'ffmpeg') // User local installation (newer convention)
        );
        break;
    }

    return paths.filter(Boolean); // Remove any undefined/empty paths
  }

  private async tryWhichCommand(): Promise<string | null> {
    return new Promise((resolve) => {
      // Use platform-appropriate command for finding executables
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 'where' : 'which';
      const args = ['ffmpeg'];

      this.debug(3, 'FFmpeg', `Using ${command} command for platform: ${process.platform}`);

      const child = spawn(command, args, { stdio: 'pipe' });

      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', (code) => {
        if (code === 0 && output.trim()) {
          // Windows 'where' command can return multiple paths, take the first one
          const firstPath = output.trim().split('\n')[0].trim();
          this.debug(3, 'FFmpeg', `${command} command found: ${firstPath}`);
          resolve(firstPath);
        } else {
          this.debug(3, 'FFmpeg', `${command} command failed with code: ${code}`);
          resolve(null);
        }
      });

      child.on('error', (error) => {
        this.debug(3, 'FFmpeg', `${command} command error:`, error.message);
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
      // First, get the general Homebrew prefix (more reliable than ffmpeg-specific prefix)
      const child = spawn('brew', ['--prefix'], { stdio: 'pipe' });

      let output = '';
      child.stdout.on('data', (data) => {
        output += data.toString();
      });

      child.on('close', async (code) => {
        if (code === 0 && output.trim()) {
          const brewPrefix = output.trim();
          const brewPath = path.join(brewPrefix, 'bin', 'ffmpeg');

          this.debug(3, 'FFmpeg', `Testing Homebrew path: ${brewPath}`);

          const isValid = await this.testFFmpegPath(brewPath);
          if (isValid) {
            this.debug(3, 'FFmpeg', `✅ Found FFmpeg via Homebrew: ${brewPath}`);
            resolve(brewPath);
          } else {
            this.debug(3, 'FFmpeg', `❌ Homebrew FFmpeg not found at: ${brewPath}`);
            resolve(null);
          }
        } else {
          this.debug(3, 'FFmpeg', `❌ Homebrew not found or failed (exit code: ${code})`);
          resolve(null);
        }
      });

      child.on('error', (error) => {
        this.debug(3, 'FFmpeg', `❌ Homebrew command error: ${error.message}`);
        resolve(null);
      });
    });
  }

  private async downloadFFmpeg(): Promise<void> {
    this.debug(2, 'FFmpeg', 'Attempting to use ffmpeg-static fallback...');

    let ffmpegStatic: string | null = null;
    try {
      ffmpegStatic = require('ffmpeg-static');
      this.debug(3, 'FFmpeg', `ffmpeg-static returned path: ${ffmpegStatic}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      console.error(`[FFmpeg] ffmpeg-static module failed to load: ${reason}`);
      if (reason.includes('Cannot find module')) {
        console.error('[FFmpeg] ffmpeg-static dependency is missing from the package');
      }
    }

    if (ffmpegStatic) {
      // When packaged, the binary lives inside app.asar and cannot be executed.
      // electron-builder unpacks it (via asarUnpack) to app.asar.unpacked.
      // Translate the asar path to the real on-disk location so spawn works.
      let realPath = ffmpegStatic;
      if (realPath.includes('app.asar')) {
        realPath = realPath.replace(/\bapp\.asar\b/, 'app.asar.unpacked');
        this.debug(2, 'FFmpeg', `Translated asar path -> unpacked: ${realPath}`);
      }

      if (fs.existsSync(realPath)) {
        const isExecutable = await this.testFFmpegPath(realPath);
        if (isExecutable) {
          this.ffmpegPath = realPath;
          this.debug(2, 'FFmpeg', `Using ffmpeg-static binary: ${realPath}`);
          return;
        } else {
          console.error(`[FFmpeg] ffmpeg-static binary exists but is NOT executable: ${realPath}`);
        }
      } else if (fs.existsSync(ffmpegStatic)) {
        // existsSync passed on the asar path (Electron fs shim) but the real
        // unpacked file is missing — asarUnpack likely not applied to this build.
        console.error(`[FFmpeg] ffmpeg-static binary is trapped inside app.asar (asarUnpack missing): ${ffmpegStatic}`);
        console.error(`[FFmpeg] Expected unpacked location: ${realPath}`);
      } else {
        console.error(`[FFmpeg] ffmpeg-static binary path does not exist: ${ffmpegStatic}`);
      }
    } else if (ffmpegStatic === null) {
      // require succeeded but returned null (unsupported platform/arch)
      console.error('[FFmpeg] ffmpeg-static returned null — platform/arch unsupported for bundled binary');
    }

    // If we reach here, ffmpeg-static failed
    const errorMsg = 'FFmpeg is required but not available. Please install FFmpeg on your system or check the application logs for details.';
    console.error(`[FFmpeg] ${errorMsg}`);
    throw new Error(errorMsg);
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
    // Use system temp directory instead of input file directory for better cross-platform support
    const tempDir = os.tmpdir();
    // Generate unique filename with timestamp to prevent conflicts
    const timestamp = Date.now();
    const uniqueName = `${parsedPath.name}_converted_${timestamp}${extension}`;
    return path.join(tempDir, uniqueName);
  }

  private logPlatformSpecificError(): void {
    console.error('=== FFmpeg INITIALIZATION FAILED ===');
    console.error('FFmpeg could not be found or downloaded.');
    console.error('This will prevent media file processing and language detection.');
    console.error('');

    switch (process.platform) {
      case 'win32':
        console.error('🪟 Windows Solutions:');
        console.error('1. Download FFmpeg from https://ffmpeg.org/download.html#build-windows');
        console.error('2. Extract to C:\\ffmpeg\\ and add C:\\ffmpeg\\bin to your PATH');
        console.error('3. Or install via package manager:');
        console.error('   • Chocolatey: choco install ffmpeg');
        console.error('   • Winget: winget install FFmpeg');
        console.error('   • Scoop: scoop install ffmpeg');
        console.error('4. Alternatively, set a custom FFmpeg path in Preferences');
        break;

      case 'darwin':
        console.error('🍎 macOS Solutions:');
        console.error('1. Install via Homebrew (recommended): brew install ffmpeg');
        console.error('2. Install via MacPorts: sudo port install ffmpeg');
        console.error('3. Download binary from https://evermeet.cx/ffmpeg/');
        console.error('4. Set a custom FFmpeg path in Preferences');
        console.error('');
        console.error('💡 Note: If using Homebrew, make sure it\'s properly configured:');
        console.error('   • Intel Mac: FFmpeg should be in /usr/local/bin/');
        console.error('   • Apple Silicon Mac: FFmpeg should be in /opt/homebrew/bin/');
        break;

      case 'linux':
      default:
        console.error('🐧 Linux Solutions:');
        console.error('1. Install via package manager:');
        console.error('   • Ubuntu/Debian: sudo apt install ffmpeg');
        console.error('   • RHEL/CentOS/Fedora: sudo dnf install ffmpeg (or yum)');
        console.error('   • Arch: sudo pacman -S ffmpeg');
        console.error('   • openSUSE: sudo zypper install ffmpeg');
        console.error('2. Install via Snap: sudo snap install ffmpeg');
        console.error('3. Install via Flatpak: flatpak install org.ffmpeg.FFmpeg');
        console.error('4. Set a custom FFmpeg path in Preferences');
        break;
    }

    console.error('');
    console.error('💡 Troubleshooting:');
    console.error('• Enable debug logging in Preferences to see detailed detection attempts');
    console.error('• Check if FFmpeg works in terminal/command prompt: ffmpeg -version');
    console.error('• Restart the application after installing FFmpeg');
    console.error('=== END FFmpeg ERROR ===');
  }

  getFFmpegPath(): string | null {
    return this.ffmpegPath;
  }
}