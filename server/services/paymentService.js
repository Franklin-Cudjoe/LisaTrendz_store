import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "..", "payments.json");

class PaymentService {
  constructor(file = DATA_FILE) {
    this.file = file;
    this._data = { payments: [] };
    this._loaded = false;
  }

  async _ensureLoaded() {
    if (this._loaded) return;

    try {
      const raw = await fs.readFile(this.file, "utf8");
      const parsed = JSON.parse(raw);
      this._data = {
        payments: Array.isArray(parsed?.payments) ? parsed.payments : [],
      };
    } catch (e) {
      this._data = { payments: [] };
      await this._write();
    }

    this._loaded = true;
  }

  async _write() {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(this._data, null, 2), "utf8");
  }

  async get(reference) {
    await this._ensureLoaded();

    return (
      this._data.payments.find(
        (payment) => payment.reference === reference,
      ) || null
    );
  }

  async findByOrderSmsMessageId(messageId) {
    await this._ensureLoaded();

    return (
      this._data.payments.find(
        (payment) =>
          payment.notifications?.orderCodeSms?.messageId === messageId,
      ) || null
    );
  }

  async upsert(reference, data = {}) {
    await this._ensureLoaded();

    const now = Date.now();
    const existingIndex = this._data.payments.findIndex(
      (payment) => payment.reference === reference,
    );
    const existing =
      existingIndex >= 0 ? this._data.payments[existingIndex] : null;
    const payment = {
      ...existing,
      ...data,
      reference,
      createdAt: existing?.createdAt || data.createdAt || now,
      updatedAt: now,
    };

    if (existingIndex >= 0) {
      this._data.payments[existingIndex] = payment;
    } else {
      this._data.payments.unshift(payment);
    }

    await this._write();
    return payment;
  }
}

const service = new PaymentService();
export default service;
