import {
  TrendData,
  TopicData,
  SummaryData,
  CachedEntry,
  TrendsCacheEntry,
  SummaryCacheEntry,
} from '../types/tapNavigation';

const DB_NAME = 'QuantyTapNavigationCache';
const DB_VERSION = 2;
const STORE_NAMES = {
  trends: 'trends',
  topics: 'topics',
  summaries: 'summaries',
};

const TTL = {
  trends: 15 * 60 * 1000,
  topics: 15 * 60 * 1000,
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
        const transaction = request.transaction;

        if (!db.objectStoreNames.contains(STORE_NAMES.trends)) {
          db.createObjectStore(STORE_NAMES.trends);
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.topics)) {
          db.createObjectStore(STORE_NAMES.topics);
        }
        if (!db.objectStoreNames.contains(STORE_NAMES.summaries)) {
          db.createObjectStore(STORE_NAMES.summaries);
        }

        if (event.oldVersion < 2 && transaction?.objectStoreNames.contains(STORE_NAMES.summaries)) {
          transaction.objectStore(STORE_NAMES.summaries).clear();
        }
      };
    });

    return this.dbPromise;
  }

  private getToday(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private buildSummaryKey(threadId: string | number, commentId: string | number, userId: string): string {
    return this.generateKey('summaries', {
      thread_id: String(threadId),
      comment_id: String(commentId),
      uid: userId,
      d: this.getToday(),
    });
  }

  private buildTopicKey(trendId: number, threadId?: string): string {
    return this.generateKey('topics', {
      trend_id: String(trendId),
      thread_id: String(threadId ?? trendId),
      d: this.getToday(),
    });
  }

  private parseKey(key: string): Record<string, string> {
    return key.split('&').reduce<Record<string, string>>((acc, pair) => {
      const [rawKey, ...rawValue] = pair.split('=');
      if (!rawKey) return acc;

      acc[rawKey] = rawValue.join('=');
      return acc;
    }, {});
  }

  private generateKey(_type: 'trends' | 'topics' | 'summaries', params: Record<string, string>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return sortedParams;
  }

  async getTrends(): Promise<CachedEntry<TrendsCacheEntry> | null> {
    const key = this.generateKey('trends', { d: this.getToday() });
    return this.get<TrendsCacheEntry>(STORE_NAMES.trends, key);
  }

  async setTrends(data: TrendsCacheEntry): Promise<void> {
    const key = this.generateKey('trends', { d: this.getToday() });
    const entry: CachedEntry<TrendsCacheEntry> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + TTL.trends,
    };
    return this.set(STORE_NAMES.trends, key, entry);
  }

  async getTopics(trendId: number, threadId?: string): Promise<CachedEntry<TopicData[]> | null> {
    const key = this.buildTopicKey(trendId, threadId);
    return this.get<TopicData[]>(STORE_NAMES.topics, key);
  }

  async setTopics(trendId: number, data: TopicData[], threadId?: string): Promise<void> {
    const key = this.buildTopicKey(trendId, threadId);
    const entry: CachedEntry<TopicData[]> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + TTL.topics,
    };
    return this.set(STORE_NAMES.topics, key, entry);
  }

  async clearTopicsByThreadIds(threadIds: string[]): Promise<void> {
    if (!threadIds.length) {
      return;
    }

    try {
      const db = await this.getDB();
      const transaction = db.transaction(STORE_NAMES.topics, 'readwrite');
      const store = transaction.objectStore(STORE_NAMES.topics);
      const threadIdSet = new Set(threadIds.map(String));

      return new Promise((resolve, reject) => {
        const request = store.openCursor();

        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            return;
          }

          const keyParams = this.parseKey(String(cursor.key));
          const keyThreadId = keyParams.thread_id ?? keyParams.trend_id;

          if (keyThreadId && threadIdSet.has(keyThreadId)) {
            cursor.delete();
          }

          cursor.continue();
        };

        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.error('Cache clear topics by thread ids error:', error);
    }
  }

  async getSummary(
    topicId: number | string,
    trendId: number | string,
    userId: string,
  ): Promise<CachedEntry<SummaryCacheEntry> | null> {
    const key = this.buildSummaryKey(trendId, topicId, userId);
    return this.get<SummaryCacheEntry>(STORE_NAMES.summaries, key);
  }

  async setSummary(
    topicId: number | string,
    trendId: number | string,
    userId: string,
    data: SummaryData,
    metadata?: SummaryCacheEntry['metadata'],
  ): Promise<void> {
    const key = this.buildSummaryKey(trendId, topicId, userId);
    const entry: CachedEntry<SummaryCacheEntry> = {
      data: { summary: data, metadata: metadata ?? null },
      timestamp: Date.now(),
      expiresAt: Date.now() + TTL.summaries,
    };
    return this.set(STORE_NAMES.summaries, key, entry);
  }

  async deleteSummary(topicId: number | string, trendId: number | string, userId: string): Promise<void> {
    const key = this.buildSummaryKey(trendId, topicId, userId);
    return this.delete(STORE_NAMES.summaries, key);
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
