import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "orders.json");

const ALLOWED_TRANSITIONS = {
  "Payment Pending": ["Placed", "Payment Review", "Cancelled"],
  "Payment Review": ["Placed", "Cancelled"],
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

  _number(value, fallback = 0) {
    const parsed = Number(value);

    return Number.isFinite(parsed) ? parsed : fallback;
  }

  async createOrder(data = {}) {
    await this._ensureLoaded();
    const id =
      data.id ||
      (globalThis.crypto && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
    const now = this._now();
    const createdAt = data.createdAt || now;
    const items = Array.isArray(data.items) ? data.items : [];
    const itemCount =
      data.itemCount ||
      items.reduce(
        (total, item) => total + this._number(item.quantity ?? item.qty, 1),
        0,
      );
    const itemSummary =
      data.itemSummary ||
      items
        .map((item) => `${item.name || item.id || "Item"} x ${item.quantity || item.qty || 1}`)
        .join(", ");
    const order = {
      id,
      orderCode: data.orderCode || id,
      userId: data.userId || null,
      customer: data.customer || null,
      email: data.email || data.customer?.email || null,
      phone: data.phone || data.customer?.phone || null,
      items,
      itemCount,
      itemSummary,
      subtotal: this._number(data.subtotal),
      shipping: this._number(data.shipping),
      discount: data.discount || { subtotalDiscount: 0, shippingDiscount: 0, totalDiscount: 0 },
      promotion: data.promotion || null,
      delivery: data.delivery || null,
      total: this._number(data.total),
      amountPaid: this._number(data.amountPaid, this._number(data.total)),
      currency: data.currency || "GHS",
      payment: data.payment || null,
      currentStatus: data.currentStatus || "Placed",
      createdAt,
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

  async updateOrder(orderId, patch = {}) {
    await this._ensureLoaded();

    const order = await this.getOrder(orderId);

    if (!order) throw new Error("Order not found");

    Object.assign(order, patch, { id: order.id, updatedAt: this._now() });
    await this._write();
    return order;
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
