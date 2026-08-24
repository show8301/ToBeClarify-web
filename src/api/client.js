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
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
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
  getStaffMembers: (signal) => request('/staff-members', { signal }),
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
  registerStaff: (body, signal) => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  }, ADMIN_API_BASE_URL),
  getRegisterKey: (signal) => request('/auth/register-key', {
    method: 'POST',
    signal,
  }, ADMIN_API_BASE_URL),
  getMe: (signal) => request('/auth/me', { signal }, ADMIN_API_BASE_URL),
  logout: (signal) => request('/auth/logout', {
    method: 'POST',
    signal,
  }, ADMIN_API_BASE_URL),
  uploadMedia: (file, category, signal) => {
    const body = new FormData();
    body.append('file', file);
    if (category) body.append('category', category);
    return request('/media/upload', { method: 'POST', body, signal }, ADMIN_API_BASE_URL);
  },
  cleanupMedia: (mediaIds = [], signal) => request('/media/cleanup', {
    method: 'POST', body: JSON.stringify({ mediaIds }), signal,
  }, ADMIN_API_BASE_URL),
  getSiteSettings: (signal) => request('/site-settings', { signal }, ADMIN_API_BASE_URL),
  saveSiteSetting: (key, body, signal) => request(`/site-settings/${encodeURIComponent(key)}`, {
    method: 'PUT', body: JSON.stringify(body), signal,
  }, ADMIN_API_BASE_URL),
  getNavigationItems: (signal) => request('/navigation-items', { signal }, ADMIN_API_BASE_URL),
  saveNavigationItem: (id, body, signal) => request(id ? `/navigation-items/${encodeURIComponent(id)}` : '/navigation-items', {
    method: id ? 'PUT' : 'POST', body: JSON.stringify(body), signal,
  }, ADMIN_API_BASE_URL),
  deleteNavigationItem: (id, signal) => request(`/navigation-items/${encodeURIComponent(id)}`, { method: 'DELETE', signal }, ADMIN_API_BASE_URL),
  getHomeCarousels: (signal) => request('/home-event-carousels', { signal }, ADMIN_API_BASE_URL),
  saveHomeCarousel: (id, body, signal) => request(id ? `/home-event-carousels/${encodeURIComponent(id)}` : '/home-event-carousels', {
    method: id ? 'PUT' : 'POST', body: JSON.stringify(body), signal,
  }, ADMIN_API_BASE_URL),
  deleteHomeCarousel: (id, signal) => request(`/home-event-carousels/${encodeURIComponent(id)}`, { method: 'DELETE', signal }, ADMIN_API_BASE_URL),
  getHomeSlides: (signal) => request('/home-slides', { signal }, ADMIN_API_BASE_URL),
  saveHomeSlide: (id, body, signal) => request(id ? `/home-slides/${encodeURIComponent(id)}` : '/home-slides', {
    method: id ? 'PUT' : 'POST', body: JSON.stringify(body), signal,
  }, ADMIN_API_BASE_URL),
  deleteHomeSlide: (id, signal) => request(`/home-slides/${encodeURIComponent(id)}`, { method: 'DELETE', signal }, ADMIN_API_BASE_URL),
  getShopRules: (signal) => request('/shop-rules', { signal }, ADMIN_API_BASE_URL),
  saveShopRule: (id, body, signal) => request(id ? `/shop-rules/${encodeURIComponent(id)}` : '/shop-rules', {
    method: id ? 'PUT' : 'POST', body: JSON.stringify(body), signal,
  }, ADMIN_API_BASE_URL),
  deleteShopRule: (id, signal) => request(`/shop-rules/${encodeURIComponent(id)}`, { method: 'DELETE', signal }, ADMIN_API_BASE_URL),
  getStaffMembers: (signal) => request('/staff-members', { signal }, ADMIN_API_BASE_URL),
  getStaffMember: (id, signal) => request(`/staff-members/${encodeURIComponent(id)}`, { signal }, ADMIN_API_BASE_URL),
  saveStaffMember: (id, body, signal) => request(`/staff-members/${encodeURIComponent(id)}`, {
    method: 'PUT', body: JSON.stringify(body), signal,
  }, ADMIN_API_BASE_URL),
  updateStaffMemberStatus: (id, body, signal) => request(`/staff-members/${encodeURIComponent(id)}/status`, {
    method: 'PUT', body: JSON.stringify(body), signal,
  }, ADMIN_API_BASE_URL),
  reorderStaffMembers: (items, signal) => request('/staff-members/order', {
    method: 'PUT', body: JSON.stringify({ items }), signal,
  }, ADMIN_API_BASE_URL),
  deleteStaffMember: (id, signal) => request(`/staff-members/${encodeURIComponent(id)}`, { method: 'DELETE', signal }, ADMIN_API_BASE_URL),
  getGalleryAlbums: (signal) => request('/gallery-albums', { signal }, ADMIN_API_BASE_URL),
  saveGalleryAlbum: (id, body, signal) => request(id ? `/gallery-albums/${encodeURIComponent(id)}` : '/gallery-albums', {
    method: id ? 'PUT' : 'POST', body: JSON.stringify(body), signal,
  }, ADMIN_API_BASE_URL),
  deleteGalleryAlbum: (id, signal) => request(`/gallery-albums/${encodeURIComponent(id)}`, { method: 'DELETE', signal }, ADMIN_API_BASE_URL),
  getPricingRules: (signal) => request('/pricing-rules', { signal }, ADMIN_API_BASE_URL),
  savePricingRule: (id, body, signal) => request(id ? `/pricing-rules/${encodeURIComponent(id)}` : '/pricing-rules', {
    method: id ? 'PUT' : 'POST', body: JSON.stringify(body), signal,
  }, ADMIN_API_BASE_URL),
  deletePricingRule: (id, signal) => request(`/pricing-rules/${encodeURIComponent(id)}`, { method: 'DELETE', signal }, ADMIN_API_BASE_URL),
  getMenu: (signal) => request('/menu', { signal }, ADMIN_API_BASE_URL),
  saveMenuCategory: (id, body, signal) => request(id ? `/menu/categories/${encodeURIComponent(id)}` : '/menu/categories', {
    method: id ? 'PUT' : 'POST', body: JSON.stringify(body), signal,
  }, ADMIN_API_BASE_URL),
  deleteMenuCategory: (id, signal) => request(`/menu/categories/${encodeURIComponent(id)}`, { method: 'DELETE', signal }, ADMIN_API_BASE_URL),
  saveMenuItem: (id, body, signal) => request(id ? `/menu/items/${encodeURIComponent(id)}` : '/menu/items', {
    method: id ? 'PUT' : 'POST', body: JSON.stringify(body), signal,
  }, ADMIN_API_BASE_URL),
  deleteMenuItem: (id, signal) => request(`/menu/items/${encodeURIComponent(id)}`, { method: 'DELETE', signal }, ADMIN_API_BASE_URL),
  saveMenuSet: (id, body, signal) => request(id ? `/menu/sets/${encodeURIComponent(id)}` : '/menu/sets', {
    method: id ? 'PUT' : 'POST', body: JSON.stringify(body), signal,
  }, ADMIN_API_BASE_URL),
  deleteMenuSet: (id, signal) => request(`/menu/sets/${encodeURIComponent(id)}`, { method: 'DELETE', signal }, ADMIN_API_BASE_URL),
};
