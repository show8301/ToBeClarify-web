import { adminApi } from '../api/client.js';

export async function cleanupAdminMedia(mediaIds) {
  const ids = [...new Set((mediaIds || []).filter(Boolean))];
  if (ids.length === 0) return;
  try {
    await adminApi.cleanupMedia(ids);
  } catch {
    // The scheduled API cleanup is the fallback when the compensating request cannot complete.
  }
}
