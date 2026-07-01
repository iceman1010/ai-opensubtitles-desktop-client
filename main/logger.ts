import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

type LogLevel = 'error' | 'warn' | 'info' | 'stage' | 'debug';

export interface CrashReport {
  startedAt: string;
  detectedAt: string;
  appVersion: string;
  platform: string;
  platformVersion: string;
  lastStage: string;
  logTail: string[];
}

const SENTINEL_FILE = '.startup-in-progress';
const CRASH_REPORT_FILE = 'crash-report.json';
const MAX_LOG_TAIL_LINES = 50;

class Logger {
  private logDir: string | null = null;
  private logFile: string | null = null;
  private initialized = false;
  private exiting = false;
  private debugLevel = 0;
  private readonly maxFileSize = 2 * 1024 * 1024; // 2 MB
  private readonly maxFiles = 5;

  init(): void {
    if (this.initialized) return;

    let logDir: string;
    try {
      logDir = path.join(app.getPath('userData'), 'logs');
    } catch {
      // Fallback if Electron's path system is unavailable — uses pure Node
      logDir = path.join(os.homedir(), '.ai-opensubtitles-logs');
    }

    try {
      fs.mkdirSync(logDir, { recursive: true });
    } catch {
      // Cannot create log dir — logging disabled, app continues
      return;
    }

    this.logDir = logDir;
    this.logFile = path.join(logDir, 'main.log');
    this.initialized = true;

    this.installConsoleCapture();
    this.checkForPreviousCrash();
    this.startNewSession();

    this.writeRaw(`\n========== SESSION START ${new Date().toISOString()} | v${this.safeAppVersion()} | ${process.platform} ${os.release()} ==========\n`);
  }

  setDebugLevel(level: number): void {
    this.debugLevel = level;
  }

  // Always-emitted levels ----------------------------------------------------

  error(category: string, message: string, data?: any): void {
    this.write('error', category, message, data);
  }

  warn(category: string, message: string, data?: any): void {
    this.write('warn', category, message, data);
  }

  stage(name: string): void {
    this.write('stage', 'STARTUP', name);
    this.updateSentinelStage(name);
  }

  // Gated levels -------------------------------------------------------------

  info(category: string, message: string, data?: any): void {
    if (this.debugLevel < 1) return;
    this.write('info', category, message, data);
  }

  debug(level: number, category: string, message: string, data?: any): void {
    if (this.debugLevel < level) return;
    this.write('debug', category, message, data);
  }

  // Sentinel lifecycle -------------------------------------------------------

  clearSentinel(): void {
    if (!this.logDir) return;
    try {
      const sentinelPath = path.join(this.logDir, SENTINEL_FILE);
      if (fs.existsSync(sentinelPath)) {
        fs.unlinkSync(sentinelPath);
      }
    } catch {
      // Swallow
    }
  }

  hasPendingCrashReport(): boolean {
    if (!this.logDir) return false;
    return fs.existsSync(path.join(this.logDir, CRASH_REPORT_FILE));
  }

  getCrashReport(): CrashReport | null {
    if (!this.logDir) return null;
    try {
      const reportPath = path.join(this.logDir, CRASH_REPORT_FILE);
      if (!fs.existsSync(reportPath)) return null;
      return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    } catch {
      return null;
    }
  }

  dismissCrashReport(): void {
    if (!this.logDir) return;
    try {
      const reportPath = path.join(this.logDir, CRASH_REPORT_FILE);
      if (fs.existsSync(reportPath)) {
        fs.unlinkSync(reportPath);
      }
    } catch {
      // Swallow
    }
  }

  // Crash exit — synchronous flush already done, just exit once
  flushAndExit(code: number = 1): void {
    if (this.exiting) return;
    this.exiting = true;
    process.exit(code);
  }

  // Internals ----------------------------------------------------------------

  private write(level: LogLevel, category: string, message: string, data?: any): void {
    if (!this.initialized) return;
    this.writeRaw(this.format(level, category, message, data));
  }

  private writeRaw(text: string): void {
    if (!this.initialized || !this.logFile) return;
    try {
      fs.appendFileSync(this.logFile, text + '\n');
      this.rotateIfNeeded();
    } catch {
      // Logging must never crash the app
    }
  }

  private format(level: LogLevel, category: string, message: string, data?: any): string {
    const ts = new Date().toISOString();
    let line = `[${ts}] [${level.toUpperCase()}] [${category}] ${message}`;
    if (data !== undefined) {
      try {
        const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
        line += ` | ${dataStr}`;
      } catch {
        line += ' | [unserializable data]';
      }
    }
    return line;
  }

  private rotateIfNeeded(): void {
    if (!this.logFile) return;
    try {
      const stats = fs.statSync(this.logFile);
      if (stats.size < this.maxFileSize) return;

      // Delete oldest rotated file
      const oldest = `${this.logFile}.${this.maxFiles - 1}`;
      if (fs.existsSync(oldest)) {
        fs.unlinkSync(oldest);
      }
      // Shift .{n} -> .{n+1} from high to low
      for (let i = this.maxFiles - 2; i >= 1; i--) {
        const src = `${this.logFile}.${i}`;
        const dst = `${this.logFile}.${i + 1}`;
        if (fs.existsSync(src)) {
          fs.renameSync(src, dst);
        }
      }
      // Current becomes .1
      fs.renameSync(this.logFile, `${this.logFile}.1`);
    } catch {
      // Swallow
    }
  }

  private installConsoleCapture(): void {
    const origError = console.error;
    const origWarn = console.warn;
    const self = this;

    console.error = (...args: any[]): void => {
      origError.apply(console, args as any);
      self.writeRaw(self.format('error', 'CONSOLE', self.argsToString(args)));
    };

    console.warn = (...args: any[]): void => {
      origWarn.apply(console, args as any);
      self.writeRaw(self.format('warn', 'CONSOLE', self.argsToString(args)));
    };
  }

  private argsToString(args: any[]): string {
    return args.map((arg) => {
      if (typeof arg === 'string') return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    }).join(' ');
  }

  private safeAppVersion(): string {
    try {
      return app.getVersion();
    } catch {
      return 'unknown';
    }
  }

  // Sentinel helpers ---------------------------------------------------------

  private sentinelPath(): string | null {
    if (!this.logDir) return null;
    return path.join(this.logDir, SENTINEL_FILE);
  }

  private startNewSession(): void {
    const sp = this.sentinelPath();
    if (!sp) return;
    try {
      const sentinel = {
        startedAt: new Date().toISOString(),
        stage: 'init',
        stageTimestamp: new Date().toISOString(),
        appVersion: this.safeAppVersion()
      };
      fs.writeFileSync(sp, JSON.stringify(sentinel, null, 2));
    } catch {
      // Swallow
    }
  }

  private updateSentinelStage(name: string): void {
    const sp = this.sentinelPath();
    if (!sp) return;
    try {
      if (!fs.existsSync(sp)) return; // already cleared (successful load)
      const existing = JSON.parse(fs.readFileSync(sp, 'utf8'));
      existing.stage = name;
      existing.stageTimestamp = new Date().toISOString();
      fs.writeFileSync(sp, JSON.stringify(existing, null, 2));
    } catch {
      // Swallow
    }
  }

  private checkForPreviousCrash(): void {
    const sp = this.sentinelPath();
    if (!sp || !fs.existsSync(sp)) return;

    try {
      const sentinel = JSON.parse(fs.readFileSync(sp, 'utf8'));
      const logTail = this.readLogTail(MAX_LOG_TAIL_LINES);

      const report: CrashReport = {
        startedAt: sentinel.startedAt || 'unknown',
        detectedAt: new Date().toISOString(),
        appVersion: this.safeAppVersion(),
        platform: process.platform,
        platformVersion: os.release(),
        lastStage: sentinel.stage || 'unknown',
        logTail
      };

      fs.writeFileSync(
        path.join(this.logDir!, CRASH_REPORT_FILE),
        JSON.stringify(report, null, 2)
      );
      fs.unlinkSync(sp);
      this.writeRaw(`[PREVIOUS-CRASH] Detected failed startup (last stage: ${report.lastStage}). Crash report saved.`);
    } catch {
      // Swallow — best-effort
    }
  }

  private readLogTail(maxLines: number): string[] {
    if (!this.logFile || !fs.existsSync(this.logFile)) return [];
    try {
      const content = fs.readFileSync(this.logFile, 'utf8');
      const lines = content.split('\n').filter((l) => l.length > 0);
      return lines.slice(-maxLines);
    } catch {
      return [];
    }
  }
}

export const logger = new Logger();
