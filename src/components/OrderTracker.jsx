import React, { useEffect, useRef, useState } from "react";
import "../styles/tracker.css";
import { formatMoney } from "../utils/promotions.js";

const ALL_STATUSES = [
  "Payment Pending",
  "Placed",
  "Confirmed",
  "Packed",
  "Shipped",
  "Out For Delivery",
  "Delivered",
];

const CANCELLED_STATUSES = ["Cancelled", "Returned", "Delivery Failed"];
const ATTENTION_STATUSES = ["Payment Review"];

function readLocalOrder(id) {
  try {
    const raw = localStorage.getItem("orders");
    const orders = raw ? JSON.parse(raw) : {};

    return orders?.[id] || null;
  } catch (e) {
    return null;
  }
}

function getQuantity(item = {}) {
  const quantity = Number(item.quantity ?? item.qty ?? 1);

  return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
}

function getLineTotal(item = {}) {
  const lineTotal = Number(item.lineTotal);

  if (Number.isFinite(lineTotal)) return lineTotal;

  return Number(item.price || item.unitPrice || 0) * getQuantity(item);
}

function getOrderTotals(order = {}) {
  const subtotal = Number.isFinite(Number(order.subtotal))
    ? Number(order.subtotal)
    : (order.items || []).reduce((total, item) => total + getLineTotal(item), 0);
  const shipping = Number(order.shipping ?? order.delivery?.cost ?? 0) || 0;
  const discount = Number(order.discount?.totalDiscount || 0);
  const total = Number.isFinite(Number(order.total))
    ? Number(order.total)
    : Math.max(0, subtotal + shipping - discount);

  return { subtotal, shipping, discount, total };
}

function deliveryLabel(delivery) {
  if (!delivery) return "Delivery not selected";
  if (delivery.type === "pickup") return "Pick-up";
  if (delivery.method === "within") return "Delivery within Accra";
  if (delivery.method === "outside") return "Delivery outside Accra";

  return "Delivery";
}

function customerName(order = {}) {
  return (
    order.customer?.name ||
    order.customerName ||
    order.name ||
    "Customer"
  );
}

function maskPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length < 7) return "";

  return `${digits.slice(0, 3)}***${digits.slice(-4)}`;
}

function smsStatusLabel(notification = {}) {
  if (notification.sentAt) return "Sent";
  if (notification.status === "failed") return "Failed";
  if (notification.status === "skipped") return "Not enabled";

  return "Pending";
}

function statusClass(status) {
  if (ATTENTION_STATUSES.includes(status)) return "issue";
  if (status === "Payment Pending") return "pending";
  if (CANCELLED_STATUSES.includes(status)) return "issue";
  if (status === "Delivered") return "complete";

  return "active";
}

export default function OrderTracker({ orderId: initialOrderId, onBack }) {
  const [orderId, setOrderId] = useState(initialOrderId || "");
  const [order, setOrder] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (initialOrderId) loadOrder(initialOrderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrderId]);

  useEffect(() => {
    try {
      const io = window.io;
      if (!io) return;
      const socket = io(window.location.origin.replace(/^http/, "ws"));
      socketRef.current = socket;
      socket.on("order:update", (ev) => {
        if (!ev || !ev.orderId) return;
        if (ev.orderId === orderId) loadOrder(orderId);
      });
      return () => socket.disconnect();
    } catch (e) {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  async function loadOrder(id) {
    const code = String(id || "").trim();

    if (!code) return;

    setLoading(true);
    setOrderId(code);

    try {
      const tryFetch = async (p) => {
        try {
          const r = await fetch(p);
          if (!r.ok) throw new Error("no api");
          return r;
        } catch (e) {
          const alt =
            (window.location.hostname === "localhost"
              ? "http://localhost:4000"
              : window.location.origin) + p;
          const r2 = await fetch(alt);
          if (!r2.ok) throw new Error("no api");
          return r2;
        }
      };
      const res = await tryFetch(`/api/orders/${encodeURIComponent(code)}`);
      const data = await res.json();
      setOrder(data);

      try {
        const h = await tryFetch(
          `/api/orders/${encodeURIComponent(code)}/history`,
        );
        const hist = await h.json();
        setHistory(hist || []);
      } catch (e) {
        setHistory([]);
      }
    } catch (e) {
      const localOrder = readLocalOrder(code);

      setOrder(localOrder);
      setHistory(
        localOrder
          ? [
              {
                status: localOrder.currentStatus || "Placed",
                timestamp: localOrder.createdAt || Date.now(),
              },
            ]
          : [],
      );
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    loadOrder(orderId);
  }

  const currentStatus = order?.currentStatus || "Placed";
  const isCancelled = CANCELLED_STATUSES.includes(currentStatus);
  const needsAttention = ATTENTION_STATUSES.includes(currentStatus);
  const currentIdx = ALL_STATUSES.indexOf(currentStatus);
  const showPipeline = !isCancelled && !needsAttention && currentIdx >= 0;
  const totals = getOrderTotals(order || {});
  const orderSms = order?.notifications?.orderCodeSms || {};
  const customerPhone = order?.customer?.phone || order?.phone || "";

  return (
    <div className="tracker">
      {onBack && (
        <button className="back tracker-back" type="button" onClick={onBack}>
          Back
        </button>
      )}

      {!initialOrderId && (
        <form onSubmit={onSubmit} className="tracker-form">
          <input
            value={orderId}
            onChange={(e) => setOrderId(e.target.value.trim())}
            placeholder="Enter your order code"
          />
          <button className="btn" type="submit">
            Track
          </button>
        </form>
      )}

      {loading && <div className="tracker-muted">Loading...</div>}

      {!loading && !order && orderId && (
        <div className="tracker-muted">No order found. Check your code.</div>
      )}

      {order && (
        <div className="tracker-detail">
          <section className="tracker-overview">
            <div>
              <span className="tracker-kicker">Order Code</span>
              <h2>{order.orderCode || order.id}</h2>
              <p>
                {new Date(
                  order.createdAt || order.created || Date.now(),
                ).toLocaleString()}
              </p>
            </div>
            <div className="tracker-overview-side">
              <span className={`tracker-status ${statusClass(currentStatus)}`}>
                {currentStatus}
              </span>
              <strong>{formatMoney(totals.total)}</strong>
            </div>
          </section>

          <section className="tracker-section">
            <div className="tracker-section-heading">
              <h3>Ordered items</h3>
              <span>
                {(order.items || []).reduce(
                  (total, item) => total + getQuantity(item),
                  0,
                )}{" "}
                item(s)
              </span>
            </div>

            <div className="tracker-items">
              {(order.items || []).map((item, index) => (
                <article
                  className="tracker-item"
                  key={`${item.id || item.productId || "item"}-${index}`}
                >
                  <div className="tracker-item-image">
                    {item.image ? (
                      <img src={item.image} alt={item.name || "Ordered item"} />
                    ) : (
                      <span>{(item.name || "IT").slice(0, 2).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="tracker-item-main">
                    <h4>{item.name || item.id || "Item"}</h4>
                    <p>{item.category || "Collection"}</p>
                    <div className="tracker-item-tags">
                      {item.selectedSize && <span>Size {item.selectedSize}</span>}
                      {item.selectedColor?.name && (
                        <span>
                          Colour {item.selectedColor.name}
                          {item.selectedColor.value && (
                            <i
                              style={{
                                backgroundColor: item.selectedColor.value,
                              }}
                              aria-hidden="true"
                            />
                          )}
                        </span>
                      )}
                      <span>Qty {getQuantity(item)}</span>
                    </div>
                  </div>
                  <div className="tracker-item-price">
                    <span>{formatMoney(item.unitPrice || item.price || 0)}</span>
                    <strong>{formatMoney(getLineTotal(item))}</strong>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="tracker-section tracker-order-info">
            <div className="tracker-summary-panel">
              <h3>Amount</h3>
              <div>
                <span>Subtotal</span>
                <strong>{formatMoney(totals.subtotal)}</strong>
              </div>
              <div>
                <span>Delivery</span>
                <strong>{formatMoney(totals.shipping)}</strong>
              </div>
              {(order.promotion || totals.discount > 0) && (
                <div className="tracker-discount-line">
                  <span>
                    Promo
                    {order.promotion?.code ? ` (${order.promotion.code})` : ""}
                  </span>
                  <strong>
                    {totals.discount > 0
                      ? `-${formatMoney(totals.discount)}`
                      : "Applied"}
                  </strong>
                </div>
              )}
              <div className="tracker-total-line">
                <span>
                  {currentStatus === "Payment Pending" ? "Total to pay" : "Total paid"}
                </span>
                <strong>{formatMoney(totals.total)}</strong>
              </div>
            </div>

            <div className="tracker-summary-panel">
              <h3>Delivery</h3>
              <div>
                <span>Method</span>
                <strong>{deliveryLabel(order.delivery)}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{currentStatus}</strong>
              </div>
              {order.trackingNumber && (
                <div>
                  <span>Tracking number</span>
                  <strong>{order.trackingNumber}</strong>
                </div>
              )}
              {order.carrier && (
                <div>
                  <span>Carrier</span>
                  <strong>{order.carrier}</strong>
                </div>
              )}
            </div>

            <div className="tracker-summary-panel">
              <h3>Customer</h3>
              <div>
                <span>Name</span>
                <strong>{customerName(order)}</strong>
              </div>
              {maskPhone(customerPhone) && (
                <div>
                  <span>Mobile</span>
                  <strong>{maskPhone(customerPhone)}</strong>
                </div>
              )}
              <div>
                <span>Order code SMS</span>
                <strong>{smsStatusLabel(orderSms)}</strong>
              </div>
            </div>

            <div className="tracker-summary-panel">
              <h3>Payment</h3>
              <div>
                <span>Provider</span>
                <strong>{order.payment?.provider || "Paystack"}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong>{order.payment?.status || currentStatus}</strong>
              </div>
              {order.payment?.reference && (
                <div>
                  <span>Reference</span>
                  <strong>{order.payment.reference}</strong>
                </div>
              )}
              {order.payment?.method && (
                <div>
                  <span>Method</span>
                  <strong>{order.payment.method}</strong>
                </div>
              )}
            </div>
          </section>

          {isCancelled ? (
            <div className="tracker-cancelled">{currentStatus}</div>
          ) : needsAttention ? (
            <div className="tracker-cancelled">{currentStatus}</div>
          ) : showPipeline ? (
            <section className="tracker-section">
              <div className="tracker-section-heading">
                <h3>Status timeline</h3>
              </div>
              <div className="status-pipeline">
                {ALL_STATUSES.map((status, idx) => {
                  const isDone = idx < currentIdx;
                  const isCurrent = idx === currentIdx;
                  return (
                    <div
                      key={status}
                      className={
                        "pipeline-step" +
                        (isDone
                          ? " done"
                          : isCurrent
                            ? " current"
                            : " future")
                      }
                    >
                      <div className="pipeline-left">
                        <div className="pipeline-dot" />
                        {idx < ALL_STATUSES.length - 1 && (
                          <div className="pipeline-line" />
                        )}
                      </div>
                      <div className="pipeline-label">
                        <span className="pipeline-status">{status}</span>
                        {isCurrent &&
                          history.length > 0 &&
                          (() => {
                            const entry = [...history]
                              .reverse()
                              .find((h) => h.status === status);
                            return entry ? (
                              <span className="pipeline-time">
                                {new Date(entry.timestamp).toLocaleString()}
                              </span>
                            ) : null;
                          })()}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ) : null}
        </div>
      )}
    </div>
  );
}
