/**
 * Gọi API qua proxy Vite `/api` → backend.
 */

function getAuthHeaders() {
  const token = localStorage.getItem("bd_access_token");
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

function safeJsonStringify(value) {
  return JSON.stringify(value, (_, v) => (typeof v === "bigint" ? v.toString() : v));
}

export async function apiGet(path, params = {}) {
  const url = new URL(`/api${path}`, window.location.origin);
  Object.entries(params).forEach(([k, v]) => {
    if (v != null && v !== "") url.searchParams.set(k, String(v));
  });
  const res = await fetch(url.toString(), { headers: getAuthHeaders() });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = data?.message || res.statusText || "Request failed";
    throw new Error(msg);
  }
  return data;
}

/** multipart — không set Content-Type để trình duyệt gửi boundary */
export async function apiUploadFile(path, file, { auth = true } = {}) {
  const fd = new FormData();
  fd.append("file", file);
  const headers = {};
  if (auth) {
    const token = localStorage.getItem("bd_access_token");
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`/api${path}`, { method: "POST", headers, body: fd });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    if (res.status === 401) {
      throw new Error("Hết phiên đăng nhập — đăng nhập lại Admin rồi tải ảnh.");
    }
    if (res.status === 403) {
      throw new Error("Chỉ tài khoản quản trị mới tải ảnh được.");
    }
    const msg = data?.message || res.statusText || "Request failed";
    throw new Error(msg);
  }
  return data;
}

export async function apiPost(path, body, { auth = false } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) Object.assign(headers, getAuthHeaders());
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers,
    body: safeJsonStringify(body)
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = data?.message || res.statusText || "Request failed";
    throw new Error(msg);
  }
  return data;
}

export async function apiPatch(path, body, { auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) Object.assign(headers, getAuthHeaders());
  const res = await fetch(`/api${path}`, {
    method: "PATCH",
    headers,
    body: safeJsonStringify(body ?? {})
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = data?.message || res.statusText || "Request failed";
    throw new Error(msg);
  }
  return data;
}

export async function apiPut(path, body, { auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) Object.assign(headers, getAuthHeaders());
  const res = await fetch(`/api${path}`, {
    method: "PUT",
    headers,
    body: safeJsonStringify(body ?? {})
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = data?.message || res.statusText || "Request failed";
    throw new Error(msg);
  }
  return data;
}

export async function apiDelete(path, { auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (auth) Object.assign(headers, getAuthHeaders());
  const res = await fetch(`/api${path}`, { method: "DELETE", headers });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const msg = data?.message || res.statusText || "Request failed";
    throw new Error(msg);
  }
  return data;
}

export function setTokens(accessToken, refreshToken) {
  if (accessToken) localStorage.setItem("bd_access_token", accessToken);
  else localStorage.removeItem("bd_access_token");
  if (refreshToken) localStorage.setItem("bd_refresh_token", refreshToken);
  else localStorage.removeItem("bd_refresh_token");
}

export function clearTokens() {
  localStorage.removeItem("bd_access_token");
  localStorage.removeItem("bd_refresh_token");
}

export function getAccessToken() {
  return localStorage.getItem("bd_access_token");
}
