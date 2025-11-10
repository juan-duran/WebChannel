import { TrendData, TopicData, SummaryData, CachedEntry } from '../types/tapNavigation';

const DB_NAME = 'QuantyTapNavigationCache';
const DB_VERSION = 1;
const STORE_NAMES = {
  trends: 'trends',
  topics: 'topics',
  summaries: 'summaries',
};

const TTL = {
  trends: 30 * 60 * 1000,
  topics: 30 * 60 * 1000,
  summaries: 15 * 60 * 1000,
};

class CacheStorage {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private async getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAMES.trends)) {
          db.createObjectStore(STORE_NAMES.trends);
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.topics)) {
          db.createObjectStore(STORE_NAMES.topics);
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.summaries)) {
          db.createObjectStore(STORE_NAMES.summaries);
        }
      };
    });

    return this.dbPromise;
  }

  private getToday(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private generateKey(type: 'trends' | 'topics' | 'summaries', params: Record<string, string>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return sortedParams;
  }

  async getTrends(): Promise<CachedEntry<TrendData[]> | null> {
    const key = this.generateKey('trends', { d: this.getToday() });
    return this.get<TrendData[]>(STORE_NAMES.trends, key);
  }

  async setTrends(data: TrendData[]): Promise<void> {
    const key = this.generateKey('trends', { d: this.getToday() });
    const entry: CachedEntry<TrendData[]> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + TTL.trends,
    };
    return this.set(STORE_NAMES.trends, key, entry);
  }

  async getTopics(trendId: number): Promise<CachedEntry<TopicData[]> | null> {
    const key = this.generateKey('topics', { trend_id: String(trendId), d: this.getToday() });
    return this.get<TopicData[]>(STORE_NAMES.topics, key);
  }

  async setTopics(trendId: number, data: TopicData[]): Promise<void> {
    const key = this.generateKey('topics', { trend_id: String(trendId), d: this.getToday() });
    const entry: CachedEntry<TopicData[]> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + TTL.topics,
    };
    return this.set(STORE_NAMES.topics, key, entry);
  }

  async getSummary(topicId: number, userId: string): Promise<CachedEntry<SummaryData> | null> {
    const key = this.generateKey('summaries', {
      topic_id: String(topicId),
      uid: userId,
      d: this.getToday(),
    });
    return this.get<SummaryData>(STORE_NAMES.summaries, key);
  }

  async setSummary(topicId: number, userId: string, data: SummaryData): Promise<void> {
    const key = this.generateKey('summaries', {
      topic_id: String(topicId),
      uid: userId,
      d: this.getToday(),
    });
    const entry: CachedEntry<SummaryData> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + TTL.summaries,
    };
    return this.set(STORE_NAMES.summaries, key, entry);
  }

  private async get<T>(storeName: string, key: string): Promise<CachedEntry<T> | null> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);

      return new Promise((resolve, reject) => {
        const request = store.get(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const entry = request.result as CachedEntry<T> | undefined;
          if (!entry) {
            resolve(null);
            return;
          }

          if (Date.now() > entry.expiresAt) {
            this.delete(storeName, key);
            resolve(null);
            return;
          }

          resolve(entry);
        };
      });
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  private async set<T>(storeName: string, key: string, value: CachedEntry<T>): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      return new Promise((resolve, reject) => {
        const request = store.put(value, key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  private async delete(storeName: string, key: string): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      return new Promise((resolve, reject) => {
        const request = store.delete(key);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  async clearAll(): Promise<void> {
    try {
      const db = await this.getDB();
      const transaction = db.transaction(Object.values(STORE_NAMES), 'readwrite');

      for (const storeName of Object.values(STORE_NAMES)) {
        transaction.objectStore(storeName).clear();
      }

      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  isStale<T>(entry: CachedEntry<T>, maxAge: number = 5 * 60 * 1000): boolean {
    return Date.now() - entry.timestamp > maxAge;
  }
}

export const cacheStorage = new CacheStorage();
