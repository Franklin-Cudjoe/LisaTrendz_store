import React, { useState, useEffect } from "react";
import Lenis from "@studio-freight/lenis";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import Home from "./components/Home.jsx";
import ProductPage from "./components/ProductPage.jsx";
import Cart from "./components/Cart.jsx";
import Checkout from "./components/Checkout.jsx";
import OrderTracker from "./components/OrderTracker.jsx";
import Admin from "./components/Admin.jsx";
import AdminLogin from "./components/AdminLogin.jsx";
import defaultProducts from "./data/products.js";

export default function App() {
  const [view, setView] = useState("home");
  const [selected, setSelected] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutDelivery, setCheckoutDelivery] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderConfirm, setOrderConfirm] = useState(null); // { id, total }
  const [category, setCategory] = useState("All");
  const [productList, setProductList] = useState(() => {
    const raw = localStorage.getItem("products");
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
    return defaultProducts;
  });
  const [adminAuth, setAdminAuth] = useState(() => {
    try {
      return sessionStorage.getItem("adminAuth") === "true";
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    // expose admin via a secret hash/query or the /admin pathname
    try {
      if (typeof window !== "undefined") {
        const h = window.location.hash || "";
        const params = new URLSearchParams(window.location.search);
        const isSecretHash = h === "#/admin-secret" || h === "#/franklin-admin";
        const isSecretQuery =
          params.get("admin") === "1" || params.get("key") === "franklin";
        const isAdminPath =
          window.location.pathname === "/admin" ||
          window.location.pathname === "/admin/";

        if (isSecretHash || isSecretQuery || isAdminPath) {
          // if secret hash/query used, clear them to reduce discoverability
          if (isSecretHash || isSecretQuery) {
            if (window.history && window.history.replaceState) {
              try {
                const cleaned =
                  window.location.pathname +
                  window.location.search
                    .replace(/([?&])admin=[^&]*/g, "")
                    .replace(/([?&])key=[^&]*/g, "")
                    .replace(/[?&]$/g, "");
                window.history.replaceState(null, "", cleaned);
              } catch (e) {}
            }
          }
          setView("admin-login");
        }

        const onPop = () => {
          try {
            const path = window.location.pathname;
            if (path === "/admin" || path === "/admin/") setView("admin-login");
          } catch (e) {}
        };

        window.addEventListener("popstate", onPop);
        return () => window.removeEventListener("popstate", onPop);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    // respect user preference for reduced motion
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) return;

    // avoid multiple Lenis instances during HMR/dev reloads
    if (window.__lenis) {
      try {
        window.__lenis.destroy();
      } catch (e) {}
      window.__lenis = null;
    }

    const lenis = new Lenis({
      duration: 0.9,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smooth: true,
      direction: "vertical",
      gestureOrientation: "vertical",
      smoothTouch: true,
      wheelMultiplier: 1,
      touchMultiplier: 2,
    });

    window.__lenis = lenis;

    let rafId = null;
    const loop = (time) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      try {
        lenis.destroy();
      } catch (e) {}
      if (window.__lenis === lenis) window.__lenis = null;
    };
  }, []);

  // load products from API when available; fall back to localStorage/defaults
  useEffect(() => {
    let cancelled = false;
    async function load() {
      async function tryFetch(path, opts) {
        try {
          const r = await fetch(path, opts);
          if (!r.ok) throw new Error("no api");
          return r;
        } catch (e) {
          try {
            const alt = "http://localhost:4000" + path;
            const r2 = await fetch(alt, opts);
            if (!r2.ok) throw new Error("no api");
            return r2;
          } catch (e2) {
            throw e2;
          }
        }
      }

      try {
        const res = await tryFetch("/api/products");
        const data = await res.json();
        if (!cancelled && Array.isArray(data) && data.length > 0)
          setProductList(data);
      } catch (e) {
        // keep existing productList (localStorage/defaults)
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function openProduct(p) {
    setSelected(p);
    setView("product");
  }

  function addToCart(product, qty = 1) {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, qty: i.qty + qty } : i,
        );
      }
      return [...prev, { ...product, qty }];
    });
  }

  function removeFromCart(productId) {
    setCart((prev) => prev.filter((i) => i.id !== productId));
  }

  function goHome() {
    setView("home");
    setSelected(null);
  }

  function startCheckout(delivery) {
    // delivery: { type: 'pickup'|'ship', method: 'within'|'outside'|null, cost: number }
    setCheckoutDelivery(delivery || null);
    setCartOpen(false);
    setCheckoutOpen(true);
  }

  async function completePayment() {
    const id = "ORD-" + Math.random().toString(36).slice(2, 9).toUpperCase();

    const shipping = checkoutDelivery ? checkoutDelivery.cost || 0 : 0;
    const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
    const totalAmount = subtotal + shipping;
    const orderPayload = {
      id,
      items: cart.map((i) => ({ ...i, quantity: i.qty })),
      total: totalAmount,
      subtotal,
      shipping,
      currentStatus: "Placed",
      delivery: checkoutDelivery || { type: "pickup", cost: 0 },
      createdAt: Date.now(),
    };

    let finalId = id;
    let savedOrder = orderPayload;

    // Persist to server DB
    try {
      const postOrder = async (url) => {
        const r = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(orderPayload),
        });
        if (!r.ok) throw new Error("bad response");
        return r;
      };
      let res;
      try {
        res = await postOrder("/api/orders");
      } catch (e) {
        res = await postOrder("http://localhost:4000/api/orders");
      }
      const data = await res.json();
      finalId = data.id || id;
      savedOrder = data;
    } catch (e) {
      // server unavailable – order saved to localStorage only
    }

    // Always cache locally
    try {
      const raw = localStorage.getItem("orders");
      const all = raw ? JSON.parse(raw) : {};
      all[finalId] = { ...savedOrder, id: finalId };
      localStorage.setItem("orders", JSON.stringify(all));
    } catch (e) {}

    setCart([]);
    window.__lastOrderId = finalId;
    setCheckoutOpen(false);
    setOrderConfirm({ id: finalId, total: totalAmount });
  }

  return (
    <div className="app-root">
      <Header
        cartCount={cart.reduce((s, i) => s + i.qty, 0)}
        onCart={() => setCartOpen(true)}
        onHome={goHome}
        onAdmin={() => setView("admin-login")}
        onTrack={() => setView("tracker")}
      />

      <main className="container full-width">
        {view === "home" && (
          <Home
            products={
              category === "All"
                ? productList
                : productList.filter((p) => p.category === category)
            }
            onView={openProduct}
            onAdd={addToCart}
            category={category}
            onCategoryChange={(c) => setCategory(c)}
          />
        )}
        {view === "product" && selected && (
          <ProductPage product={selected} onAdd={addToCart} onBack={goHome} />
        )}
        {cartOpen && (
          <Cart
            drawer
            items={cart}
            onRemove={removeFromCart}
            onBack={() => setCartOpen(false)}
            onCheckout={(delivery) => startCheckout(delivery)}
            onClose={() => setCartOpen(false)}
          />
        )}
        {view === "checkout" && (
          <Checkout
            items={cart}
            delivery={checkoutDelivery}
            onBack={() => {
              setView("home");
              setCartOpen(true);
            }}
            onPay={completePayment}
          />
        )}

        {checkoutOpen && (
          <div
            className="checkout-modal-overlay"
            onClick={() => setCheckoutOpen(false)}
          >
            <div
              className="checkout-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <Checkout
                items={cart}
                delivery={checkoutDelivery}
                onBack={() => {
                  setCheckoutOpen(false);
                  setCartOpen(true);
                }}
                onPay={async () => {
                  await completePayment();
                }}
              />
            </div>
          </div>
        )}
        {orderConfirm && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              zIndex: 200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
          >
            <div
              style={{
                background: "#fff",
                borderRadius: 16,
                padding: "36px 32px",
                maxWidth: 460,
                width: "100%",
                textAlign: "center",
                boxShadow: "0 30px 80px rgba(10,10,30,0.25)",
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 8 }}>🎉</div>
              <h2 style={{ margin: "0 0 6px" }}>Order Placed!</h2>
              <p style={{ color: "var(--muted)", margin: "0 0 20px" }}>
                Your payment of{" "}
                <strong>${orderConfirm.total.toFixed(2)}</strong> was
                successful. Save your order code to track your delivery.
              </p>
              <div
                style={{
                  background: "#f5f7ff",
                  border: "1.5px dashed var(--primary)",
                  borderRadius: 10,
                  padding: "14px 18px",
                  marginBottom: 20,
                }}
              >
                <div
                  style={{
                    fontSize: ".8rem",
                    color: "var(--muted)",
                    marginBottom: 4,
                  }}
                >
                  Order Code
                </div>
                <div
                  style={{
                    fontSize: "1.15rem",
                    fontWeight: 700,
                    letterSpacing: "0.06em",
                    fontFamily: "monospace",
                    color: "var(--primary)",
                  }}
                >
                  {orderConfirm.id}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <button
                  className="btn secondary"
                  onClick={() => {
                    try {
                      navigator.clipboard.writeText(orderConfirm.id);
                    } catch (e) {}
                  }}
                >
                  Copy Code
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setOrderConfirm(null);
                    setView("tracker");
                  }}
                >
                  Track My Order
                </button>
              </div>
            </div>
          </div>
        )}
        {view === "tracker" && <OrderTracker orderId={window.__lastOrderId} />}
        {view === "admin-login" && (
          <AdminLogin
            onSuccess={() => {
              setAdminAuth(true);
              setView("admin-dashboard");
            }}
            onCancel={() => setView("home")}
          />
        )}
        {view === "admin-dashboard" && (
          <Admin
            onChange={(list) => setProductList(list)}
            onLogout={() => {
              setAdminAuth(false);
              try {
                sessionStorage.removeItem("adminAuth");
              } catch (e) {}
              setView("home");
            }}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
