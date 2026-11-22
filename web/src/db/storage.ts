// Storage Persistence & Eviction Warning Utilities

export interface StorageEstimateInfo {
  usageBytes: number;
  quotaBytes: number;
  percentageUsed: number;
  isPersistent: boolean;
  isNearQuota: boolean;
}

export async function requestPersistentStorage(): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    try {
      const isPersisted = await navigator.storage.persist();
      console.log('[Storage] Persistent storage granted:', isPersisted);
      return isPersisted;
    } catch (e) {
      console.warn('[Storage] Could not request persistence:', e);
      return false;
    }
  }
  return false;
}

export async function checkStorageQuota(): Promise<StorageEstimateInfo> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      const isPersisted = await navigator.storage.persisted();

      const usage = estimate.usage || 0;
      const quota = estimate.quota || 1;
      const percentage = (usage / quota) * 100;

      return {
        usageBytes: usage,
        quotaBytes: quota,
        percentageUsed: Math.round(percentage * 10) / 10,
        isPersistent: isPersisted,
        isNearQuota: percentage > 80, // Warn user if over 80%
      };
    } catch (e) {
      console.warn('[Storage] Estimate error:', e);
    }
  }

  return {
    usageBytes: 0,
    quotaBytes: 0,
    percentageUsed: 0,
    isPersistent: false,
    isNearQuota: false,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
