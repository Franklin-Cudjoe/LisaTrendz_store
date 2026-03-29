import React, { useEffect, useState } from "react";
import "../styles/admin.css";
import defaultProducts from "../data/products.js";
import AdminLogin from "./AdminLogin.jsx";

export default function Admin({ onChange, onLogout }) {
  const [adminAuth, setAdminAuth] = useState(() => {
    try {
      return sessionStorage.getItem("adminAuth") === "true";
    } catch (e) {
      return false;
    }
  });
  const [items, setItems] = useState([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [editing, setEditing] = useState(null);
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({
    name: "",
    price: 0,
    category: "Tops",
    image: "",
    description: "",
  });
  const [activeMenu, setActiveMenu] = useState("products");
  const [ordersList, setOrdersList] = useState([]);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("");
  const [orderSort, setOrderSort] = useState("newest");

  const STATUS_OPTIONS = [
    "Placed",
    "Confirmed",
    "Packed",
    "Shipped",
    "Out For Delivery",
    "Delivered",
    "Cancelled",
    "Returned",
    "Delivery Failed",
  ];

  async function tryFetch(path, opts) {
    let token;
    try {
      token = sessionStorage.getItem("adminAuthToken");
    } catch (e) {}
    const authHeaders = token ? { Authorization: `Basic ${token}` } : {};
    const mergedOpts = opts
      ? { ...opts, headers: { ...authHeaders, ...(opts.headers || {}) } }
      : { headers: authHeaders };
    try {
      const r = await fetch(path, mergedOpts);
      if (!r.ok) throw new Error("no api");
      return r;
    } catch (e) {
      try {
        const r2 = await fetch("http://localhost:4000" + path, mergedOpts);
        if (!r2.ok) throw new Error("no api");
        return r2;
      } catch (e2) {
        return null;
      }
    }
  }

  useEffect(() => {
    async function loadProducts() {
      try {
        const res = await tryFetch("/api/products");
        if (res) {
          setItems(await res.json());
          setItemsLoaded(true);
          return;
        }
      } catch (e) {}
      const raw = localStorage.getItem("products");
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setItems(parsed);
            setItemsLoaded(true);
            return;
          }
        } catch (e) {}
      }
      setItems(defaultProducts);
      setItemsLoaded(true);
    }
    loadProducts();
  }, []);

  useEffect(() => {
    if (!itemsLoaded) return;
    localStorage.setItem("products", JSON.stringify(items));
    if (onChange) onChange(items);
  }, [items, itemsLoaded]);

  useEffect(() => {
    async function loadOrders() {
      try {
        const res = await tryFetch("/api/orders");
        if (res) {
          setOrdersList(await res.json());
          return;
        }
      } catch (e) {}
      setOrdersList([]);
    }
    loadOrders();
  }, []);

  const displayedOrders = ordersList
    .filter((o) => {
      if (orderQuery) {
        const q = orderQuery.toLowerCase();
        if (
          !(
            (o.id || "").toLowerCase().includes(q) ||
            (o.userId || "").toLowerCase().includes(q)
          )
        )
          return false;
      }
      if (orderStatusFilter && (o.currentStatus || "") !== orderStatusFilter)
        return false;
      return true;
    })
    .slice()
    .sort((a, b) => {
      const ta = a.createdAt || a.created || 0;
      const tb = b.createdAt || b.created || 0;
      return orderSort === "newest" ? tb - ta : ta - tb;
    });

  function startAdd() {
    setEditing(null);
    setForm({
      name: "",
      price: 0,
      category: "Tops",
      image: "",
      description: "",
    });
    setActiveMenu("add");
  }

  function saveNew() {
    const id = "P-" + Math.random().toString(36).slice(2, 9).toUpperCase();
    setItems((s) => [{ ...form, id, price: Number(form.price) }, ...s]);
    setForm({
      name: "",
      price: 0,
      category: "Tops",
      image: "",
      description: "",
    });
    setActiveMenu("products");
  }

  function startEdit(item) {
    setEditing(item.id);
    setForm({
      name: item.name,
      price: item.price,
      category: item.category,
      image: item.image,
      description: item.description,
    });
  }

  function saveEdit(id) {
    setItems((s) =>
      s.map((it) =>
        it.id === id ? { ...it, ...form, price: Number(form.price) } : it,
      ),
    );
    setEditing(null);
  }

  function remove(id) {
    if (!confirm("Remove product?")) return;
    setItems((s) => s.filter((it) => it.id !== id));
  }

  function changeOrderStatus(orderId, newStatus) {
    setOrdersList((s) =>
      s.map((it) =>
        it.id === orderId ? { ...it, currentStatus: newStatus } : it,
      ),
    );
    (async () => {
      try {
        await tryFetch(`/api/orders/${orderId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus, actor: "admin" }),
        });
      } catch (e) {}
    })();
  }

  if (!adminAuth) {
    return (
      <div className="admin container">
        <AdminLogin
          onSuccess={() => setAdminAuth(true)}
          onCancel={() => {
            if (onLogout) onLogout();
            else {
              try {
                sessionStorage.removeItem("adminAuth");
              } catch (e) {}
              window.location.href = "/";
            }
          }}
        />
      </div>
    );
  }

  return (
    <div className="admin container">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <h2>Admin Dashboard</h2>
        <button
          className="btn"
          onClick={() => {
            if (onLogout) onLogout();
            else {
              sessionStorage.removeItem("adminAuth");
              window.location.reload();
            }
          }}
        >
          Logout
        </button>
      </div>

      <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
        <aside
          style={{
            width: 220,
            borderRight: "1px solid #eee",
            paddingRight: 12,
          }}
        >
          <h4 style={{ marginTop: 0 }}>Menu</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <button
              className={"btn" + (activeMenu === "products" ? " active" : "")}
              onClick={() => setActiveMenu("products")}
            >
              Manage Products
            </button>
            <button
              className={"btn" + (activeMenu === "orders" ? " active" : "")}
              onClick={() => setActiveMenu("orders")}
            >
              Manage Orders
            </button>
            <button className="btn" onClick={() => startAdd()}>
              Add New Product
            </button>
            <button className="btn" onClick={() => setActiveMenu("settings")}>
              Settings
            </button>
          </div>
        </aside>

        <main style={{ flex: 1 }}>
          {(activeMenu === "products" ||
            activeMenu === "add" ||
            activeMenu === "settings") && (
            <>
              <div className="admin-top" style={{ marginBottom: 12 }}>
                <div className="stats">
                  <div className="stat">
                    <div className="stat-value">{items.length}</div>
                    <div className="stat-label">Products</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">{ordersList.length}</div>
                    <div className="stat-label">Orders</div>
                  </div>
                  <div className="stat">
                    <div className="stat-value">
                      $
                      {ordersList
                        .reduce((s, o) => s + (o.total || 0), 0)
                        .toFixed(2)}
                    </div>
                    <div className="stat-label">Total Sales</div>
                  </div>
                </div>
                <div className="admin-actions">
                  <input
                    className="admin-search"
                    placeholder="Search products..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 8, display: "flex", gap: 8 }}>
                <button className="btn" onClick={() => startAdd()}>
                  Add new product
                </button>
                <button
                  className="btn"
                  onClick={async () => {
                    try {
                      const res = await tryFetch("/api/products");
                      if (res) setItems(await res.json());
                    } catch (e) {}
                  }}
                >
                  Refresh
                </button>
                <button
                  className="btn secondary"
                  onClick={() => setItems(defaultProducts)}
                >
                  Reset defaults
                </button>
              </div>

              <div className="admin-form" style={{ marginBottom: 18 }}>
                <label>Name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <label>Price</label>
                <input
                  type="number"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                />
                <label>Category</label>
                <input
                  value={form.category}
                  onChange={(e) =>
                    setForm({ ...form, category: e.target.value })
                  }
                />
                <label>Image URL</label>
                <input
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                />
                <label>Description</label>
                <input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
                <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                  {editing ? (
                    <>
                      <button className="btn" onClick={() => saveEdit(editing)}>
                        Save
                      </button>
                      <button className="btn" onClick={() => setEditing(null)}>
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button className="btn" onClick={() => saveNew()}>
                      Create
                    </button>
                  )}
                </div>
              </div>

              <div className="admin-list">
                {items
                  .filter(
                    (it) =>
                      !query ||
                      (it.name || "")
                        .toLowerCase()
                        .includes(query.toLowerCase()) ||
                      (it.category || "")
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                  )
                  .map((it) => (
                    <div
                      key={it.id}
                      className="card"
                      style={{
                        padding: 12,
                        marginBottom: 12,
                        display: "flex",
                        gap: 12,
                        alignItems: "center",
                      }}
                    >
                      <img
                        src={it.image}
                        alt={it.name}
                        style={{
                          width: 84,
                          height: 84,
                          objectFit: "cover",
                          borderRadius: 8,
                        }}
                      />
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <strong>{it.name}</strong>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              className="btn"
                              onClick={() => startEdit(it)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn secondary"
                              onClick={() => remove(it.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                        <div style={{ color: "var(--muted)" }}>
                          {it.category} &bull; ${it.price}
                        </div>
                        <div style={{ fontSize: ".9rem", marginTop: 4 }}>
                          {it.description}
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </>
          )}

          {activeMenu === "orders" && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 12,
                }}
              >
                <h3 style={{ margin: 0 }}>Orders</h3>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: ".9rem", color: "var(--muted)" }}>
                    {ordersList.length} total
                  </span>
                  <button
                    className="btn"
                    onClick={async () => {
                      try {
                        const res = await tryFetch("/api/orders");
                        if (res) setOrdersList(await res.json());
                      } catch (e) {}
                    }}
                  >
                    ↻ Refresh
                  </button>
                </div>
              </div>
              <div style={{ marginBottom: 12, display: "flex", gap: 8 }}>
                <input
                  placeholder="Search by order ID or user..."
                  value={orderQuery}
                  onChange={(e) => setOrderQuery(e.target.value)}
                  style={{ flex: 1, padding: 8 }}
                />
                <select
                  value={orderStatusFilter}
                  onChange={(e) => setOrderStatusFilter(e.target.value)}
                >
                  <option value="">All statuses</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <select
                  value={orderSort}
                  onChange={(e) => setOrderSort(e.target.value)}
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                </select>
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                {displayedOrders.length === 0 && (
                  <div className="card" style={{ padding: 12 }}>
                    No orders found.
                  </div>
                )}
                {displayedOrders.map((o) => (
                  <div key={o.id} className="card" style={{ padding: 12 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: "1rem" }}>
                          Order #{o.id}
                        </div>
                        <div
                          style={{ color: "var(--muted)", fontSize: ".85rem" }}
                        >
                          {new Date(
                            o.createdAt || o.created || Date.now(),
                          ).toLocaleString()}
                        </div>
                        <div
                          style={{ color: "var(--muted)", fontSize: ".85rem" }}
                        >
                          Customer: {o.userId || o.email || "-"}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontWeight: 700 }}>
                          ${(o.total || o.subtotal || 0).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <strong style={{ fontSize: ".9rem" }}>
                        Items ordered:
                      </strong>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          flexWrap: "wrap",
                          marginTop: 4,
                        }}
                      >
                        {(o.items || []).map((it, idx) => (
                          <span
                            key={idx}
                            style={{
                              background: "#f0f0f0",
                              padding: "4px 8px",
                              borderRadius: 4,
                              fontSize: ".85rem",
                            }}
                          >
                            {it.name || it.title || it.id || "item"} &times;{" "}
                            {it.quantity || 1}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: 12,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{ fontWeight: 600, color: "var(--primary)" }}
                      >
                        {o.currentStatus || "Placed"}
                      </span>
                      <select
                        value={o.currentStatus || "Placed"}
                        onChange={(e) =>
                          changeOrderStatus(o.id, e.target.value)
                        }
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
