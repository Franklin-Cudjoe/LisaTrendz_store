import express from "express";
import fs from "fs/promises";
import path from "path";
import http from "http";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { Server as IOServer } from "socket.io";
import orderService from "./services/orderService.js";
import paymentService from "./services/paymentService.js";
import smsService, {
  isValidSmsPhone,
  normalizeSmsPhone,
} from "./services/smsService.js";
import cors from "cors";
import bodyParser from "body-parser";
import basicAuth from "basic-auth";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import morgan from "morgan";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..");

dotenv.config({ path: path.join(PROJECT_ROOT, ".env") });
dotenv.config({ path: path.join(__dirname, ".env"), override: true });

const app = express();
const PORT = process.env.PORT || 4000;
const DATA_PATH =
  process.env.PRODUCTS_DATA_PATH || path.join(__dirname, "products.json");
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");
const PAYSTACK_API_BASE = "https://api.paystack.co";
const PAYSTACK_DEFAULT_CHANNELS = ["card", "mobile_money"];

// Middleware
app.set("trust proxy", 1);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(compression());
app.use(
  bodyParser.json({
    limit: "8mb",
    verify(req, res, buffer) {
      req.rawBody = buffer;
    },
  }),
);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(
  "/uploads",
  express.static(UPLOAD_DIR, {
    maxAge: "7d",
    setHeaders(res) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    },
  }),
);

// CORS: allow same origin by default, but permit origins via env
const allowed = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
if (allowed.length) {
  app.use(cors({ origin: allowed }));
} else {
  app.use(cors());
}

// Rate limiting for write endpoints. Uploads are authenticated and can happen in
// large batches, so they get a separate, roomier bucket.
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 60 });
const uploadLimiter = rateLimit({ windowMs: 60 * 1000, max: 300 });

function requireAuth(req, res, next) {
  const user = basicAuth(req);
  const configuredUser = process.env.ADMIN_USER;
  const configuredPass = process.env.ADMIN_PASS;
  const acceptedCredentials = [
    [configuredUser || "owner", configuredPass || "lizzy"],
  ];

  if (!configuredUser && !configuredPass) {
    acceptedCredentials.push(["Franklin", "Cudjoe"]);
  }

  const isAccepted =
    user &&
    acceptedCredentials.some(
      ([name, pass]) => user.name === name && user.pass === pass,
    );

  if (!isAccepted) {
    res.set("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).send({ error: "Unauthorized" });
  }
  return next();
}

function isDevPaymentBypassEnabled(req) {
  const enabled = cleanString(process.env.DEV_PAYMENT_BYPASS).toLowerCase() === "true";
  const hostname = cleanString(req.hostname, 120).toLowerCase();
  const isLocalHost =
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]";

  return enabled && process.env.NODE_ENV !== "production" && isLocalHost;
}

// Utilities: atomic write with backup
async function readProducts() {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch (e) {
    if (e.code === "ENOENT") return [];
    throw e;
  }
}

async function writeProductsAtomic(list) {
  const tmpPath = DATA_PATH + ".tmp";
  const backupPath = DATA_PATH + ".bak";
  const data = JSON.stringify(list, null, 2);
  try {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    // create backup
    try {
      const existing = await fs.readFile(DATA_PATH, "utf8");
      await fs.writeFile(backupPath, existing, "utf8");
    } catch (e) {}
    await fs.writeFile(tmpPath, data, "utf8");
    await fs.rename(tmpPath, DATA_PATH);
  } catch (e) {
    throw e;
  }
}

function cleanString(value, maxLength = 500) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function sanitizeSmsCallbackPayload(value, depth = 0) {
  if (depth > 4) return "[truncated]";

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeSmsCallbackPayload(item, depth + 1));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (/recipient|phone|mobile|msisdn|destination|to/i.test(key)) {
          return [key, "[redacted]"];
        }

        return [key, sanitizeSmsCallbackPayload(item, depth + 1)];
      }),
    );
  }

  if (typeof value === "string") {
    return value.length > 300 ? `${value.slice(0, 300)}...` : value;
  }

  return value;
}

function getPublicOrigin(req) {
  const configuredOrigin = cleanString(process.env.PUBLIC_API_ORIGIN, 300).replace(
    /\/+$/,
    "",
  );

  if (configuredOrigin) return configuredOrigin;

  const forwardedProto = cleanString(req.get("x-forwarded-proto"), 40)
    .split(",")[0]
    ?.trim();
  const forwardedHost = cleanString(req.get("x-forwarded-host"), 300)
    .split(",")[0]
    ?.trim();
  const protocol = forwardedProto || req.protocol || "http";
  const host = forwardedHost || req.get("host");

  return host ? `${protocol}://${host}` : "";
}

function cleanPrice(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function cleanStock(value, fallback = null) {
  if (value === "" || value == null) return fallback;

  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : fallback;
}

function cleanBoolean(value, fallback = true) {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

function cleanImageValue(value) {
  if (typeof value === "string") return cleanString(value, 1200);
  if (value && typeof value === "object") {
    return cleanString(value.url || value.src || value.image || "", 1200);
  }

  return "";
}

function appendImage(list, value) {
  const url = cleanImageValue(value);

  if (!url || list.includes(url)) return list;

  return [...list, url];
}

function cleanImageList(input = {}) {
  let images = [];

  if (Array.isArray(input.images)) {
    input.images.forEach((image) => {
      images = appendImage(images, image);
    });
  } else if (input.images && typeof input.images === "object") {
    images = appendImage(images, input.images.front);
    images = appendImage(images, input.images.back);
    images = appendImage(images, input.images.main);
  }

  [
    input.imageFront,
    input.frontImage,
    input.image,
    input.imageBack,
    input.backImage,
  ].forEach((image) => {
    images = appendImage(images, image);
  });

  return images;
}

function cleanColorValue(value) {
  const color = cleanString(value, 24);
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : "";
}

function cleanColorOption(input, index = 0) {
  let name = "";
  let value = "";

  if (typeof input === "string") {
    const text = cleanString(input, 44);
    value = cleanColorValue(text);
    name = value ? `Colour ${index + 1}` : text;
  } else if (input && typeof input === "object") {
    name = cleanString(input.name || input.label || input.title, 44);
    value = cleanColorValue(input.value || input.hex || input.color);
  }

  if (!name && value) {
    name = `Colour ${index + 1}`;
  }

  if (!name) return null;

  return {
    name,
    value: value || "#20232a",
  };
}

function cleanColorList(input = {}) {
  const rawColors = input.colors || input.colours || input.availableColors || [];
  const colorInput = Array.isArray(rawColors)
    ? rawColors
    : typeof rawColors === "string"
      ? rawColors.split(",")
      : [];
  const seen = new Set();

  return colorInput.reduce((list, color, index) => {
    const clean = cleanColorOption(color, index);

    if (!clean) return list;

    const key = `${clean.name.toLowerCase()}|${clean.value}`;
    if (seen.has(key)) return list;

    seen.add(key);
    return [...list, clean];
  }, []);
}

function sanitizeProduct(input = {}, existing = {}) {
  const id = cleanString(input.id || existing.id, 80) || crypto.randomUUID();
  const name = cleanString(input.name, 120);
  const category = cleanString(input.category, 80) || "Dresses";
  const images = cleanImageList(input);
  const imageFront = images[0] || "";
  const imageBack = images[1] || "";
  const colors = cleanColorList(input);
  const description = cleanString(input.description, 800);
  const active = cleanBoolean(input.active, existing.active !== false);
  const stock = cleanStock(input.stock, existing.stock ?? null);
  const now = Date.now();

  return {
    ...existing,
    id,
    name,
    price: cleanPrice(input.price),
    stock,
    category,
    image: imageFront,
    imageFront,
    imageBack,
    images,
    colors,
    description,
    active,
    createdAt: existing.createdAt || input.createdAt || now,
    updatedAt: now,
  };
}

function getOrderItemQuantity(item = {}) {
  const quantity = Number(item.quantity ?? item.qty ?? 1);

  return Number.isFinite(quantity) && quantity > 0 ? Math.ceil(quantity) : 1;
}

async function reserveOrderStock(items = []) {
  const productItems = Array.isArray(items) ? items : [];
  if (productItems.length === 0) return;

  const list = await readProducts();
  let changed = false;

  const next = list.map((product) => {
    const stock = cleanStock(product.stock, null);
    if (stock == null) return product;

    const requested = productItems.reduce((total, item) => {
      if (item.id !== product.id) return total;
      return total + getOrderItemQuantity(item);
    }, 0);

    if (requested <= 0) return product;

    if (stock < requested) {
      const label = product.name || product.id || "Item";
      const error = new Error(`${label} has only ${stock} left.`);
      error.status = 409;
      throw error;
    }

    changed = true;
    return {
      ...product,
      stock: stock - requested,
      updatedAt: Date.now(),
    };
  });

  if (changed) {
    await writeProductsAtomic(next);
  }
}

const SERVER_PROMO_CODES = {
  LISA10: { code: "LISA10", type: "percent", value: 10, minSubtotal: 0 },
  TREND20: { code: "TREND20", type: "amount", value: 20, minSubtotal: 150 },
  FREESHIP: { code: "FREESHIP", type: "shipping", value: 0, minSubtotal: 0 },
};

function createHttpError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function cleanEmail(value) {
  const email = cleanString(value, 180).toLowerCase();

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function cleanPaystackReference(value) {
  return cleanString(value, 80).replace(/[^A-Za-z0-9._=-]/g, "");
}

function cleanPhone(value) {
  return cleanString(value, 40).replace(/[^\d+()\-\s]/g, "");
}

function cleanSelectedColor(value) {
  if (!value || typeof value !== "object") return null;

  const name = cleanString(value.name || value.label || value.title, 44);
  const colorValue = cleanColorValue(value.value || value.hex || value.color);

  if (!name && !colorValue) return null;

  return {
    name: name || "Selected colour",
    value: colorValue || "#20232a",
  };
}

function sanitizeCustomer(input = {}) {
  const name = cleanString(input.name, 120);
  const email = cleanEmail(input.email);
  const phone = normalizeSmsPhone(cleanPhone(input.phone));

  if (name.length < 2) {
    throw createHttpError("Enter the full name for this order.", 400);
  }

  if (!email) {
    throw createHttpError("Enter a valid email address for Paystack.", 400);
  }

  if (!isValidSmsPhone(phone)) {
    throw createHttpError(
      "Enter a valid mobile number for payment updates.",
      400,
    );
  }

  return {
    name,
    email,
    phone,
  };
}

function normalizePromoCode(value) {
  return cleanString(value, 40).toUpperCase().replace(/\s+/g, "");
}

function findServerPromo(promotion) {
  const code = normalizePromoCode(
    typeof promotion === "string" ? promotion : promotion?.code,
  );

  return code ? SERVER_PROMO_CODES[code] || null : null;
}

function calculateServerPromoDiscount(promotion, subtotal, shipping) {
  const promo = findServerPromo(promotion);

  if (!promo || subtotal < Number(promo.minSubtotal || 0)) {
    return {
      promo: null,
      discount: { subtotalDiscount: 0, shippingDiscount: 0, totalDiscount: 0 },
    };
  }

  let subtotalDiscount = 0;
  let shippingDiscount = 0;

  if (promo.type === "percent") {
    subtotalDiscount = subtotal * (Number(promo.value || 0) / 100);
  } else if (promo.type === "amount") {
    subtotalDiscount = Number(promo.value || 0);
  } else if (promo.type === "shipping") {
    shippingDiscount = shipping;
  }

  subtotalDiscount = Math.min(subtotal, Math.max(0, subtotalDiscount));
  shippingDiscount = Math.min(shipping, Math.max(0, shippingDiscount));

  return {
    promo,
    discount: {
      subtotalDiscount,
      shippingDiscount,
      totalDiscount: subtotalDiscount + shippingDiscount,
    },
  };
}

function normalizeDelivery(input = {}) {
  if (input?.type === "ship" && input?.method === "within") {
    return { type: "ship", method: "within", cost: 50 };
  }

  if (input?.type === "ship" && input?.method === "outside") {
    return { type: "ship", method: "outside", cost: 100 };
  }

  return { type: "pickup", cost: 0 };
}

function toPaystackSubunit(amount) {
  const parsed = Number(amount);

  if (!Number.isFinite(parsed) || parsed <= 0) return 0;

  return Math.round(parsed * 100);
}

function fromPaystackSubunit(amount) {
  return Math.round(Number(amount || 0)) / 100;
}

function getPaystackSecret() {
  return cleanString(process.env.PAYSTACK_SECRET_KEY, 300);
}

function getPaystackCurrency() {
  return cleanString(process.env.PAYSTACK_CURRENCY || "GHS", 8).toUpperCase();
}

function getPaystackChannels() {
  const allowed = new Set([
    "card",
    "bank",
    "ussd",
    "qr",
    "mobile_money",
    "bank_transfer",
    "eft",
  ]);
  const channels = cleanString(process.env.PAYSTACK_CHANNELS, 200)
    .split(",")
    .map((channel) => channel.trim())
    .filter((channel) => allowed.has(channel));

  return channels.length > 0 ? channels : PAYSTACK_DEFAULT_CHANNELS;
}

function getFrontendOrigin(req) {
  const configured = cleanString(process.env.PUBLIC_SITE_ORIGIN, 300).replace(
    /\/+$/,
    "",
  );

  if (configured) return configured;

  const requestOrigin = cleanString(req.get("origin"), 300).replace(/\/+$/, "");

  if (requestOrigin) return requestOrigin;

  const referer = cleanString(req.get("referer"), 500);

  try {
    if (referer) return new URL(referer).origin;
  } catch (e) {}

  return getPublicOrigin(req);
}

function buildPaystackCallbackUrl(req) {
  const origin = getFrontendOrigin(req);

  return origin ? `${origin}/?payment=paystack` : undefined;
}

async function makeUniqueOrderCode() {
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = `ORD-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    const existingOrder = await orderService.getOrder(code);
    const existingPayment = await paymentService.get(code);

    if (!existingOrder && !existingPayment) return code;
  }

  throw createHttpError("Could not generate an order code.", 500);
}

async function paystackRequest(endpoint, { method = "GET", body } = {}) {
  const secret = getPaystackSecret();

  if (!secret) {
    throw createHttpError("Paystack is not configured yet.", 503);
  }

  if (typeof fetch !== "function") {
    throw createHttpError("This server needs Node 18+ for Paystack payments.", 500);
  }

  const response = await fetch(`${PAYSTACK_API_BASE}${endpoint}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let payload = null;

  try {
    payload = await response.json();
  } catch (e) {}

  if (!response.ok || payload?.status === false) {
    throw createHttpError(
      payload?.message || "Paystack request failed.",
      response.status || 502,
    );
  }

  return payload;
}

async function buildPaystackOrderPayload(input = {}, reference, customer) {
  const sourceItems = Array.isArray(input.items) ? input.items : [];

  if (sourceItems.length === 0) {
    throw createHttpError("Your cart is empty.", 400);
  }

  const catalog = await readProducts();
  const catalogById = new Map(
    catalog
      .filter((product) => product && product.active !== false)
      .map((product) => [product.id, product]),
  );

  const items = sourceItems.map((item) => {
    const productId = cleanString(item.productId || item.id, 80);
    const product = catalogById.get(productId);

    if (!product) {
      throw createHttpError("One of the items is no longer available.", 400);
    }

    const quantity = getOrderItemQuantity(item);
    const stock = cleanStock(product.stock, null);

    if (stock != null && stock < quantity) {
      throw createHttpError(`${product.name} has only ${stock} left.`, 409);
    }

    const unitPrice = cleanPrice(product.price);
    const images = cleanImageList(product);
    const productColors = cleanColorList(product);
    const selectedColor = cleanSelectedColor(item.selectedColor) || productColors[0] || null;

    return {
      id: product.id,
      productId: product.id,
      name: cleanString(product.name, 120) || "Item",
      category: cleanString(product.category, 80) || "Collection",
      description: cleanString(product.description, 800),
      image: product.image || product.imageFront || images[0] || "",
      selectedColor,
      selectedSize: cleanString(item.selectedSize, 16),
      quantity,
      qty: quantity,
      unitPrice,
      price: unitPrice,
      lineTotal: unitPrice * quantity,
    };
  });

  function formatOrderItemSummary(item) {
    const variant = [item.selectedSize, item.selectedColor?.name]
      .filter(Boolean)
      .join("/");

    return `${item.name}${variant ? ` (${variant})` : ""} x ${item.quantity}`;
  }

  const delivery = normalizeDelivery(input.delivery);
  const subtotal = items.reduce((total, item) => total + item.lineTotal, 0);
  const shipping = delivery.cost;
  const promoResult = calculateServerPromoDiscount(
    input.promotion,
    subtotal,
    shipping,
  );
  const total = Math.max(
    0,
    subtotal + shipping - promoResult.discount.totalDiscount,
  );
  const currency = getPaystackCurrency();

  if (total <= 0) {
    throw createHttpError("The order total must be greater than zero.", 400);
  }

  return {
    id: reference,
    orderCode: reference,
    userId: null,
    customer,
    email: customer.email,
    phone: customer.phone,
    items,
    itemCount: items.reduce((count, item) => count + item.quantity, 0),
    itemSummary: items
      .map(formatOrderItemSummary)
      .join(", "),
    subtotal,
    shipping,
    discount: promoResult.discount,
    promotion: promoResult.promo
      ? { code: promoResult.promo.code, type: promoResult.promo.type }
      : null,
    delivery,
    total,
    amountPaid: 0,
    currency,
    currentStatus: "Payment Pending",
    payment: {
      provider: "paystack",
      reference,
      status: "initialized",
      channels: getPaystackChannels(),
    },
    metadata: {
      paystackReference: reference,
      paymentProvider: "paystack",
    },
    createdAt: Date.now(),
  };
}

function getPaystackChannel(data = {}) {
  return (
    data.channel ||
    data.authorization?.channel ||
    data.authorization?.card_type ||
    ""
  );
}

function getPaystackPaymentMethod(data = {}) {
  const channel = getPaystackChannel(data);
  const bank = data.authorization?.bank;
  const brand = data.authorization?.brand || data.authorization?.card_type;

  if (channel === "card" && brand) return `${brand} card`;
  if (channel === "mobile_money" && bank) return `Mobile money - ${bank}`;
  if (channel) return channel.replace(/_/g, " ");

  return "Paystack";
}

async function updateOrderPayment(orderId, paymentPatch = {}) {
  const current = await orderService.getOrder(orderId);

  if (!current) return null;

  return orderService.updateOrder(orderId, {
    amountPaid:
      paymentPatch.status === "success"
        ? Number(paymentPatch.amount || current.total || 0)
        : current.amountPaid || 0,
    payment: {
      ...(current.payment || {}),
      ...paymentPatch,
    },
    metadata: {
      ...(current.metadata || {}),
      paystackReference: paymentPatch.reference || current.payment?.reference,
      paymentProvider: "paystack",
    },
  });
}

function getNotificationReceiptInfo(order = {}, payment = {}) {
  const orderCustomer =
    order.customer && typeof order.customer === "object" ? order.customer : {};
  const paymentCustomer =
    payment.customer && typeof payment.customer === "object"
      ? payment.customer
      : {};
  const paymentReceiptInfo =
    payment.receiptInfo && typeof payment.receiptInfo === "object"
      ? payment.receiptInfo
      : {};
  const payload = payment.orderPayload || {};
  const payloadCustomer =
    payload.customer && typeof payload.customer === "object"
      ? payload.customer
      : {};
  const name =
    cleanString(orderCustomer.name, 120) ||
    cleanString(paymentReceiptInfo.name, 120) ||
    cleanString(paymentCustomer.name, 120) ||
    cleanString(payloadCustomer.name, 120);
  const email =
    cleanEmail(orderCustomer.email) ||
    cleanEmail(order.email) ||
    cleanEmail(paymentReceiptInfo.email) ||
    cleanEmail(paymentCustomer.email) ||
    cleanEmail(payloadCustomer.email) ||
    cleanEmail(payload.email);
  const phone =
    normalizeSmsPhone(cleanPhone(orderCustomer.phone)) ||
    normalizeSmsPhone(cleanPhone(order.phone)) ||
    normalizeSmsPhone(cleanPhone(payment.smsRecipient)) ||
    normalizeSmsPhone(cleanPhone(paymentReceiptInfo.phone)) ||
    normalizeSmsPhone(cleanPhone(paymentCustomer.phone)) ||
    normalizeSmsPhone(cleanPhone(payloadCustomer.phone)) ||
    normalizeSmsPhone(cleanPhone(payload.phone));

  return {
    customer: {
      name,
      email,
      phone,
    },
    email,
    phone,
  };
}

async function sendOrderCodeNotification(reference, order, context = {}) {
  if (!order) return null;

  const payment = await paymentService.get(reference);
  const existingNotification = payment?.notifications?.orderCodeSms;
  const receiptInfo = getNotificationReceiptInfo(order, payment || {});
  const notificationOrder = {
    ...order,
    customer: {
      ...(order.customer || {}),
      ...receiptInfo.customer,
    },
    email: receiptInfo.email || order.email,
    phone: receiptInfo.phone || order.phone,
  };

  if (existingNotification?.sentAt) {
    return existingNotification;
  }

  try {
    const result = await smsService.sendOrderCodeSms(notificationOrder, {
      ...context,
      receiptInfo,
    });
    const now = Date.now();
    const notification = result.sent
      ? {
          provider: result.provider,
          messageId: result.id,
          status: result.status || "sent",
          providerMessage: result.providerMessage || null,
          providerResponse: result.providerResponse || null,
          deliveryStatus: result.deliveryStatus || "accepted_by_provider",
          callbackConfigured: result.callbackConfigured || false,
          creditsUsed: result.creditsUsed || null,
          to: result.to || receiptInfo.phone || order.phone || order.customer?.phone,
          recipientSource: "receipt_info_phone",
          messagePreview: result.messagePreview || null,
          sentAt: now,
        }
      : {
          status: result.skipped ? "skipped" : "not_sent",
          reason: result.reason || "SMS was not sent.",
          messagePreview: result.messagePreview || null,
          lastAttemptAt: now,
        };

    if (payment) {
      await paymentService.upsert(reference, {
        ...payment,
        notifications: {
          ...(payment.notifications || {}),
          orderCodeSms: notification,
        },
      });
    }

    await orderService.updateOrder(order.id, {
      customer: notificationOrder.customer,
      email: notificationOrder.email,
      phone: notificationOrder.phone,
      notifications: {
        ...(order.notifications || {}),
        orderCodeSms: notification,
      },
    });

    return notification;
  } catch (e) {
    const notification = {
      status: "failed",
      reason: e.message || "SMS could not be sent.",
      lastAttemptAt: Date.now(),
    };

    if (payment) {
      await paymentService.upsert(reference, {
        ...payment,
        notifications: {
          ...(payment.notifications || {}),
          orderCodeSms: notification,
        },
      });
    }

    await orderService.updateOrder(order.id, {
      customer: notificationOrder.customer,
      email: notificationOrder.email,
      phone: notificationOrder.phone,
      notifications: {
        ...(order.notifications || {}),
        orderCodeSms: notification,
      },
    });

    return notification;
  }
}

function getSmsDeliveryReport(req) {
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const source = { ...req.query, ...body };
  const messageId = cleanString(
    source.sms_id ||
      source.campaign_id ||
      source.message_id ||
      source.messageId ||
      source.id ||
      "",
    120,
  );
  const status = cleanString(
    source.status ||
      source.delivery_status ||
      source.deliveryStatus ||
      source.state ||
      "",
    80,
  );

  return {
    messageId,
    status,
    raw: sanitizeSmsCallbackPayload(source),
  };
}

async function recordSmsDeliveryReport(report = {}) {
  if (!report.messageId) return false;

  const payment = await paymentService.findByOrderSmsMessageId(report.messageId);
  if (!payment) return false;

  const now = Date.now();
  const current = payment.notifications?.orderCodeSms || {};
  const status = report.status || current.deliveryStatus || "delivery_reported";
  const statusKey = status.toLowerCase();
  const reportEntry = {
    messageId: report.messageId,
    status,
    receivedAt: now,
    raw: report.raw,
  };
  const notification = {
    ...current,
    deliveryStatus: status,
    deliveryUpdatedAt: now,
    deliveredAt:
      /deliver|success/.test(statusKey) && !/fail|undeliver|reject/.test(statusKey)
        ? current.deliveredAt || now
        : current.deliveredAt || null,
    deliveryReports: [...(current.deliveryReports || []), reportEntry].slice(-10),
  };

  await paymentService.upsert(payment.reference, {
    ...payment,
    notifications: {
      ...(payment.notifications || {}),
      orderCodeSms: notification,
    },
  });

  const orderId = payment.orderId || payment.orderPayload?.id || payment.reference;
  const order = await orderService.getOrder(orderId);

  if (order) {
    await orderService.updateOrder(order.id, {
      notifications: {
        ...(order.notifications || {}),
        orderCodeSms: notification,
      },
    });
  }

  return true;
}

async function completePaystackPayment(reference, { eventData = null } = {}) {
  const cleanReference = cleanPaystackReference(reference);

  if (!cleanReference) {
    throw createHttpError("Missing Paystack reference.", 400);
  }

  const payment = await paymentService.get(cleanReference);

  if (!payment) {
    throw createHttpError("Payment reference not found.", 404);
  }

  const verified = eventData
    ? { data: eventData }
    : await paystackRequest(
        `/transaction/verify/${encodeURIComponent(cleanReference)}`,
      );
  const data = verified.data || {};
  const paystackStatus = cleanString(data.status, 60).toLowerCase();
  const expectedAmount = Number(payment.expectedAmount || 0);
  const actualAmount = Number(data.amount || 0);
  const expectedCurrency = cleanString(payment.currency, 8).toUpperCase();
  const actualCurrency = cleanString(data.currency, 8).toUpperCase();
  const order = await orderService.getOrder(payment.orderId || cleanReference);

  if (!order) {
    throw createHttpError("Order for this payment was not found.", 404);
  }

  if (
    paystackStatus !== "success" ||
    actualAmount !== expectedAmount ||
    actualCurrency !== expectedCurrency
  ) {
    const status =
      paystackStatus === "failed" || paystackStatus === "abandoned"
        ? "failed"
        : "pending";

    const updatedPayment = await paymentService.upsert(cleanReference, {
      ...payment,
      status,
      paystack: data,
      failureReason:
        paystackStatus === "success"
          ? "Amount or currency mismatch"
          : data.gateway_response || data.message || paystackStatus,
    });
    const updatedOrder = await updateOrderPayment(order.id, {
      provider: "paystack",
      reference: cleanReference,
      status,
      amount: fromPaystackSubunit(actualAmount),
      currency: actualCurrency || expectedCurrency,
      channel: getPaystackChannel(data),
      method: getPaystackPaymentMethod(data),
      verifiedAt: Date.now(),
    });

    if (status === "failed" && order.currentStatus === "Payment Pending") {
      await orderService.changeStatus(
        order.id,
        "Cancelled",
        "paystack",
        "Payment was not completed.",
        { force: true, idempotencyKey: `${cleanReference}-failed` },
      );
    }

    return {
      paid: false,
      status,
      order: (await orderService.getOrder(order.id)) || updatedOrder,
      payment: updatedPayment,
    };
  }

  let stockReserved = payment.stockReserved === true;

  if (!stockReserved) {
    try {
      await reserveOrderStock(order.items || payment.orderPayload?.items || []);
      stockReserved = true;
    } catch (e) {
      const updatedPayment = await paymentService.upsert(cleanReference, {
        ...payment,
        status: "paid_stock_review",
        stockReserved: false,
        paystack: data,
        failureReason: e.message,
      });

      await updateOrderPayment(order.id, {
        provider: "paystack",
        reference: cleanReference,
        status: "paid_stock_review",
        amount: fromPaystackSubunit(actualAmount),
        currency: actualCurrency,
        channel: getPaystackChannel(data),
        method: getPaystackPaymentMethod(data),
        verifiedAt: Date.now(),
      });

      if (order.currentStatus === "Payment Pending") {
        await orderService.changeStatus(
          order.id,
          "Payment Review",
          "paystack",
          e.message || "Payment received but stock needs review.",
          { force: true, idempotencyKey: `${cleanReference}-stock-review` },
        );
      }

      const reviewOrder = await orderService.getOrder(order.id);
      const notification = await sendOrderCodeNotification(cleanReference, reviewOrder, {
        status: "paid_stock_review",
      });

      return {
        paid: true,
        status: "paid_stock_review",
        order: await orderService.getOrder(order.id),
        payment: (await paymentService.get(cleanReference)) || updatedPayment,
        notification,
      };
    }
  }

  const updatedPayment = await paymentService.upsert(cleanReference, {
    ...payment,
    status: "success",
    stockReserved,
    paidAt: Date.now(),
    paystack: data,
  });

  await updateOrderPayment(order.id, {
    provider: "paystack",
    reference: cleanReference,
    status: "success",
    amount: fromPaystackSubunit(actualAmount),
    currency: actualCurrency,
    channel: getPaystackChannel(data),
    method: getPaystackPaymentMethod(data),
    verifiedAt: Date.now(),
    authorization:
      data.authorization && typeof data.authorization === "object"
        ? {
            authorizationCode: data.authorization.authorization_code,
            cardType: data.authorization.card_type,
            last4: data.authorization.last4,
            bank: data.authorization.bank,
          }
        : null,
  });

  const latestOrder = await orderService.getOrder(order.id);

  if (latestOrder?.currentStatus === "Payment Pending") {
    await orderService.changeStatus(
      order.id,
      "Placed",
      "paystack",
      "Payment verified.",
      { force: true, idempotencyKey: `${cleanReference}-success` },
    );
  }

  const confirmedOrder = await orderService.getOrder(order.id);
  const notification = await sendOrderCodeNotification(cleanReference, confirmedOrder, {
    status: "success",
  });

  return {
    paid: true,
    status: "success",
    order: await orderService.getOrder(order.id),
    payment: (await paymentService.get(cleanReference)) || updatedPayment,
    notification,
  };
}

async function refreshPaystackOrderIfNeeded(order) {
  if (!order) return order;

  const provider = cleanString(order.payment?.provider, 40).toLowerCase();
  const reference = cleanPaystackReference(
    order.payment?.reference || order.orderCode || order.id,
  );
  const paymentStatus = cleanString(order.payment?.status, 60).toLowerCase();
  const smsSent = Boolean(order.notifications?.orderCodeSms?.sentAt);

  if (provider !== "paystack" || !reference) {
    return order;
  }

  if (paymentStatus === "success" && smsSent) {
    return order;
  }

  try {
    const result = await completePaystackPayment(reference);

    return result.order || (await orderService.getOrder(order.id)) || order;
  } catch (e) {
    return order;
  }
}

function verifyPaystackSignature(req) {
  const secret = getPaystackSecret();
  const signature = cleanString(req.get("x-paystack-signature"), 300);

  if (!secret || !signature || !req.rawBody) return false;

  const hash = crypto
    .createHmac("sha512", secret)
    .update(req.rawBody)
    .digest("hex");
  const hashBuffer = Buffer.from(hash);
  const signatureBuffer = Buffer.from(signature);

  return (
    hashBuffer.length === signatureBuffer.length &&
    crypto.timingSafeEqual(hashBuffer, signatureBuffer)
  );
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.all("/api/sms/arkesel/delivery-report", async (req, res) => {
  try {
    const report = getSmsDeliveryReport(req);
    const matched = await recordSmsDeliveryReport(report);

    res.json({ received: true, matched });
  } catch (e) {
    res.status(500).json({ error: "Failed to record SMS delivery report" });
  }
});

app.post("/api/dev/paystack-bypass", writeLimiter, async (req, res) => {
  if (!isDevPaymentBypassEnabled(req)) {
    return res.status(404).json({ error: "Not found" });
  }

  try {
    const customer = sanitizeCustomer(req.body?.customer || {});
    const requestedReference = cleanPaystackReference(
      req.body?.order?.orderCode || req.body?.order?.id || "",
    );
    const reference = requestedReference || (await makeUniqueOrderCode());
    const orderPayload = await buildPaystackOrderPayload(
      req.body?.order || {},
      reference,
      customer,
    );
    const now = Date.now();
    const testOrderPayload = {
      ...orderPayload,
      amountPaid: orderPayload.total,
      currentStatus: "Placed",
      payment: {
        provider: "dev_bypass",
        reference,
        status: "success",
        amount: orderPayload.total,
        currency: orderPayload.currency,
        method: "Development payment bypass",
        verifiedAt: now,
      },
      metadata: {
        ...(orderPayload.metadata || {}),
        paymentProvider: "dev_bypass",
        devPaymentBypass: true,
      },
    };

    await paymentService.upsert(reference, {
      provider: "dev_bypass",
      orderId: reference,
      orderPayload: testOrderPayload,
      expectedAmount: toPaystackSubunit(testOrderPayload.total),
      currency: testOrderPayload.currency,
      customer,
      receiptInfo: customer,
      smsRecipient: customer.phone,
      status: "success",
      stockReserved: false,
      paidAt: now,
      devPaymentBypass: true,
    });

    let order = await orderService.getOrder(reference);

    if (!order) {
      order = await orderService.createOrder(testOrderPayload);
    } else {
      order = await orderService.updateOrder(reference, testOrderPayload);
    }

    const notification = await sendOrderCodeNotification(reference, order, {
      status: "success",
      devPaymentBypass: true,
    });

    res.json({
      paid: true,
      status: "success",
      bypass: true,
      order: await orderService.getOrder(order.id),
      notification,
    });
  } catch (e) {
    res
      .status(e.status || 500)
      .json({ error: e.message || "Failed to run the payment test bypass" });
  }
});

app.post("/api/paystack/initialize", writeLimiter, async (req, res) => {
  try {
    const customer = sanitizeCustomer(req.body?.customer || {});
    const requestedReference = cleanPaystackReference(
      req.body?.order?.orderCode || req.body?.order?.id || "",
    );
    const reference = requestedReference || (await makeUniqueOrderCode());
    const orderPayload = await buildPaystackOrderPayload(
      req.body?.order || {},
      reference,
      customer,
    );
    const amount = toPaystackSubunit(orderPayload.total);
    const currency = orderPayload.currency;
    const callbackUrl = buildPaystackCallbackUrl(req);
    const channels = getPaystackChannels();
    const initializePayload = {
      email: customer.email,
      amount,
      currency,
      reference,
      channels,
      metadata: JSON.stringify({
        order_code: reference,
        customer_name: customer.name,
        customer_phone: customer.phone,
        item_summary: orderPayload.itemSummary,
      }),
    };

    if (callbackUrl) {
      initializePayload.callback_url = callbackUrl;
    }

    const initialized = await paystackRequest("/transaction/initialize", {
      method: "POST",
      body: initializePayload,
    });
    const data = initialized.data || {};
    const paymentRecord = await paymentService.upsert(reference, {
      provider: "paystack",
      orderId: reference,
      orderPayload: {
        ...orderPayload,
        payment: {
          ...orderPayload.payment,
          accessCode: data.access_code,
          authorizationUrl: data.authorization_url,
          channels,
        },
      },
      expectedAmount: amount,
      currency,
      customer,
      receiptInfo: customer,
      smsRecipient: customer.phone,
      status: "initialized",
      stockReserved: false,
      accessCode: data.access_code,
      authorizationUrl: data.authorization_url,
      channels,
      paystack: { initialized: data },
    });

    let order = await orderService.getOrder(reference);

    if (!order) {
      order = await orderService.createOrder(paymentRecord.orderPayload);
    } else if (order.currentStatus === "Payment Pending") {
      order = await orderService.updateOrder(reference, paymentRecord.orderPayload);
    }

    res.json({
      reference,
      authorizationUrl: data.authorization_url,
      accessCode: data.access_code,
      order,
    });
  } catch (e) {
    res
      .status(e.status || 500)
      .json({ error: e.message || "Failed to initialize Paystack payment" });
  }
});

app.get("/api/paystack/verify/:reference", async (req, res) => {
  try {
    const result = await completePaystackPayment(req.params.reference);

    res.status(result.paid && result.status === "success" ? 200 : 202).json(result);
  } catch (e) {
    res
      .status(e.status || 500)
      .json({ error: e.message || "Failed to verify Paystack payment" });
  }
});

app.post("/api/paystack/webhook", async (req, res) => {
  if (!verifyPaystackSignature(req)) {
    return res.status(401).json({ error: "Invalid Paystack signature" });
  }

  try {
    const event = req.body || {};
    const reference = event.data?.reference;

    if (event.event === "charge.success" && reference) {
      await completePaystackPayment(reference, { eventData: event.data });
    }

    res.sendStatus(200);
  } catch (e) {
    res.sendStatus(200);
  }
});

app.get("/api/products", async (req, res) => {
  try {
    const list = await readProducts();
    res.json(list.filter((item) => item.active !== false));
  } catch (e) {
    res.status(500).json({ error: "Failed to read products" });
  }
});

app.get("/api/admin/products", requireAuth, async (req, res) => {
  try {
    const list = await readProducts();
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: "Failed to read products" });
  }
});

app.post("/api/uploads", requireAuth, uploadLimiter, async (req, res) => {
  try {
    const { dataUrl, filename = "product-image" } = req.body || {};
    const match =
      typeof dataUrl === "string" &&
      dataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif|svg\+xml));base64,([A-Za-z0-9+/=]+)$/);

    if (!match) {
      return res.status(400).json({ error: "Invalid image payload" });
    }

    const mime = match[1] === "image/jpg" ? "image/jpeg" : match[1];
    const extensions = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
      "image/gif": "gif",
      "image/svg+xml": "svg",
    };
    const ext = extensions[mime];
    if (!ext) return res.status(400).json({ error: "Unsupported image type" });

    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length > 5 * 1024 * 1024) {
      return res.status(413).json({ error: "Image is too large" });
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const safeBase = path
      .basename(filename, path.extname(filename))
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "product-image";
    const storedName = `${Date.now()}-${crypto.randomUUID()}-${safeBase}.${ext}`;

    await fs.writeFile(path.join(UPLOAD_DIR, storedName), buffer);

    const uploadPath = `/uploads/${storedName}`;
    const publicOrigin = getPublicOrigin(req);

    res.json({
      url: publicOrigin ? `${publicOrigin}${uploadPath}` : uploadPath,
      path: uploadPath,
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to upload image" });
  }
});

app.post("/api/products", writeLimiter, requireAuth, async (req, res) => {
  try {
    const list = await readProducts();
    const item = sanitizeProduct(req.body || {});

    if (!item.name || item.images.length === 0 || item.price <= 0) {
      return res
        .status(400)
        .json({ error: "Name, price, and at least one photo are required" });
    }

    list.unshift(item);
    await writeProductsAtomic(list);
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: "Failed to create product" });
  }
});

app.put("/api/products/:id", writeLimiter, requireAuth, async (req, res) => {
  try {
    const list = await readProducts();
    const id = req.params.id;
    const existing = list.find((it) => it.id === id);

    if (!existing) return res.status(404).json({ error: "Product not found" });

    const updated = sanitizeProduct({ ...existing, ...(req.body || {}), id }, existing);

    if (!updated.name || updated.images.length === 0 || updated.price <= 0) {
      return res
        .status(400)
        .json({ error: "Name, price, and at least one photo are required" });
    }

    const next = list.map((it) => (it.id === id ? updated : it));
    await writeProductsAtomic(next);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: "Failed to update product" });
  }
});

app.delete("/api/products/:id", writeLimiter, requireAuth, async (req, res) => {
  try {
    let list = await readProducts();
    const id = req.params.id;
    list = list.filter((it) => it.id !== id);
    await writeProductsAtomic(list);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete product" });
  }
});

// ===== Orders API =====
app.post("/api/orders", async (req, res) => {
  try {
    const payload = req.body || {};

    await reserveOrderStock(payload.items || []);

    const order = await orderService.createOrder(payload);
    // emit created
    if (global.io)
      global.io.emit("order:created", { orderId: order.id, order });
    res.json(order);
  } catch (e) {
    res
      .status(e.status || 500)
      .json({ error: e.message || "Failed to create order" });
  }
});

app.get("/api/orders", requireAuth, async (req, res) => {
  try {
    const list = await orderService.listOrders(200);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: "Failed to list orders" });
  }
});

app.get("/api/orders/:id", async (req, res) => {
  try {
    const id = req.params.id;
    let order = await orderService.getOrder(id);
    if (!order) return res.status(404).json({ error: "Not found" });
    order = await refreshPaystackOrderIfNeeded(order);
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

app.get("/api/orders/:id/history", async (req, res) => {
  try {
    const id = req.params.id;
    const history = await orderService.getHistory(id);
    res.json(history);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

app.patch(
  "/api/orders/:id/status",
  writeLimiter,
  requireAuth,
  async (req, res) => {
    try {
      const id = req.params.id;
      const { status, actor, note, force, idempotencyKey } = req.body || {};
      if (!status) return res.status(400).json({ error: "Missing status" });
      const result = await orderService.changeStatus(
        id,
        status,
        actor || "admin",
        note || null,
        { force: !!force, idempotencyKey },
      );
      // broadcast update
      if (global.io)
        global.io.emit("order:update", {
          orderId: id,
          newStatus: status,
          entry: result.entry,
        });
      res.json({ success: true, order: result.order, entry: result.entry });
    } catch (e) {
      res.status(400).json({ error: e.message || "Failed to change status" });
    }
  },
);

// Serve frontend in production after all API routes.
if (process.env.NODE_ENV === "production") {
  const staticPath = path.join(PROJECT_ROOT, "dist");
  app.use(express.static(staticPath));
  app.get("*", (req, res) => res.sendFile(path.join(staticPath, "index.html")));
}

// Create HTTP server and attach Socket.IO for realtime updates
const server = http.createServer(app);
const io = new IOServer(server, {
  cors: { origin: allowed.length ? allowed : "*" },
});
global.io = io;

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);
  socket.on("subscribe:order", (orderId) => {
    socket.join(`order:${orderId}`);
  });
});

server.listen(PORT, () => {
  console.log("API server (with realtime) running on port", PORT);
});
