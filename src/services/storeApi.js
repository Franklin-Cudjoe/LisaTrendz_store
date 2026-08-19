const FALLBACK_API_ORIGIN = "http://localhost:4000";
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || "").replace(
  /\/+$/,
  "",
);

class StoreApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = "StoreApiError";
    this.status = status;
  }
}

function getAdminHeaders() {
  try {
    const token = sessionStorage.getItem("adminAuthToken");
    return token ? { Authorization: `Basic ${token}` } : {};
  } catch (e) {
    return {};
  }
}

function makeBasicToken(username, password) {
  return btoa(`${String(username).trim()}:${String(password).trim()}`);
}

function apiUrls(path) {
  if (/^https?:\/\//i.test(path)) return [path];

  if (API_BASE_URL) return [`${API_BASE_URL}${path}`];

  return [path, `${FALLBACK_API_ORIGIN}${path}`];
}

async function parseError(response) {
  try {
    const payload = await response.json();
    if (payload?.error) return payload.error;
  } catch (e) {}

  return `Request failed with status ${response.status}`;
}

export async function apiRequest(path, options = {}) {
  const { auth = false, headers = {}, ...fetchOptions } = options;
  const authHeaders = auth ? getAdminHeaders() : {};
  let lastError = null;

  for (const url of apiUrls(path)) {
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          ...authHeaders,
          ...headers,
        },
      });

      if (response.ok) return response;

      const message = await parseError(response);
      lastError = new StoreApiError(message, response.status);

      if (response.status === 401 || response.status === 403) {
        throw lastError;
      }
    } catch (error) {
      lastError = error;

      if (error instanceof StoreApiError) {
        throw error;
      }
    }
  }

  throw lastError || new StoreApiError("Store API is unavailable");
}

export async function fetchProducts({ includeHidden = false } = {}) {
  const response = await apiRequest(
    includeHidden ? "/api/admin/products" : "/api/products",
    { auth: includeHidden },
  );

  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function verifyAdminCredentials(username, password) {
  const token = makeBasicToken(username, password);

  await apiRequest("/api/admin/products", {
    headers: { Authorization: `Basic ${token}` },
  });

  return token;
}

export async function createProduct(product) {
  const response = await apiRequest("/api/products", {
    method: "POST",
    auth: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product),
  });

  return response.json();
}

export async function updateProduct(id, product) {
  const response = await apiRequest(`/api/products/${encodeURIComponent(id)}`, {
    method: "PUT",
    auth: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product),
  });

  return response.json();
}

export async function deleteProduct(id) {
  const response = await apiRequest(`/api/products/${encodeURIComponent(id)}`, {
    method: "DELETE",
    auth: true,
  });

  return response.json();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function resolveUploadedUrl(uploadUrl, responseUrl) {
  if (!uploadUrl || !uploadUrl.startsWith("/")) return uploadUrl;

  try {
    const responseOrigin = new URL(responseUrl).origin;

    if (responseOrigin !== window.location.origin) {
      return responseOrigin + uploadUrl;
    }
  } catch (e) {}

  return uploadUrl;
}

export async function uploadProductImage(file, view = "front") {
  if (!file?.type?.startsWith("image/")) {
    throw new StoreApiError("Choose an image file.");
  }

  const dataUrl = await readFileAsDataUrl(file);
  const response = await apiRequest("/api/uploads", {
    method: "POST",
    auth: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dataUrl,
      filename: file.name || "dress-photo",
      view,
    }),
  });
  const payload = await response.json();

  if (!payload?.url) {
    throw new StoreApiError("The photo uploaded but no image URL was returned.");
  }

  return resolveUploadedUrl(payload.url, response.url);
}

export async function fetchOrders() {
  const response = await apiRequest("/api/orders", { auth: true });
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

export async function updateOrderStatus(orderId, status) {
  const response = await apiRequest(
    `/api/orders/${encodeURIComponent(orderId)}/status`,
    {
      method: "PATCH",
      auth: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, actor: "owner" }),
    },
  );

  return response.json();
}
