import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { app } from 'electron';
import { spawn } from 'child_process';
import ffmpeg from 'fluent-ffmpeg';

// Layered FFmpeg resolution. Adopted from lossless-cut's proven pattern:
//   1. User-supplied custom path (Preferences → "Custom FFmpeg Path")
//   2. Bundled binary at process.resourcesPath (shipped via extraResources,
//      completely outside asar — no asarUnpack / path-translation hacks)
//   3. System FFmpeg via where/which, FFMPEG_PATH env, platform standard dirs
//   4. One-time download from our GitHub release into userData/binaries/
//      (only triggered if the bundled binary is missing/quarantined and the
//      user explicitly confirms the download via dialog)
//
// Layer 2 is the load-bearing change vs. the previous ffmpeg-static design:
// the binary sits at a predictable path (process.resourcesPath/ffmpeg(.exe))
// that is always readable, regardless of where the app was launched from.

const BINARY_NAME = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';

// GitHub release that hosts the standalone ffmpeg.exe as a fallback download.
// Keep this tag in sync with the latest stable release.
const FALLBACK_RELEASE_TAG = 'v1.14.11';
const FALLBACK_DOWNLOAD_URL =
  `https://github.com/iceman1010/ai-opensubtitles-desktop-client/releases/download/${FALLBACK_RELEASE_TAG}/ffmpeg.exe`;
// SHA-256 of the ffmpeg.exe asset at FALLBACK_DOWNLOAD_URL. Used to verify
// the download (and re-verify on each launch so a corrupted cache is detected).
const FALLBACK_SHA256_WIN = '04e1307997530f9cf2fe35cba2ca7e8875ca91da02f89d6c7243df819c94ad00';

export interface FFmpegResolution {
  path: string;
  source: 'custom' | 'bundled' | 'system' | 'download';
}

export interface FFmpegInitOptions {
  /** Optional custom path supplied from Preferences. Can be a directory
   * containing ffmpeg.exe, or a full path to the binary itself. */
  customPath?: string;
  /** Called when layers 1-3 all failed and Layer 4 download is about to be
   * attempted. Should show a modal asking the user to confirm the download.
   * Return true to proceed, false to abort. */
  confirmDownload?: () => Promise<boolean>;
  /** Optional progress callback for Layer 4 download. percent is 0-100. */
  onDownloadProgress?: (percent: number) => void;
}

export class FFmpegManager {
  private ffmpegPath: string | null = null;
  private resolutionSource: FFmpegResolution['source'] | null = null;
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

  async initialize(options: FFmpegInitOptions = {}): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      const { customPath, confirmDownload, onDownloadProgress } = options;

      // Layer 1 — user-supplied path (Preferences)
      if (customPath && customPath.trim()) {
        this.debug(2, 'FFmpeg', `Layer 1: trying custom path: ${customPath}`);
        const resolved = this.resolveCustomPath(customPath);
        if (resolved && await this.testFFmpegPath(resolved)) {
          this.applyPath(resolved, 'custom');
          return true;
        }
        this.debug(1, 'FFmpeg', 'Layer 1: custom path failed, falling through');
      }

      // Layer 2 — bundled binary at process.resourcesPath (extraResources).
      // This is the load-bearing fix: outside asar, always readable, signed
      // with the installer.
      const bundled = this.getBundledPath();
      this.debug(2, 'FFmpeg', `Layer 2: trying bundled: ${bundled}`);
      if (await this.testFFmpegPath(bundled)) {
        this.applyPath(bundled, 'bundled');
        return true;
      }
      this.debug(2, 'FFmpeg', 'Layer 2: bundled not present or not executable');

      // Layer 3 — system FFmpeg via where/which + platform standard locations
      this.debug(2, 'FFmpeg', 'Layer 3: searching system PATH and standard locations');
      const systemPath = await this.findSystemFFmpeg();
      if (systemPath) {
        this.applyPath(systemPath, 'system');
        return true;
      }

      // Layer 4 — staged download from our GitHub release into userData.
      // Only attempt if (a) we already have a cached copy from a prior
      // download, OR (b) the user confirms the download via dialog.
      this.debug(2, 'FFmpeg', 'Layer 4: considering staged/download fallback');
      const staged = await this.tryStagedCopy();
      if (staged) {
        this.applyPath(staged, 'download');
        return true;
      }

      if (confirmDownload) {
        const approved = await confirmDownload();
        if (approved) {
          const downloaded = await this.downloadToUserData(onDownloadProgress);
          if (downloaded) {
            this.applyPath(downloaded, 'download');
            return true;
          }
        }
      }

      this.logPlatformSpecificError();
      return false;
    } catch (error) {
      console.error('=== FFmpeg INITIALIZATION ERROR ===');
      console.error('Error initializing FFmpeg:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack trace',
        customPath: options.customPath || 'none provided'
      });
      console.error('=== END FFmpeg ERROR ===');
      return false;
    }
  }

  /** Resolve a user-entered path to a concrete ffmpeg binary path. Accepts
   * either a directory containing ffmpeg(.exe) or a full file path. */
  private resolveCustomPath(customPath: string): string | null {
    const trimmed = customPath.trim();
    if (!trimmed) return null;
    try {
      const stat = fs.statSync(trimmed);
      if (stat.isDirectory()) {
        return path.join(trimmed, BINARY_NAME);
      }
      return trimmed;
    } catch {
      // stat failed — maybe it's a bare 'ffmpeg' resolvable via PATH
      return trimmed;
    }
  }

  /** Path to the binary shipped via electron-builder `extraResources`. */
  private getBundledPath(): string {
    // process.resourcesPath is set by Electron and points to the resources
    // directory of the app (next to app.asar on Windows/Linux, inside
    // Contents/Resources on macOS). It is undefined during local dev when
    // not running through Electron — fall back to the dev tree layout.
    const resourcesPath = process.resourcesPath || path.join(__dirname, '..', '..', 'ffmpeg', `${process.platform}-${process.arch}`, 'lib');
    return path.join(resourcesPath, BINARY_NAME);
  }

  /** Where staged/downloaded binaries live: app.getPath('userData')/binaries.
   * Always writable regardless of where the app was launched from
   * (installed, portable, temp dir, AppImage). */
  private getStagedDir(): string {
    return path.join(app.getPath('userData'), 'binaries');
  }

  private getStagedPath(): string {
    return path.join(this.getStagedDir(), BINARY_NAME);
  }

  /** Layer 4a: check userData/binaries for a previously-downloaded copy. */
  private async tryStagedCopy(): Promise<string | null> {
    const staged = this.getStagedPath();
    if (!fs.existsSync(staged)) {
      return null;
    }
    // On Windows, ensure the binary is unblocked (Zone.Identifier ADS may
    // have been written by the download). On other platforms this is a no-op.
    this.unblockBinary(staged);
    if (await this.testFFmpegPath(staged)) {
      return staged;
    }
    return null;
  }

  /** Layer 4b: download from our GitHub release into userData/binaries.
   * Verifies SHA-256 (Windows only — that's the only asset we host today). */
  private async downloadToUserData(onProgress?: (pct: number) => void): Promise<string | null> {
    if (process.platform !== 'win32') {
      // We currently only host a Windows ffmpeg.exe on the release page.
      // macOS/Linux users fall back to system/Homebrew or custom path.
      this.debug(1, 'FFmpeg', 'Layer 4: download fallback is Windows-only for now');
      return null;
    }
    const stagedDir = this.getStagedDir();
    fs.mkdirSync(stagedDir, { recursive: true });
    const dest = this.getStagedPath();
    const tmpDest = `${dest}.tmp`;

    try {
      this.debug(1, 'FFmpeg', `Layer 4: downloading ${FALLBACK_DOWNLOAD_URL} -> ${dest}`);
      await this.downloadWithProgress(FALLBACK_DOWNLOAD_URL, tmpDest, onProgress);

      // Verify SHA-256 against pinned value.
      const actualHash = await this.sha256OfFile(tmpDest);
      if (actualHash.toLowerCase() !== FALLBACK_SHA256_WIN.toLowerCase()) {
        throw new Error(`SHA-256 mismatch. Expected ${FALLBACK_SHA256_WIN}, got ${actualHash}`);
      }
      this.debug(2, 'FFmpeg', 'Layer 4: SHA-256 verified');

      // Atomic rename into place
      fs.renameSync(tmpDest, dest);
      this.unblockBinary(dest);
      return dest;
    } catch (err) {
      this.debug(1, 'FFmpeg', `Layer 4 download failed: ${err instanceof Error ? err.message : String(err)}`);
      try { fs.unlinkSync(tmpDest); } catch (_) { /* ignore */ }
      try { fs.unlinkSync(dest); } catch (_) { /* ignore partial */ }
      return null;
    }
  }

  private downloadWithProgress(url: string, destPath: string, onProgress?: (pct: number) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const https = require('https');
      const file = fs.createWriteStream(destPath);
      const req = (currentUrl: string, redirectsLeft = 5) => {
        https.get(currentUrl, (res: any) => {
          if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            if (redirectsLeft <= 0) { reject(new Error('Too many redirects')); return; }
            res.resume();
            req(res.headers.location, redirectsLeft - 1);
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          const total = parseInt(res.headers['content-length'] || '0', 10);
          let received = 0;
          res.on('data', (chunk: Buffer) => {
            received += chunk.length;
            if (onProgress && total > 0) {
              onProgress(Math.min(100, Math.round((received / total) * 100)));
            }
          });
          res.pipe(file);
          file.on('finish', () => { file.close(() => resolve()); });
        }).on('error', reject);
      };
      req(url);
    });
  }

  private sha256OfFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);
      stream.on('data', (chunk) => hash.update(chunk));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  /** On Windows, delete the Zone.Identifier ADS if present. This is what
   * PowerShell's `Unblock-File` does internally; we just touch the file
   * directly. No-op on macOS/Linux. */
  private unblockBinary(filePath: string): void {
    if (process.platform !== 'win32') return;
    try {
      // Deleting the alternate-data-stream is enough; the file itself is untouched.
      fs.unlinkSync(`${filePath}:Zone.Identifier`);
      this.debug(3, 'FFmpeg', `Unblocked (stripped Zone.Identifier): ${filePath}`);
    } catch (err: any) {
      // ENOENT means there was no MotW — that's fine.
      if (err && err.code !== 'ENOENT') {
        this.debug(2, 'FFmpeg', `Unblock skipped: ${err.message}`);
      }
    }
  }

  /** Probe for a system-installed FFmpeg. Used as Layer 3 fallback when the
   * bundled binary isn't present (e.g. dev mode without ffmpeg/ tree, or
   * broken install). */
  private async findSystemFFmpeg(): Promise<string | null> {
    const possiblePaths = this.getSystemSearchPaths();

    this.debug(3, 'FFmpeg', '=== Layer 3 PATH DETECTION ===');
    this.debug(3, 'FFmpeg', `Platform: ${process.platform}, Arch: ${process.arch}`);

    // 3a. Try which/where
    const whichResult = await this.tryWhichCommand();
    if (whichResult) {
      this.debug(2, 'FFmpeg', `Layer 3: found via PATH: ${whichResult}`);
      return whichResult;
    }

    // 3b. Try platform-specific predefined paths
    for (const testPath of possiblePaths) {
      if (testPath && await this.testFFmpegPath(testPath)) {
        this.debug(2, 'FFmpeg', `Layer 3: found at: ${testPath}`);
        return testPath;
      }
    }

    // 3c. macOS Homebrew detection
    if (process.platform === 'darwin') {
      const brewResult = await this.tryHomebrewPath();
      if (brewResult) return brewResult;
    }

    return null;
  }

  private getSystemSearchPaths(): string[] {
    const paths: string[] = [];
    if (process.env.FFMPEG_PATH) paths.push(process.env.FFMPEG_PATH);

    switch (process.platform) {
      case 'win32':
        paths.push(
          'ffmpeg',
          'C:\\ffmpeg\\bin\\ffmpeg.exe',
          'C:\\Program Files\\ffmpeg\\bin\\ffmpeg.exe',
          'C:\\Program Files (x86)\\ffmpeg\\bin\\ffmpeg.exe',
          path.join(process.env.LOCALAPPDATA || '', 'ffmpeg', 'bin', 'ffmpeg.exe'),
          path.join(process.env.PROGRAMFILES || '', 'ffmpeg', 'bin', 'ffmpeg.exe'),
          path.join(process.env['PROGRAMFILES(X86)'] || '', 'ffmpeg', 'bin', 'ffmpeg.exe')
        );
        break;
      case 'darwin':
        paths.push(
          'ffmpeg',
          '/usr/local/bin/ffmpeg',
          '/opt/homebrew/bin/ffmpeg',
          '/usr/bin/ffmpeg',
          '/opt/local/bin/ffmpeg',
          path.join(process.env.HOME || '', 'bin', 'ffmpeg')
        );
        break;
      case 'linux':
      default:
        paths.push(
          'ffmpeg',
          '/usr/bin/ffmpeg',
          '/usr/local/bin/ffmpeg',
          '/opt/ffmpeg/bin/ffmpeg',
          '/snap/bin/ffmpeg',
          '/var/lib/flatpak/exports/bin/ffmpeg',
          path.join(process.env.HOME || '', 'bin', 'ffmpeg'),
          path.join(process.env.HOME || '', '.local', 'bin', 'ffmpeg')
        );
        break;
    }
    return paths.filter(Boolean);
  }

  private async tryWhichCommand(): Promise<string | null> {
    return new Promise((resolve) => {
      const isWindows = process.platform === 'win32';
      const command = isWindows ? 'where' : 'which';
      const child = spawn(command, ['ffmpeg'], { stdio: 'pipe' });

      let output = '';
      child.stdout.on('data', (data) => { output += data.toString(); });
      child.on('close', (code) => {
        if (code === 0 && output.trim()) {
          resolve(output.trim().split('\n')[0].trim());
        } else {
          resolve(null);
        }
      });
      child.on('error', () => resolve(null));
    });
  }

  private async tryHomebrewPath(): Promise<string | null> {
    return new Promise((resolve) => {
      const child = spawn('brew', ['--prefix'], { stdio: 'pipe' });
      let output = '';
      child.stdout.on('data', (data) => { output += data.toString(); });
      child.on('close', async (code) => {
        if (code === 0 && output.trim()) {
          const brewPath = path.join(output.trim(), 'bin', 'ffmpeg');
          if (await this.testFFmpegPath(brewPath)) {
            resolve(brewPath);
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      });
      child.on('error', () => resolve(null));
    });
  }

  private async testFFmpegPath(target: string): Promise<boolean> {
    return new Promise((resolve) => {
      // For BtbN shared builds on Linux, the binary needs LD_LIBRARY_PATH
      // pointing at the directory containing lib*.so. For the bundled case
      // that's process.resourcesPath; for staged copies we set it to the
      // parent dir. For a plain system ffmpeg this env is harmless.
      const env = { ...process.env };
      const libDir = path.dirname(target);
      if (process.platform === 'linux') {
        env.LD_LIBRARY_PATH = [libDir, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
      }
      try {
        const child = spawn(target, ['-version'], { stdio: 'pipe', env });
        const timer = setTimeout(() => {
          try { child.kill(); } catch (_) { /* ignore */ }
          resolve(false);
        }, 5000);
        child.on('close', (code) => {
          clearTimeout(timer);
          resolve(code === 0);
        });
        child.on('error', () => {
          clearTimeout(timer);
          resolve(false);
        });
      } catch {
        resolve(false);
      }
    });
  }

  private applyPath(p: string, source: FFmpegResolution['source']): void {
    this.ffmpegPath = p;
    this.resolutionSource = source;
    ffmpeg.setFfmpegPath(p);
    this.isInitialized = true;
    this.debug(1, 'FFmpeg', `✅ FFmpeg ready via ${source}: ${p}`);
  }

  /** fluent-ffmpeg spawns ffmpeg as a child process. On Linux we need to
   * make sure LD_LIBRARY_PATH is set for the bundled binary's directory
   * (and for the staged dir if we're using Layer 4). Set it globally here
   * so child processes inherit it. */
  private ensureLibPathForSpawn(): void {
    if (process.platform !== 'linux') return;
    if (!this.ffmpegPath) return;
    const libDir = path.dirname(this.ffmpegPath);
    const existing = process.env.LD_LIBRARY_PATH || '';
    if (!existing.split(':').includes(libDir)) {
      process.env.LD_LIBRARY_PATH = [libDir, existing].filter(Boolean).join(':');
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.ffmpegPath !== null;
  }

  getFFmpegPath(): string | null {
    return this.ffmpegPath;
  }

  getResolutionSource(): FFmpegResolution['source'] | null {
    return this.resolutionSource;
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
    this.ensureLibPathForSpawn();

    const outputFile = outputPath || this.generateOutputPath(inputPath, '.mp3');

    return new Promise((resolve, reject) => {
      const command = ffmpeg(inputPath)
        .toFormat('mp3')
        .audioCodec('libmp3lame')
        .audioChannels(1)
        .audioFrequency(16000)
        .output(outputFile);

      if (durationSeconds) {
        command.duration(durationSeconds);
      }

      if (onProgress) {
        command.on('progress', (progress: any) => {
          onProgress(progress.percent || 0);
        });
      }

      command
        .on('end', () => { resolve(outputFile); })
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
    this.ensureLibPathForSpawn();

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
        .on('end', () => { resolve(outputFile); })
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
    this.ensureLibPathForSpawn();

    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(filePath, (error: any, metadata: any) => {
        if (error) {
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

        if (!metadata || !metadata.streams || metadata.streams.length === 0) {
          reject(new Error('File contains no readable media streams'));
          return;
        }

        const hasAudio = metadata.streams.some((stream: any) => stream.codec_type === 'audio');
        const hasVideo = metadata.streams.some((stream: any) => stream.codec_type === 'video');

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
    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const uniqueName = `${parsedPath.name}_converted_${timestamp}${extension}`;
    return path.join(tempDir, uniqueName);
  }

  private logPlatformSpecificError(): void {
    console.error('=== FFmpeg INITIALIZATION FAILED ===');
    console.error('FFmpeg could not be located via any of: bundled binary, system PATH,');
    console.error('or previously-downloaded copy. The user can supply a custom path in');
    console.error('Preferences, or trigger a one-time download from there.');
    console.error('');
    console.error(`Platform: ${process.platform} ${process.arch}`);
    console.error(`Bundled path tried: ${this.getBundledPath()}`);
    console.error(`Staged path checked: ${this.getStagedPath()}`);
    console.error('=== END FFmpeg ERROR ===');
  }
}
