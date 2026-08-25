import { adminApi } from './admin-api.js';

export async function cleanupAdminMedia(mediaIds) {
  const ids = [...new Set((mediaIds || []).filter(Boolean))];
  if (!ids.length) return;
  try {
    await adminApi.cleanupMedia(ids);
  } catch {
    // The API's scheduled cleanup is the fallback if compensating cleanup fails.
  }
}
