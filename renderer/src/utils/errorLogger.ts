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

    // Also log to console with appropriate level
    const logMessage = `[${category}] ${message}`;
    if (level === 'error') {
      console.error(logMessage, data);
    } else if (level === 'warn') {
      console.warn(logMessage, data);
    } else {
      console.log(logMessage, data);
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