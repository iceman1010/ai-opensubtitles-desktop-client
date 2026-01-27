import { powerSaveBlocker, ipcMain } from 'electron';

export class PowerSaveBlockerManager {
  private blockerIds: Set<number> = new Set();
  private isDebugEnabled: boolean = false;

  constructor(debugEnabled: boolean = false) {
    this.isDebugEnabled = debugEnabled;
  }

  private debug(message: string, ...args: any[]) {
    if (this.isDebugEnabled) {
      try {
        console.log(`[PowerSaveBlocker] ${message}`, ...args);
      } catch (error) {
        // Silently ignore EPIPE and other console errors
      }
    }
  }

  /**
   * Prevent system from going to sleep
   * @returns blocker ID or null if failed
   */
  preventSleep(): number | null {
    try {
      const blockerId = powerSaveBlocker.start('prevent-app-suspension');
      this.blockerIds.add(blockerId);
      this.debug(`Sleep prevention started, blocker ID: ${blockerId}`);
      return blockerId;
    } catch (error) {
      this.debug('Failed to prevent sleep:', error);
      return null;
    }
  }

  /**
   * Allow system to go to sleep (stops all active blockers)
   * @returns true if all blockers were stopped successfully
   */
  allowSleep(): boolean {
    try {
      let allStopped = true;

      for (const blockerId of this.blockerIds) {
        try {
          if (powerSaveBlocker.isStarted(blockerId)) {
            powerSaveBlocker.stop(blockerId);
            this.debug(`Sleep blocker ${blockerId} stopped`);
          }
        } catch (error) {
          this.debug(`Failed to stop blocker ${blockerId}:`, error);
          allStopped = false;
        }
      }

      this.blockerIds.clear();
      this.debug(`All sleep blockers cleared. Success: ${allStopped}`);
      return allStopped;
    } catch (error) {
      this.debug('Failed to allow sleep:', error);
      return false;
    }
  }

  /**
   * Get the number of active sleep blockers
   */
  getActiveBlockersCount(): number {
    return this.blockerIds.size;
  }

  /**
   * Force cleanup of all blockers (useful for app shutdown)
   */
  forceCleanup(): void {
    this.debug('Force cleanup of all sleep blockers');
    this.allowSleep();
  }
}

// Global instance
let powerSaveBlockerManager: PowerSaveBlockerManager | null = null;

/**
 * Initialize the PowerSaveBlocker manager and register IPC handlers
 */
export function initializePowerSaveBlocker(debugEnabled: boolean = false): PowerSaveBlockerManager {
  if (powerSaveBlockerManager) {
    return powerSaveBlockerManager;
  }

  powerSaveBlockerManager = new PowerSaveBlockerManager(debugEnabled);

  // Register IPC handlers
  ipcMain.handle('prevent-system-sleep', (): boolean => {
    if (!powerSaveBlockerManager) return false;
    const blockerId = powerSaveBlockerManager.preventSleep();
    return blockerId !== null;
  });

  ipcMain.handle('allow-system-sleep', (): boolean => {
    if (!powerSaveBlockerManager) return false;
    return powerSaveBlockerManager.allowSleep();
  });

  ipcMain.handle('get-active-sleep-blockers-count', (): number => {
    if (!powerSaveBlockerManager) return 0;
    return powerSaveBlockerManager.getActiveBlockersCount();
  });

  return powerSaveBlockerManager;
}

/**
 * Get the current PowerSaveBlocker manager instance
 */
export function getPowerSaveBlockerManager(): PowerSaveBlockerManager | null {
  return powerSaveBlockerManager;
}

/**
 * Cleanup function to call on app shutdown
 */
export function cleanupPowerSaveBlocker(): void {
  if (powerSaveBlockerManager) {
    powerSaveBlockerManager.forceCleanup();
  }
}