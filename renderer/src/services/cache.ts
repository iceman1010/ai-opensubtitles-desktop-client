interface CacheItem<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class CacheManager {
  private static readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  static set<T>(key: string, data: T): void {
    const now = Date.now();
    const item: CacheItem<T> = {
      data,
      timestamp: now,
      expiresAt: now + this.CACHE_DURATION,
    };

    try {
      localStorage.setItem(`ai_opensubtitles_${key}`, JSON.stringify(item));
    } catch (error) {
      console.warn('Failed to cache data:', error);
    }
  }

  static get<T>(key: string): T | null {
    try {
      const stored = localStorage.getItem(`ai_opensubtitles_${key}`);
      if (!stored) {
        return null;
      }

      const item: CacheItem<T> = JSON.parse(stored);
      const now = Date.now();

      if (now > item.expiresAt) {
        this.remove(key);
        return null;
      }

      return item.data;
    } catch (error) {
      console.warn('Failed to retrieve cached data:', error);
      this.remove(key);
      return null;
    }
  }

  static remove(key: string): void {
    try {
      localStorage.removeItem(`ai_opensubtitles_${key}`);
    } catch (error) {
      console.warn('Failed to remove cached data:', error);
    }
  }

  static clear(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('ai_opensubtitles_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.warn('Failed to clear cache:', error);
    }
  }

  static isExpired(key: string): boolean {
    try {
      const stored = localStorage.getItem(`ai_opensubtitles_${key}`);
      if (!stored) {
        return true;
      }

      const item: CacheItem<any> = JSON.parse(stored);
      return Date.now() > item.expiresAt;
    } catch (error) {
      return true;
    }
  }
}

export default CacheManager;