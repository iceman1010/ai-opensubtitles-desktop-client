/**
 * Activity Tracker - Tracks API request activity for status bar animation
 */

interface ActivityListener {
  onActivityStart: () => void;
  onActivityEnd: () => void;
}

class ActivityTracker {
  private listeners: Set<ActivityListener> = new Set();
  private activeRequests: Set<string> = new Set();
  private activityTimeout: NodeJS.Timeout | null = null;

  /**
   * Register a listener for activity events
   */
  addListener(listener: ActivityListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Start tracking an API request
   */
  startActivity(requestId: string): void {
    const wasInactive = this.activeRequests.size === 0;
    this.activeRequests.add(requestId);
    
    if (wasInactive) {
      // Clear any pending end activity timeout
      if (this.activityTimeout) {
        clearTimeout(this.activityTimeout);
        this.activityTimeout = null;
      }
      
      // Notify all listeners that activity started
      this.listeners.forEach(listener => {
        try {
          listener.onActivityStart();
        } catch (error) {
          console.error('Error in activity listener:', error);
        }
      });
    }
  }

  /**
   * End tracking an API request
   */
  endActivity(requestId: string): void {
    this.activeRequests.delete(requestId);
    
    if (this.activeRequests.size === 0) {
      // Delay the end notification slightly to avoid flicker
      // This ensures the animation shows for at least a minimum duration
      this.activityTimeout = setTimeout(() => {
        if (this.activeRequests.size === 0) {
          // Notify all listeners that activity ended
          this.listeners.forEach(listener => {
            try {
              listener.onActivityEnd();
            } catch (error) {
              console.error('Error in activity listener:', error);
            }
          });
        }
        this.activityTimeout = null;
      }, 300); // Show animation for at least 300ms
    }
  }

  /**
   * Check if there are any active requests
   */
  isActive(): boolean {
    return this.activeRequests.size > 0;
  }

  /**
   * Get the number of active requests
   */
  getActiveCount(): number {
    return this.activeRequests.size;
  }

  /**
   * Generate a unique request ID
   */
  generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export a singleton instance
export const activityTracker = new ActivityTracker();