import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "orders.json");

const ALLOWED_TRANSITIONS = {
  Placed: ["Confirmed", "Cancelled"],
  Confirmed: ["Packed", "Cancelled"],
  Packed: ["Shipped", "Cancelled"],
  Shipped: ["Out For Delivery", "Delivery Failed"],
  "Out For Delivery": ["Delivered", "Delivery Failed"],
  "Delivery Failed": ["Out For Delivery", "Returned"],
};

class OrderService {
  constructor(file = DATA_FILE) {
    this.file = file;
    this._data = { orders: [], history: [] };
    this._loaded = false;
  }

  async _ensureLoaded() {
    if (this._loaded) return;
    try {
      const raw = await fs.readFile(this.file, "utf8");
      this._data = JSON.parse(raw);
    } catch (e) {
      this._data = { orders: [], history: [] };
      await this._write();
    }
    this._loaded = true;
  }

  async _write() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(this._data, null, 2), "utf8");
  }

  _now() {
    return Date.now();
  }

  async createOrder(data = {}) {
    await this._ensureLoaded();
    const id =
      data.id ||
      (globalThis.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    const now = this._now();
    const order = {
      id,
      userId: data.userId || null,
      items: data.items || [],
      total: data.total || 0,
      currency: data.currency || "USD",
      currentStatus: data.currentStatus || "Placed",
      createdAt: now,
      updatedAt: now,
      eta: data.eta || null,
      trackingNumber: data.trackingNumber || null,
      carrier: data.carrier || null,
      metadata: data.metadata || {},
    };
    this._data.orders.unshift(order);
    this._data.history.push({
      orderId: id,
      status: order.currentStatus,
      timestamp: now,
      actorId: "system",
      note: "order created",
    });
    await this._write();
    return order;
  }

  async getOrder(id) {
    await this._ensureLoaded();
    return this._data.orders.find((o) => o.id === id) || null;
  }

  async getHistory(orderId) {
    await this._ensureLoaded();
    return this._data.history
      .filter((h) => h.orderId === orderId)
      .map((r, i) => ({ id: i + 1, ...r }));
  }

  async changeStatus(
    orderId,
    newStatus,
    actorId = "system",
    note = null,
    options = {},
  ) {
    await this._ensureLoaded();
    const order = await this.getOrder(orderId);
    if (!order) throw new Error("Order not found");
    const current = order.currentStatus;
    const force = options.force === true;
    if (!force) {
      const allowed = ALLOWED_TRANSITIONS[current] || [];
      if (current !== newStatus && !allowed.includes(newStatus)) {
        throw new Error(`Invalid transition from ${current} to ${newStatus}`);
      }
    }
    const ts = this._now();
    order.currentStatus = newStatus;
    order.updatedAt = ts;
    this._data.history.push({
      orderId,
      status: newStatus,
      timestamp: ts,
      actorId,
      note,
      idempotencyKey: options.idempotencyKey || null,
    });
    await this._write();
    return { order, entry: this._data.history[this._data.history.length - 1] };
  }

  async listOrders(limit = 50) {
    await this._ensureLoaded();
    return this._data.orders.slice(0, limit);
  }
}

const service = new OrderService();
export default service;
