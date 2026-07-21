const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
const API_BASE_URL = (configuredBaseUrl || '/api/client').replace(/\/$/, '');
const ADMIN_API_BASE_URL = (import.meta.env.VITE_ADMIN_API_BASE_URL?.trim() || '/api/admin').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', traceId = null } = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.traceId = traceId;
  }
}

async function request(path, options = {}, baseUrl = API_BASE_URL) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError('無法連線至 API，請確認服務是否已啟動。');
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    if (!response.ok) {
      throw new ApiError(`API 回應錯誤（HTTP ${response.status}）`, { status: response.status });
    }
  }

  if (!response.ok || payload?.success === false) {
    throw new ApiError(payload?.message || `API 請求失敗（HTTP ${response.status}）`, {
      status: response.status,
      code: payload?.errorCode || 'API_ERROR',
      traceId: payload?.traceId,
    });
  }

  return payload?.data;
}

function queryString(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  });
  const value = query.toString();
  return value ? `?${value}` : '';
}

export const clientApi = {
  getHome: (signal) => request('/home', { signal }),
  getEvents: (params = {}, signal) => request(`/events${queryString(params)}`, { signal }),
  getStaffDetail: (id, signal) => request(`/staff-members/${encodeURIComponent(id)}`, { signal }),
  getGalleryAlbums: (signal) => request('/gallery-albums', { signal }),
  getGalleryAlbum: (id, signal) => request(`/gallery-albums/${encodeURIComponent(id)}`, { signal }),
  getMenu: (signal) => request('/menu', { signal }),
  getGuestbook: (params = {}, signal) => request(`/guestbook/comments${queryString(params)}`, { signal }),
  createGuestbookComment: (body, signal) => request('/guestbook/comments', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  }),
  createGuestbookReply: (commentId, body, signal) => request(`/guestbook/comments/${encodeURIComponent(commentId)}/replies`, {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  }),
  getReservations: (params = {}, signal) => request(`/staff-reservations${queryString(params)}`, { signal }),
  getRankings: (type, period, signal) => request(`/rankings${queryString({ type, period })}`, { signal }),
};

export const adminApi = {
  login: (body, signal) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  }, ADMIN_API_BASE_URL),
  getMe: (signal) => request('/auth/me', { signal }, ADMIN_API_BASE_URL),
  logout: (signal) => request('/auth/logout', {
    method: 'POST',
    signal,
  }, ADMIN_API_BASE_URL),
};
