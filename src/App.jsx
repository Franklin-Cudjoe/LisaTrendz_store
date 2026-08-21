import React, { useState, useEffect, useMemo } from "react";
import Header from "./components/Header.jsx";
import Footer from "./components/Footer.jsx";
import Home from "./components/Home.jsx";
import ProductPage from "./components/ProductPage.jsx";
import SavedProducts from "./components/SavedProducts.jsx";
import Cart from "./components/Cart.jsx";
import Checkout from "./components/Checkout.jsx";
import OrderTracker from "./components/OrderTracker.jsx";
import Admin from "./components/Admin.jsx";
import AdminLogin from "./components/AdminLogin.jsx";
import defaultProducts from "./data/products.js";
import { CATEGORY_ALL, DEFAULT_CATEGORIES } from "./data/categories.js";
import { getProductImages, normalizeProductImages } from "./utils/productImages.js";
import { normalizeProductColors } from "./utils/productColors.js";
import { normalizeProductSizes } from "./utils/productSizing.js";
import { getProductStock, normalizeProductStock } from "./utils/productStock.js";
import { calculateOrderTotals, formatMoney } from "./utils/promotions.js";
import {
  fetchProducts,
  initializePaystackPayment,
  verifyPaystackPayment,
} from "./services/storeApi.js";

const SAVED_PRODUCTS_KEY = "savedProductIds";
const PRODUCT_REVIEWS_KEY = "productReviews";
const RECENTLY_VIEWED_KEY = "recentlyViewedProductIds";

function normalizeProduct(product) {
  return normalizeProductStock(
    normalizeProductSizes(normalizeProductColors(normalizeProductImages(product))),
  );
}

function getCartItemKey(product) {
  const color = product?.selectedColor;
  const colorKey = color ? `${color.name || ""}|${color.value || ""}` : "";
  const sizeKey = product?.selectedSize || "";

  return `${product.id}::${colorKey}::${sizeKey}`;
}

function readStoredProducts() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return null;

    const raw = window.localStorage.getItem("products");
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map(normalizeProduct);
    }
  } catch (e) {}

  return null;
}

function readStoredIdList(key) {
  try {
    if (typeof window === "undefined" || !window.localStorage) return [];

    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed)
      ? parsed.filter((id) => typeof id === "string" && id.trim())
      : [];
  } catch (e) {
    return [];
  }
}

function readStoredReviewStore() {
  try {
    if (typeof window === "undefined" || !window.localStorage) return {};

    const raw = window.localStorage.getItem(PRODUCT_REVIEWS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed).map(([productId, reviews]) => [
        productId,
        Array.isArray(reviews) ? reviews : [],
      ]),
    );
  } catch (e) {
    return {};
  }
}

function cleanCategoryName(name) {
  return typeof name === "string" ? name.trim() : "";
}

function categoryKey(name) {
  return cleanCategoryName(name).toLowerCase();
}

function uniqueCategories(names) {
  const seen = new Set();

  return names.reduce((list, name) => {
    const clean = cleanCategoryName(name);
    const key = categoryKey(clean);

    if (!clean || seen.has(key)) return list;

    seen.add(key);
    return [...list, clean];
  }, []);
}

function isVisibleProduct(product) {
  return product && product.active !== false;
}

function buildOrderItem(item) {
  const quantity = Number(item.qty || item.quantity || 1);
  const unitPrice = Number(item.price || 0);
  const images = getProductImages(item);

  return {
    id: item.id,
    productId: item.id,
    name: item.name || "Item",
    category: item.category || "Collection",
    description: item.description || "",
    image: images.front || item.image || "",
    selectedColor: item.selectedColor || null,
    selectedSize: item.selectedSize || "",
    quantity,
    qty: quantity,
    unitPrice,
    price: unitPrice,
    lineTotal: unitPrice * quantity,
  };
}

export default function App() {
  const [view, setView] = useState("home");
  const [trackerReturnView, setTrackerReturnView] = useState("home");
  const [selected, setSelected] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutDelivery, setCheckoutDelivery] = useState(null);
  const [promotion, setPromotion] = useState(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderConfirm, setOrderConfirm] = useState(null); // { id, total }
  const [paymentNotice, setPaymentNotice] = useState(null);
  const [lastOrderId, setLastOrderId] = useState(null);
  const [category, setCategory] = useState(CATEGORY_ALL);
  const [productList, setProductList] = useState(
    () => readStoredProducts() || defaultProducts.map(normalizeProduct),
  );
  const [savedProductIds, setSavedProductIds] = useState(() =>
    readStoredIdList(SAVED_PRODUCTS_KEY),
  );
  const [recentlyViewedIds, setRecentlyViewedIds] = useState(() =>
    readStoredIdList(RECENTLY_VIEWED_KEY),
  );
  const [productReviews, setProductReviews] = useState(readStoredReviewStore);
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
    if (typeof window === "undefined") return;

    let cancelled = false;

    async function verifyPaystackReturn() {
      const url = new URL(window.location.href);
      const reference =
        url.searchParams.get("reference") ||
        url.searchParams.get("trxref") ||
        url.searchParams.get("paystack_reference") ||
        "";
      const isPaystackReturn =
        url.searchParams.get("payment") === "paystack" || reference;

      if (!isPaystackReturn) return;

      const storedReference = (() => {
        try {
          return localStorage.getItem("pendingPaystackReference") || "";
        } catch (e) {
          return "";
        }
      })();
      const paymentReference = reference || storedReference;

      try {
        url.searchParams.delete("payment");
        url.searchParams.delete("reference");
        url.searchParams.delete("trxref");
        url.searchParams.delete("paystack_reference");
        window.history.replaceState(
          null,
          "",
          `${url.pathname}${url.search}${url.hash}`,
        );
      } catch (e) {}

      if (!paymentReference) {
        if (!cancelled) {
          setPaymentNotice({
            title: "Payment needs checking",
            message: "Paystack did not return a payment reference.",
          });
        }
        return;
      }

      try {
        const result = await verifyPaystackPayment(paymentReference);
        const order = result.order;
        const orderId = order?.id || order?.orderCode || paymentReference;

        if (cancelled) return;

        if (orderId) {
          setLastOrderId(orderId);
          try {
            window.__lastOrderId = orderId;
            localStorage.removeItem("pendingPaystackReference");
          } catch (e) {}
        }

        if (result.paid && result.status === "success" && order) {
          setCart([]);
          setPromotion(null);
          setCheckoutOpen(false);
          setOrderConfirm({
            id: orderId,
            total: Number(order.total || order.amountPaid || 0),
          });
          return;
        }

        setPaymentNotice({
          title:
            result.status === "paid_stock_review"
              ? "Payment received"
              : result.status === "failed"
                ? "Payment not completed"
                : "Payment is pending",
          message:
            result.status === "paid_stock_review"
              ? "We received your payment, but this order needs a quick stock check before fulfilment."
              : result.status === "failed"
                ? "Paystack could not complete this payment. You can try checkout again."
                : "Your payment has not been confirmed yet. Mobile money payments can sometimes take a short moment to settle.",
          orderId,
        });
      } catch (e) {
        if (!cancelled) {
          setPaymentNotice({
            title: "Payment could not be verified",
            message:
              e.message ||
              "Please use your Paystack reference or order code to check again.",
          });
        }
      }
    }

    verifyPaystackReturn();

    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const productCategories = productList
      .filter(isVisibleProduct)
      .map((product) => product.category);

    return uniqueCategories([...DEFAULT_CATEGORIES, ...productCategories]);
  }, [productList]);

  const visibleProducts = useMemo(() => {
    const publicProducts = productList.filter(isVisibleProduct);

    if (category === CATEGORY_ALL) return publicProducts;

    const selectedCategoryKey = categoryKey(category);
    return publicProducts.filter(
      (product) => categoryKey(product.category) === selectedCategoryKey,
    );
  }, [category, productList]);

  const savedProducts = useMemo(() => {
    const savedIds = new Set(savedProductIds);

    return productList
      .filter(isVisibleProduct)
      .filter((product) => savedIds.has(product.id));
  }, [productList, savedProductIds]);

  const recentlyViewedProducts = useMemo(() => {
    const productsById = new Map(
      productList.filter(isVisibleProduct).map((product) => [product.id, product]),
    );

    return recentlyViewedIds
      .map((id) => productsById.get(id))
      .filter(Boolean);
  }, [productList, recentlyViewedIds]);

  useEffect(() => {
    try {
      localStorage.setItem(SAVED_PRODUCTS_KEY, JSON.stringify(savedProductIds));
    } catch (e) {}
  }, [savedProductIds]);

  useEffect(() => {
    try {
      localStorage.setItem(PRODUCT_REVIEWS_KEY, JSON.stringify(productReviews));
    } catch (e) {}
  }, [productReviews]);

  useEffect(() => {
    try {
      localStorage.setItem(
        RECENTLY_VIEWED_KEY,
        JSON.stringify(recentlyViewedIds),
      );
    } catch (e) {}
  }, [recentlyViewedIds]);

  useEffect(() => {
    const productIds = new Set(productList.map((product) => product.id));

    setSavedProductIds((current) => {
      const next = current.filter((id) => productIds.has(id));

      return next.length === current.length ? current : next;
    });

    setRecentlyViewedIds((current) => {
      const next = current.filter((id) => productIds.has(id)).slice(0, 8);

      return next.length === current.length ? current : next;
    });
  }, [productList]);

  useEffect(() => {
    if (
      category !== CATEGORY_ALL &&
      !categories.some((name) => categoryKey(name) === categoryKey(category))
    ) {
      setCategory(CATEGORY_ALL);
    }
  }, [categories, category]);

  // Load the public catalog from the store API; default products stay as a fallback.
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const data = await fetchProducts();

        if (!cancelled && Array.isArray(data)) {
          setProductList(data.map(normalizeProduct));
        }
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
    setRecentlyViewedIds((current) => [
      p.id,
      ...current.filter((id) => id !== p.id),
    ].slice(0, 8));

    try {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {}
  }

  function openWishlist() {
    setSelected(null);
    setView("wishlist");
  }

  function toggleSavedProduct(productId) {
    setSavedProductIds((current) =>
      current.includes(productId)
        ? current.filter((id) => id !== productId)
        : [...current, productId],
    );
  }

  function addProductReview(productId, review) {
    const text = String(review?.text || "").trim().slice(0, 420);

    if (!productId || !text) return;

    const rating = Math.min(
      5,
      Math.max(1, Math.round(Number(review?.rating) || 5)),
    );
    const name = String(review?.name || "Customer").trim().slice(0, 48);
    const cleanReview = {
      id: `REV-${Date.now().toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 7)}`,
      name: name || "Customer",
      rating,
      text,
      createdAt: Date.now(),
    };

    setProductReviews((current) => ({
      ...current,
      [productId]: [cleanReview, ...(current[productId] || [])],
    }));
  }

  function openTracker() {
    if (view !== "tracker") {
      setTrackerReturnView(view);
    }
    setView("tracker");
  }

  function closeTracker() {
    setView(trackerReturnView || "home");
  }

  function addToCart(product, qty = 1) {
    setCart((prev) => {
      const cartKey = getCartItemKey(product);
      const existing = prev.find((i) => (i.cartKey || i.id) === cartKey);
      const stock = getProductStock(product);
      const nextQty = (existing?.qty || 0) + qty;

      if (stock != null && nextQty > stock) {
        return prev;
      }

      if (existing) {
        return prev.map((i) =>
          (i.cartKey || i.id) === cartKey ? { ...i, qty: i.qty + qty } : i,
        );
      }
      return [...prev, { ...product, cartKey, qty }];
    });
  }

  function removeFromCart(cartKey) {
    setCart((prev) => prev.filter((i) => (i.cartKey || i.id) !== cartKey));
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

  async function completePayment(customer = {}) {
    const id = "ORD-" + Math.random().toString(36).slice(2, 9).toUpperCase();

    const totals = calculateOrderTotals(cart, checkoutDelivery, promotion);
    const shipping = totals.shipping;
    const subtotal = totals.subtotal;
    const totalAmount = totals.total;
    const orderItems = cart.map(buildOrderItem);
    const orderPayload = {
      id,
      orderCode: id,
      items: orderItems,
      total: totalAmount,
      subtotal,
      shipping,
      discount: totals.discount,
      promotion: totals.promo,
      currency: "GHS",
      amountPaid: 0,
      itemCount: orderItems.reduce((total, item) => total + item.quantity, 0),
      itemSummary: orderItems
        .map((item) => `${item.name} x ${item.quantity}`)
        .join(", "),
      currentStatus: "Payment Pending",
      delivery: checkoutDelivery || { type: "pickup", cost: 0 },
      customer,
      email: customer.email || "",
      phone: customer.phone || "",
      payment: {
        provider: "paystack",
        reference: id,
        status: "initialized",
        channels: ["card", "mobile_money"],
      },
      createdAt: Date.now(),
    };

    const payment = await initializePaystackPayment(orderPayload, customer);

    if (!payment?.authorizationUrl) {
      throw new Error("Paystack did not return a checkout link.");
    }

    try {
      localStorage.setItem("pendingPaystackReference", payment.reference || id);
    } catch (e) {}

    window.location.assign(payment.authorizationUrl);

  }

  return (
    <div className="app-root">
      <Header
        cartCount={cart.reduce((s, i) => s + i.qty, 0)}
        savedCount={savedProducts.length}
        onCart={() => setCartOpen(true)}
        onHome={goHome}
        onSaved={openWishlist}
        onAdmin={() => setView("admin-login")}
        onTrack={openTracker}
      />

      <main className="container full-width">
        {view === "home" && (
          <Home
            products={visibleProducts}
            onView={openProduct}
            onAdd={addToCart}
            category={category}
            onCategoryChange={(c) => setCategory(c)}
            categories={categories}
            savedProductIds={savedProductIds}
            onToggleSave={toggleSavedProduct}
            recentlyViewedProducts={recentlyViewedProducts}
          />
        )}
        {view === "product" && selected && (
          <ProductPage
            product={selected}
            allProducts={productList.filter(isVisibleProduct)}
            onAdd={addToCart}
            onBack={goHome}
            onViewProduct={openProduct}
            isSaved={savedProductIds.includes(selected.id)}
            onToggleSave={() => toggleSavedProduct(selected.id)}
            reviews={productReviews[selected.id] || []}
            onAddReview={(review) => addProductReview(selected.id, review)}
            savedProductIds={savedProductIds}
            onToggleProductSave={toggleSavedProduct}
            recentlyViewedProducts={recentlyViewedProducts.filter(
              (product) => product.id !== selected.id,
            )}
          />
        )}
        {view === "wishlist" && (
          <SavedProducts
            products={savedProducts}
            onView={openProduct}
            onAdd={addToCart}
            onBack={goHome}
            savedProductIds={savedProductIds}
            onToggleSave={toggleSavedProduct}
          />
        )}
        {cartOpen && (
          <Cart
            drawer
            items={cart}
            onRemove={removeFromCart}
            onBack={() => setCartOpen(false)}
            onCheckout={(delivery) => startCheckout(delivery)}
            onClose={() => setCartOpen(false)}
            promotion={promotion}
            onPromotionChange={setPromotion}
          />
        )}
        {view === "checkout" && (
          <Checkout
            items={cart}
            delivery={checkoutDelivery}
            promotion={promotion}
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
                promotion={promotion}
                onBack={() => {
                  setCheckoutOpen(false);
                  setCartOpen(true);
                }}
                onPay={async (customer) => {
                  await completePayment(customer);
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
              <div style={{ fontSize: 40, marginBottom: 8, fontWeight: 900 }}>OK</div>
              <h2 style={{ margin: "0 0 6px" }}>Order Placed!</h2>
              <p style={{ color: "var(--muted)", margin: "0 0 20px" }}>
                Your payment of{" "}
                <strong>{formatMoney(orderConfirm.total)}</strong> was
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
                    openTracker();
                  }}
                >
                  Track My Order
                </button>
              </div>
            </div>
          </div>
        )}
        {paymentNotice && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.55)",
              zIndex: 205,
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
                padding: "30px 28px",
                maxWidth: 480,
                width: "100%",
                textAlign: "center",
                boxShadow: "0 30px 80px rgba(10,10,30,0.25)",
              }}
            >
              <h2 style={{ margin: "0 0 8px" }}>{paymentNotice.title}</h2>
              <p style={{ color: "var(--muted)", margin: "0 0 20px" }}>
                {paymentNotice.message}
              </p>
              {paymentNotice.orderId && (
                <div
                  style={{
                    background: "#f5f7ff",
                    border: "1.5px dashed var(--primary)",
                    borderRadius: 10,
                    padding: "12px 16px",
                    marginBottom: 18,
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
                  <strong style={{ fontFamily: "monospace" }}>
                    {paymentNotice.orderId}
                  </strong>
                </div>
              )}
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
                  onClick={() => setPaymentNotice(null)}
                >
                  Close
                </button>
                {paymentNotice.orderId && (
                  <button
                    className="btn"
                    onClick={() => {
                      setPaymentNotice(null);
                      openTracker();
                    }}
                  >
                    Track Order
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
        {view === "tracker" && (
          <OrderTracker orderId={lastOrderId} onBack={closeTracker} />
        )}
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
