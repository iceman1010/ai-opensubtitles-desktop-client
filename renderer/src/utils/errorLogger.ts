export interface ErrorLogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error';
  category: string;
  message: string;
  data?: any;
}

class ErrorLogger {
  private logs: ErrorLogEntry[] = [];
  private maxLogs = 1000;
  private debugLevel = 0; // Default debug level

  setDebugLevel(level: number) {
    this.debugLevel = level;
  }

  getDebugLevel(): number {
    return this.debugLevel;
  }

  private shouldLog(level: 'info' | 'warn' | 'error', category: string): boolean {
    // Always log errors and warnings regardless of debug level
    if (level === 'error' || level === 'warn') {
      return true;
    }

    // For info level, check debug level
    if (this.debugLevel === 0) {
      // Silent - only show errors and warnings
      return false;
    } else if (this.debugLevel === 1) {
      // Basic - show essential info only (non-polling/verbose operations)
      return !category.includes('polling') && !category.includes('🔍');
    } else if (this.debugLevel === 2) {
      // Verbose - show most info but filter out some repetitive messages
      return !category.includes('🔍') || !message.includes('Polling attempt');
    } else {
      // Full (level 3+) - show everything
      return true;
    }
  }

  log(level: 'info' | 'warn' | 'error', category: string, message: string, data?: any) {
    const entry: ErrorLogEntry = {
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data: data ? JSON.parse(JSON.stringify(data)) : undefined
    };

    this.logs.push(entry);

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs);
    }

    // Only log to console if debug level allows it
    if (this.shouldLog(level, category)) {
      const logMessage = `[${category}] ${message}`;
      const dataStr = data !== undefined ? ` ${JSON.stringify(data)}` : '';
      const fullMessage = logMessage + dataStr;

      if (level === 'error') {
        console.error(logMessage, data);
      } else if (level === 'warn') {
        console.warn(logMessage, data);
      } else {
        console.log(logMessage, data);
      }

      // Also output to terminal in dev mode
      if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
        try {
          // Send to main process for terminal output
          if (typeof window !== 'undefined' && (window as any).electronAPI?.logToTerminal) {
            (window as any).electronAPI.logToTerminal(fullMessage);
          }
        } catch (e) {
          // Ignore if not available
        }
      }
    }
  }

  info(category: string, message: string, data?: any) {
    this.log('info', category, message, data);
  }

  warn(category: string, message: string, data?: any) {
    this.log('warn', category, message, data);
  }

  error(category: string, message: string, data?: any) {
    this.log('error', category, message, data);
  }

  debug(level: number, category: string, message: string, data?: any) {
    // Only log if current debug level is >= requested level
    if (this.debugLevel >= level) {
      this.log('info', category, message, data);
    }
  }

  getLogs(): ErrorLogEntry[] {
    return [...this.logs];
  }

  getLogsAsText(): string {
    return this.logs.map(log => {
      const dataStr = log.data ? ` | Data: ${JSON.stringify(log.data, null, 2)}` : '';
      return `[${log.timestamp}] [${log.level.toUpperCase()}] [${log.category}] ${log.message}${dataStr}`;
    }).join('\n');
  }

  exportLogs(): void {
    const content = this.getLogsAsText();
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
  }

  copyLogsToClipboard(): Promise<void> {
    const content = this.getLogsAsText();
    return navigator.clipboard.writeText(content);
  }

  clear(): void {
    this.logs = [];
    console.clear();
  }

  getErrorCount(): number {
    return this.logs.filter(log => log.level === 'error').length;
  }

  getRecentErrors(minutes: number = 5): ErrorLogEntry[] {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.logs.filter(log => 
      log.level === 'error' && new Date(log.timestamp) > cutoff
    );
  }
}

export const logger = new ErrorLogger();

// Global error handler
window.addEventListener('error', (event) => {
  logger.error('WINDOW', `Uncaught error: ${event.message}`, {
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error?.toString()
  });
});

window.addEventListener('unhandledrejection', (event) => {
  logger.error('WINDOW', `Unhandled promise rejection: ${event.reason}`, {
    reason: event.reason?.toString()
  });
});