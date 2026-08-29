const BASE = '/api/ordering';

export class OrderingApiError extends Error {
  constructor(message, status = 0, code = 'NETWORK_ERROR') {
    super(message);
    this.name = 'OrderingApiError';
    this.status = status;
    this.code = code;
  }
}

async function request(path, { token, ...options } = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      ...options,
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { 'X-Order-Token': token } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new OrderingApiError('無法連線至點餐服務，請稍後再試。');
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    throw new OrderingApiError(payload?.message || `點餐服務錯誤（${response.status}）`, response.status, payload?.errorCode || 'API_ERROR');
  }
  return payload?.data;
}

export const orderingApi = {
  access: (orderToken, signal) => request('/access', { method: 'POST', body: JSON.stringify({ orderToken }), signal }),
  recover: (body, signal) => request('/recover', { method: 'POST', body: JSON.stringify(body), signal }),
  catalog: (token, signal) => request('/catalog', { token, signal }),
  orders: (token, signal) => request('/orders', { token, signal }),
  submit: (token, body, signal) => request('/orders', { token, method: 'POST', body: JSON.stringify(body), signal }),
};
