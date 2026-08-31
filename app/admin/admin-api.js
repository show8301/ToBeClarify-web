// The restricted account supplied for direct SQL maintenance cannot delete rows.
// That restriction does not prohibit these authorized API DELETE calls: the API
// deployment identity and backend business rules determine whether deletion runs.
// Removing an item from an unsent client-side cart is local state only and is safe.
const ADMIN_API_BASE_URL = "/api/admin";

export class ApiError extends Error {
  constructor(message, { status = 0, code = "NETWORK_ERROR", traceId = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.traceId = traceId;
  }
}

async function request(path, options = {}) {
  let response;
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  try {
    response = await fetch(`${ADMIN_API_BASE_URL}${path}`, {
      ...options,
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(options.body && !isFormData ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    if (error?.name === "AbortError") throw error;
    throw new ApiError("無法連線至管理 API，請稍後再試。");
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw new ApiError(payload?.message || `API 請求失敗（HTTP ${response.status}）`, {
      status: response.status,
      code: payload?.errorCode || "API_ERROR",
      traceId: payload?.traceId,
    });
  }

  return payload?.data;
}

export const adminApi = {
  login: (body, signal) => request('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  }),
  registerStaff: (body, signal) => request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  }),
  getRegisterKey: (signal) => request('/auth/register-key', {
    method: 'POST',
    signal,
  }),
  getPasswordResetKey: (body, signal) => request('/auth/password-reset-key', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  }),
  resetPassword: (body, signal) => request('/auth/forgot-password/reset', {
    method: 'POST',
    body: JSON.stringify(body),
    signal,
  }),
  getMe: (signal) => request('/auth/me', { signal }),
  logout: (signal) => request('/auth/logout', {
    method: 'POST',
    signal,
  }),
  uploadMedia: (file, category, signal) => {
    const body = new FormData();
    body.append('file', file);
    if (category) body.append('category', category);
    return request('/media/upload', { method: 'POST', body, signal });
  },
  cleanupMedia: (mediaIds = [], signal) => request('/media/cleanup', {
    method: 'POST', body: JSON.stringify({ mediaIds }), signal,
  }),
  getSiteSettings: (signal) => request('/site-settings', { signal }),
  getAllStaffList: (signal) => request('/all-staff-list', { signal }),
  saveSiteSetting: (key, body, signal) => request(`/site-settings/${encodeURIComponent(key)}`, {
    method: 'PUT', body: JSON.stringify(body), signal,
  }),
  getNavigationItems: (signal) => request('/navigation-items', { signal }),
  saveNavigationItem: (id, body, signal) => request(id ? `/navigation-items/${encodeURIComponent(id)}` : '/navigation-items', {
    method: id ? 'PUT' : 'POST', body: JSON.stringify(body), signal,
  }),
  deleteNavigationItem: (id, signal) => request(`/navigation-items/${encodeURIComponent(id)}`, { method: 'DELETE', signal }),
  getHomeCarousels: (signal) => request('/home-event-carousels', { signal }),
  saveHomeCarousel: (id, body, signal) => request(id ? `/home-event-carousels/${encodeURIComponent(id)}` : '/home-event-carousels', {
    method: id ? 'PUT' : 'POST', body: JSON.stringify(body), signal,
  }),
  deleteHomeCarousel: (id, signal) => request(`/home-event-carousels/${encodeURIComponent(id)}`, { method: 'DELETE', signal }),
  getHomeSlides: (signal) => request('/home-slides', { signal }),
  saveHomeSlide: (id, body, signal) => request(id ? `/home-slides/${encodeURIComponent(id)}` : '/home-slides', {
    method: id ? 'PUT' : 'POST', body: JSON.stringify(body), signal,
  }),
  deleteHomeSlide: (id, signal) => request(`/home-slides/${encodeURIComponent(id)}`, { method: 'DELETE', signal }),
  getShopRules: (signal) => request('/shop-rules', { signal }),
  saveShopRule: (id, body, signal) => request(id ? `/shop-rules/${encodeURIComponent(id)}` : '/shop-rules', {
    method: id ? 'PUT' : 'POST', body: JSON.stringify(body), signal,
  }),
  deleteShopRule: (id, signal) => request(`/shop-rules/${encodeURIComponent(id)}`, { method: 'DELETE', signal }),
  getStaffMembers: (signal) => request('/staff-members', { signal }),
  getStaffMember: (id, signal) => request(`/staff-members/${encodeURIComponent(id)}`, { signal }),
  saveStaffMember: (id, body, signal) => request(`/staff-members/${encodeURIComponent(id)}`, {
    method: 'PUT', body: JSON.stringify(body), signal,
  }),
  updateStaffMemberStatus: (id, body, signal) => request(`/staff-members/${encodeURIComponent(id)}/status`, {
    method: 'PUT', body: JSON.stringify(body), signal,
  }),
  reorderStaffMembers: (items, signal) => request('/staff-members/order', {
    method: 'PUT', body: JSON.stringify({ items }), signal,
  }),
  deleteStaffMember: (id, signal) => request(`/staff-members/${encodeURIComponent(id)}`, { method: 'DELETE', signal }),
  getGalleryAlbums: (signal) => request('/gallery-albums', { signal }),
  saveGalleryAlbum: (id, body, signal) => request(id ? `/gallery-albums/${encodeURIComponent(id)}` : '/gallery-albums', {
    method: id ? 'PUT' : 'POST', body: JSON.stringify(body), signal,
  }),
  deleteGalleryAlbum: (id, signal) => request(`/gallery-albums/${encodeURIComponent(id)}`, { method: 'DELETE', signal }),
  getPricingRules: (signal) => request('/pricing-rules', { signal }),
  savePricingRule: (id, body, signal) => request(id ? `/pricing-rules/${encodeURIComponent(id)}` : '/pricing-rules', {
    method: id ? 'PUT' : 'POST', body: JSON.stringify(body), signal,
  }),
  deletePricingRule: (id, signal) => request(`/pricing-rules/${encodeURIComponent(id)}`, { method: 'DELETE', signal }),
  getMenu: (signal) => request('/menu', { signal }),
  saveMenuCategory: (id, body, signal) => request(id ? `/menu/categories/${encodeURIComponent(id)}` : '/menu/categories', {
    method: id ? 'PUT' : 'POST', body: JSON.stringify(body), signal,
  }),
  deleteMenuCategory: (id, signal) => request(`/menu/categories/${encodeURIComponent(id)}`, { method: 'DELETE', signal }),
  saveMenuItem: (id, body, signal) => request(id ? `/menu/items/${encodeURIComponent(id)}` : '/menu/items', {
    method: id ? 'PUT' : 'POST', body: JSON.stringify(body), signal,
  }),
  deleteMenuItem: (id, signal) => request(`/menu/items/${encodeURIComponent(id)}`, { method: 'DELETE', signal }),
  saveMenuSet: (id, body, signal) => request(id ? `/menu/sets/${encodeURIComponent(id)}` : '/menu/sets', {
    method: id ? 'PUT' : 'POST', body: JSON.stringify(body), signal,
  }),
  deleteMenuSet: (id, signal) => request(`/menu/sets/${encodeURIComponent(id)}`, { method: 'DELETE', signal }),
  getOrderSessions: ({ businessDate, search } = {}, signal) => {
    const params = new URLSearchParams();
    if (businessDate) params.set('businessDate', businessDate);
    if (search) params.set('search', search);
    return request(`/order-sessions${params.size ? `?${params}` : ''}`, { signal });
  },
  createOrderSession: (body, signal) => request('/order-sessions', { method: 'POST', body: JSON.stringify(body), signal }),
  updateOrderSession: (id, body, signal) => request(`/order-sessions/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(body), signal }),
  reissueOrderSession: (id, signal) => request(`/order-sessions/${encodeURIComponent(id)}/reissue`, { method: 'POST', signal }),
  getSessionOrders: (id, signal) => request(`/order-sessions/${encodeURIComponent(id)}/orders`, { signal }),
  getOrderingSettings: (signal) => request('/ordering-settings', { signal }),
  getOrderingContext: (signal) => request('/ordering-context', { signal }),
  openBusinessPeriod: (body, signal) => request('/business-period/open', {
    method: 'POST', body: JSON.stringify(body), signal,
  }),
  applyBusinessPeriodAction: (body, signal) => request('/business-period/action', {
    method: 'POST', body: JSON.stringify(body), signal,
  }),
  getBusinessDayOverride: (signal) => request('/ordering-settings/business-day-override', { signal }),
  saveBusinessDayOverride: (body, signal) => request('/ordering-settings/business-day-override', {
    method: 'PUT', body: JSON.stringify(body), signal,
  }),
  disableBusinessDayOverride: (signal) => request('/ordering-settings/business-day-override/disable', {
    method: 'POST', signal,
  }),
  saveOrderingSettings: (body, signal) => request('/ordering-settings', { method: 'PUT', body: JSON.stringify(body), signal }),
  pauseNomination: (minutes, signal) => request('/ordering-settings/pause-nomination', { method: 'POST', body: JSON.stringify({ minutes }), signal }),
  confirmNominee: (orderId, signal) => request(`/orders/${encodeURIComponent(orderId)}/confirm-nominee`, { method: 'POST', signal }),
  decideStoreConfirmation: (orderId, decision, reason, signal) => request(`/orders/${encodeURIComponent(orderId)}/store-confirmation`, {
    method: 'POST', body: JSON.stringify({ decision, reason: reason || null }), signal,
  }),
  getAddonOptions: (nomineeId, signal) => request(`/order-nominees/${encodeURIComponent(nomineeId)}/addon-options`, { signal }),
  submitAdminAddon: (nomineeId, body, signal) => request(`/order-nominees/${encodeURIComponent(nomineeId)}/addons`, { method: 'POST', body: JSON.stringify({ ...body, parentNomineeId: nomineeId }), signal }),
  confirmAddon: (orderId, signal) => request(`/orders/${encodeURIComponent(orderId)}/confirm-addon`, { method: 'POST', signal }),
  rescheduleOrder: (orderId, requestedStartsAt, signal) => request(`/orders/${encodeURIComponent(orderId)}/reschedule`, { method: 'POST', body: JSON.stringify({ requestedStartsAt }), signal }),
  backfillServedOrder: (orderId, body, signal) => request(`/orders/${encodeURIComponent(orderId)}/backfill-served`, { method: 'POST', body: JSON.stringify(body), signal }),
  shortenNomination: (orderId, nomineeId, segmentCount, reason, signal) => request(`/orders/${encodeURIComponent(orderId)}/nominees/${encodeURIComponent(nomineeId)}/shorten`, { method: 'POST', body: JSON.stringify({ segmentCount, reason }), signal }),
  updateOrder: (orderId, body, signal) => request(`/orders/${encodeURIComponent(orderId)}`, { method: 'PUT', body: JSON.stringify(body), signal }),
  transitionOrder: (orderId, action, reason, signal) => request(`/orders/${encodeURIComponent(orderId)}/transition`, { method: 'POST', body: JSON.stringify({ action, reason: reason || null }), signal }),
  updateOrderItem: (orderId, itemId, body, signal) => request(`/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}`, { method: 'PUT', body: JSON.stringify(body), signal }),
  deleteOrderItem: (orderId, itemId, signal) => request(`/orders/${encodeURIComponent(orderId)}/items/${encodeURIComponent(itemId)}`, { method: 'DELETE', signal }),
  cancelOrder: (orderId, reason, signal) => request(`/orders/${encodeURIComponent(orderId)}`, { method: 'DELETE', body: JSON.stringify({ reason }), signal }),
  getOrderingReport: (from, to, signal) => request(`/ordering-reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { signal }),
};
