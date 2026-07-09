const API_BASE_URL = import.meta.env.PROD ? '/api' : (import.meta.env.VITE_API_URL ?? '/api');

export function getDriverSession() {
  try {
    return JSON.parse(window.localStorage.getItem('pizzaria-admin') ?? 'null');
  } catch {
    return null;
  }
}

export function saveDriverSession(session) {
  window.localStorage.setItem('pizzaria-admin', JSON.stringify(session));
}

export function clearDriverSession() {
  window.localStorage.removeItem('pizzaria-admin');
}

export function isDriverSession(session = getDriverSession()) {
  const role = session?.role || session?.admin?.role;
  return Boolean(session?.token && role === 'DRIVER');
}

function getAuthHeaders() {
  const session = getDriverSession();
  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const hasBody = options.body !== undefined && !(options.body instanceof FormData);

  if (hasBody && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  for (const [key, value] of Object.entries(getAuthHeaders())) {
    headers.set(key, value);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Nao foi possivel concluir a operacao.');
  }

  return data;
}

export async function loginDriver(email, password) {
  const data = await apiRequest('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const role = data.role || data.admin?.role;

  if (role !== 'DRIVER') {
    throw new Error('Este login nao pertence a um entregador.');
  }

  const session = { admin: data.admin, token: data.token, role };
  saveDriverSession(session);
  return session;
}

export function getDriverMe() {
  return apiRequest('/driver/me');
}

export function getDriverOrders() {
  return apiRequest('/driver/orders');
}

export function getDriverOrder(orderId) {
  return apiRequest(`/driver/orders/${encodeURIComponent(orderId)}`);
}

export function confirmDelivery(orderId, payload) {
  return apiRequest(`/driver/orders/${encodeURIComponent(orderId)}/confirm-delivery`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function reportDeliveryFailure(orderId, payload) {
  return apiRequest(`/driver/orders/${encodeURIComponent(orderId)}/delivery-failed`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function reportLocation(orderId, payload) {
  return apiRequest(`/driver/orders/${encodeURIComponent(orderId)}/location`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function uploadProof(orderId, file) {
  const formData = new FormData();
  formData.append('file', file);

  return apiRequest(`/driver/orders/${encodeURIComponent(orderId)}/proof`, {
    method: 'POST',
    body: formData,
  });
}
