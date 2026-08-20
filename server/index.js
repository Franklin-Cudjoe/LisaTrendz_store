import express from "express";
import fs from "fs/promises";
import path from "path";
import http from "http";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { Server as IOServer } from "socket.io";
import orderService from "./services/orderService.js";
import cors from "cors";
import bodyParser from "body-parser";
import basicAuth from "basic-auth";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import morgan from "morgan";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.join(__dirname, "..");
const DATA_PATH =
  process.env.PRODUCTS_DATA_PATH || path.join(__dirname, "products.json");
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, "uploads");

// Middleware
app.use(helmet());
app.use(compression());
app.use(bodyParser.json({ limit: "8mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d" }));

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

function cleanPrice(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
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
  const now = Date.now();

  return {
    ...existing,
    id,
    name,
    price: cleanPrice(input.price),
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

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
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
    res.json({ url: `/uploads/${storedName}` });
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

// Serve frontend in production if built
if (process.env.NODE_ENV === "production") {
  const staticPath = path.join(PROJECT_ROOT, "dist");
  app.use(express.static(staticPath));
  app.get("*", (req, res) => res.sendFile(path.join(staticPath, "index.html")));
}

// ===== Orders API =====
app.post("/api/orders", async (req, res) => {
  try {
    const order = await orderService.createOrder(req.body || {});
    // emit created
    if (global.io)
      global.io.emit("order:created", { orderId: order.id, order });
    res.json(order);
  } catch (e) {
    res.status(500).json({ error: e.message || "Failed to create order" });
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
    const order = await orderService.getOrder(id);
    if (!order) return res.status(404).json({ error: "Not found" });
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
