const FALLBACK_API_ORIGIN = "http://localhost:4000";
const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || "").replace(
  /\/+$/,
  "",
);
const MAX_UPLOAD_SIDE = 1800;
const MAX_UPLOAD_BYTES = 900 * 1024;
const JPEG_QUALITY_STEPS = [0.82, 0.74, 0.66, 0.58];

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

function getBrowserOrigin() {
  try {
    return window.location.origin;
  } catch (e) {
    return "";
  }
}

function getApiAssetOrigin(responseUrl) {
  const browserOrigin = getBrowserOrigin();

  if (API_BASE_URL) {
    try {
      return new URL(API_BASE_URL, browserOrigin || undefined).origin;
    } catch (e) {}
  }

  try {
    const responseOrigin = new URL(responseUrl).origin;

    if (!browserOrigin || responseOrigin !== browserOrigin) {
      return responseOrigin;
    }
  } catch (e) {}

  return "";
}

function resolveApiAssetUrl(value, responseUrl) {
  if (typeof value !== "string") return value;

  const url = value.trim();

  if (!url || /^https?:\/\//i.test(url) || !url.startsWith("/uploads/")) {
    return url;
  }

  const apiOrigin = getApiAssetOrigin(responseUrl);

  return apiOrigin ? `${apiOrigin}${url}` : url;
}

function resolveImageUrls(value, responseUrl) {
  if (Array.isArray(value)) {
    return value.map((image) => resolveImageUrls(image, responseUrl));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, image]) => [
        key,
        resolveImageUrls(image, responseUrl),
      ]),
    );
  }

  return resolveApiAssetUrl(value, responseUrl);
}

function resolveProductImageUrls(product, responseUrl) {
  if (!product || typeof product !== "object") return product;

  return {
    ...product,
    image: resolveApiAssetUrl(product.image, responseUrl),
    imageFront: resolveApiAssetUrl(product.imageFront, responseUrl),
    imageBack: resolveApiAssetUrl(product.imageBack, responseUrl),
    images: resolveImageUrls(product.images, responseUrl),
  };
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
  return Array.isArray(data)
    ? data.map((product) => resolveProductImageUrls(product, response.url))
    : [];
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

  return resolveProductImageUrls(await response.json(), response.url);
}

export async function updateProduct(id, product) {
  const response = await apiRequest(`/api/products/${encodeURIComponent(id)}`, {
    method: "PUT",
    auth: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product),
  });

  return resolveProductImageUrls(await response.json(), response.url);
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

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new StoreApiError("Could not prepare the image."));
      },
      type,
      quality,
    );
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new StoreApiError("Could not read the image."));
    };
    image.src = objectUrl;
  });
}

function makeCompressedName(filename = "dress-photo") {
  const cleanName = String(filename).replace(/\.[^.]+$/, "") || "dress-photo";
  return `${cleanName}.jpg`;
}

async function compressImageFile(file) {
  if (
    typeof document === "undefined" ||
    !file?.type?.startsWith("image/") ||
    file.type === "image/svg+xml" ||
    file.type === "image/gif"
  ) {
    return file;
  }

  const image = await loadImageFromFile(file);
  const scale = Math.min(
    1,
    MAX_UPLOAD_SIDE / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });

  if (!context) return file;

  canvas.width = width;
  canvas.height = height;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  let bestBlob = null;

  for (const quality of JPEG_QUALITY_STEPS) {
    const blob = await canvasToBlob(canvas, "image/jpeg", quality);
    bestBlob = blob;

    if (blob.size <= MAX_UPLOAD_BYTES) break;
  }

  if (!bestBlob || bestBlob.size >= file.size) return file;

  return new File([bestBlob], makeCompressedName(file.name), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

function resolveUploadedUrl(uploadUrl, responseUrl) {
  return resolveApiAssetUrl(uploadUrl, responseUrl);
}

export async function uploadProductImage(file, view = "front") {
  if (!file?.type?.startsWith("image/")) {
    throw new StoreApiError("Choose an image file.");
  }

  const uploadFile = await compressImageFile(file);
  const dataUrl = await readFileAsDataUrl(uploadFile);
  const response = await apiRequest("/api/uploads", {
    method: "POST",
    auth: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      dataUrl,
      filename: uploadFile.name || file.name || "dress-photo",
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
