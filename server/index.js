import express from "express";
import fs from "fs/promises";
import path from "path";
import http from "http";
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
const DATA_PATH = path.join(process.cwd(), "server", "products.json");

// Middleware
app.use(helmet());
app.use(compression());
app.use(bodyParser.json({ limit: "200kb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

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

// Rate limiting for write endpoints
const writeLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });

function requireAuth(req, res, next) {
  const user = basicAuth(req);
  const ADMIN_USER = process.env.ADMIN_USER || "Franklin";
  const ADMIN_PASS = process.env.ADMIN_PASS || "Cudjoe";
  if (!user || user.name !== ADMIN_USER || user.pass !== ADMIN_PASS) {
    res.set("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).send({ error: "Unauthorized" });
  }
  return next();
}

// Utilities: atomic write with backup
async function writeProductsAtomic(list) {
  const tmpPath = DATA_PATH + ".tmp";
  const backupPath = DATA_PATH + ".bak";
  const data = JSON.stringify(list, null, 2);
  try {
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

app.get("/api/products", async (req, res) => {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const list = JSON.parse(raw);
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: "Failed to read products" });
  }
});

app.post("/api/products", writeLimiter, requireAuth, async (req, res) => {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const list = JSON.parse(raw);
    const item = req.body;
    list.unshift(item);
    await writeProductsAtomic(list);
    res.json(item);
  } catch (e) {
    res.status(500).json({ error: "Failed to create product" });
  }
});

app.put("/api/products/:id", writeLimiter, requireAuth, async (req, res) => {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    let list = JSON.parse(raw);
    const id = req.params.id;
    list = list.map((it) => (it.id === id ? { ...it, ...req.body } : it));
    await writeProductsAtomic(list);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to update product" });
  }
});

app.delete("/api/products/:id", writeLimiter, requireAuth, async (req, res) => {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    let list = JSON.parse(raw);
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
  const staticPath = path.join(process.cwd(), "dist");
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
