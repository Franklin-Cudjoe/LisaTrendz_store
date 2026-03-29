import React, { useEffect, useState, useRef } from "react";
import "../styles/tracker.css";

const ALL_STATUSES = [
  "Placed",
  "Confirmed",
  "Packed",
  "Shipped",
  "Out For Delivery",
  "Delivered",
];

const CANCELLED_STATUSES = ["Cancelled", "Returned", "Delivery Failed"];

export default function OrderTracker({ orderId: initialOrderId }) {
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
    if (!id) return;
    setLoading(true);
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
      const res = await tryFetch(`/api/orders/${id}`);
      const data = await res.json();
      setOrder(data);
      try {
        const h = await tryFetch(`/api/orders/${id}/history`);
        const hist = await h.json();
        setHistory(hist || []);
      } catch (e) {
        setHistory([]);
      }
    } catch (e) {
      setOrder(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    if (!orderId) return;
    loadOrder(orderId);
  }

  const currentStatus = order?.currentStatus || "Placed";
  const isCancelled = CANCELLED_STATUSES.includes(currentStatus);
  const currentIdx = ALL_STATUSES.indexOf(currentStatus);

  return (
    <div className="tracker" style={{ maxWidth: 640, margin: "0 auto" }}>
      {!initialOrderId && (
        <form
          onSubmit={onSubmit}
          className="tracker-form"
          style={{ marginBottom: 20 }}
        >
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

      {loading && <div style={{ padding: 16 }}>Loading…</div>}

      {!loading && !order && orderId && (
        <div style={{ color: "var(--muted)", padding: 16 }}>
          No order found. Check your code.
        </div>
      )}

      {order && (
        <div>
          {/* Header */}
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 2px" }}>Order {order.id}</h3>
                <div style={{ color: "var(--muted)", fontSize: ".85rem" }}>
                  {new Date(
                    order.createdAt || order.created || Date.now(),
                  ).toLocaleString()}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700, fontSize: "1.1rem" }}>
                  ${(order.total || 0).toFixed(2)}
                </div>
              </div>
            </div>

            {/* Items */}
            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
              }}
            >
              {(order.items || []).map((it, idx) => (
                <span
                  key={idx}
                  style={{
                    background: "#f0f0f0",
                    padding: "4px 10px",
                    borderRadius: 20,
                    fontSize: ".82rem",
                  }}
                >
                  {it.name || it.id} × {it.quantity || it.qty || 1}
                </span>
              ))}
            </div>
          </div>

          {/* Status pipeline */}
          {isCancelled ? (
            <div
              style={{
                padding: "18px 20px",
                borderRadius: 10,
                background: "#fff2f2",
                border: "1.5px solid #f5c0c0",
                fontWeight: 700,
                color: "#b94f59",
                fontSize: "1rem",
              }}
            >
              {currentStatus}
            </div>
          ) : (
            <div className="status-pipeline">
              {ALL_STATUSES.map((status, idx) => {
                const isDone = idx < currentIdx;
                const isCurrent = idx === currentIdx;
                const isFuture = idx > currentIdx;
                return (
                  <div
                    key={status}
                    className={
                      "pipeline-step" +
                      (isDone ? " done" : isCurrent ? " current" : " future")
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
          )}
        </div>
      )}
    </div>
  );
}
