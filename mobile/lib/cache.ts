// Offline cache using SecureStore — instant app launch with stale-while-revalidate
// Data is cached locally and served immediately, then refreshed in background.
// Uses SecureStore (works in Expo Go) instead of MMKV (requires dev build).

import * as SecureStore from 'expo-secure-store'

const CACHE_TTL = 5 * 60 * 1000 // 5 minutes
const CACHE_PREFIX = 'cache_'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

/**
 * Get cached data. Returns null if no cache or expired beyond hard limit (24h).
 */
export function getCache<T>(key: string): T | null {
  const entry = memCache[CACHE_PREFIX + key]
  if (!entry) return null
  // Expire after 24 hours
  if (Date.now() - entry.timestamp > 24 * 60 * 60 * 1000) {
    delete memCache[CACHE_PREFIX + key]
    return null
  }
  return entry.data
}

/**
 * Save data to cache (in-memory + persistent).
 */
export function setCache<T>(key: string, data: T): void {
  const entry: CacheEntry<T> = { data, timestamp: Date.now() }
  memCache[CACHE_PREFIX + key] = entry
  // Persist async (fire-and-forget)
  SecureStore.setItemAsync(CACHE_PREFIX + key, JSON.stringify(entry)).catch(() => {})
}

/**
 * Load persistent cache into memory on app start.
 */
export async function loadPersistentCache(): Promise<void> {
  for (const key of ['account', 'project', 'timeline', 'schedule']) {
    try {
      const raw = await SecureStore.getItemAsync(CACHE_PREFIX + key)
      if (raw) {
        const entry = JSON.parse(raw)
        if (Date.now() - entry.timestamp < 24 * 60 * 60 * 1000) {
          memCache[CACHE_PREFIX + key] = entry
        }
      }
    } catch {}
  }
}

// In-memory cache for synchronous access
const memCache: Record<string, CacheEntry<any>> = {}

/**
 * Clear all cached data.
 */
export function clearCache(): void {
  Object.keys(memCache).forEach(k => delete memCache[k])
}

