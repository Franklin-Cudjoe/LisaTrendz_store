import React, { useEffect, useMemo, useState } from "react";
import "../styles/admin.css";
import { PRODUCT_CATEGORIES } from "../data/categories.js";
import defaultProducts from "../data/products.js";
import {
  createProduct,
  deleteProduct,
  fetchOrders,
  fetchProducts,
  updateOrderStatus,
  updateProduct,
  uploadProductImage,
} from "../services/storeApi.js";
import {
  getProductImages,
  normalizeProductImages,
} from "../utils/productImages.js";

const EMPTY_PRODUCT_FORM = {
  name: "",
  price: "",
  category: "Dresses",
  image: "",
  imageFront: "",
  imageBack: "",
  description: "",
  active: true,
};

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

function formatMoney(value) {
  return `GHS ${Number(value || 0).toFixed(2)}`;
}

function makeProductId() {
  return "P-" + Math.random().toString(36).slice(2, 9).toUpperCase();
}

function cleanText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function getCategoryOptions(items, currentCategory) {
  const seen = new Set();

  return [
    ...PRODUCT_CATEGORIES,
    currentCategory,
    ...items.map((item) => item.category),
  ]
    .filter((category) => typeof category === "string" && category.trim())
    .reduce((options, category) => {
      const clean = category.trim();
      const key = clean.toLowerCase();

      if (seen.has(key)) return options;

      seen.add(key);
      return [...options, clean];
    }, []);
}

function productFromForm(form, id) {
  const imageFront = form.imageFront || form.image || "";
  const imageBack = form.imageBack || "";

  return normalizeProductImages({
    id,
    name: cleanText(form.name),
    price: Number(form.price),
    category: cleanText(form.category) || "Dresses",
    image: imageFront,
    imageFront,
    imageBack,
    description: cleanText(form.description),
    active: form.active !== false,
  });
}

function formFromProduct(product) {
  const images = getProductImages(product);

  return {
    name: product.name || "",
    price: product.price ?? "",
    category: product.category || "Dresses",
    image: images.front,
    imageFront: images.front,
    imageBack: images.back,
    description: product.description || "",
    active: product.active !== false,
  };
}

function PhotoPicker({ id, label, image, uploading, onFile, onClear }) {
  return (
    <div className="owner-photo-field">
      <div className="owner-photo-preview">
        {image ? (
          <img src={image} alt={`${label} preview`} />
        ) : (
          <span>{label}</span>
        )}
      </div>
      <div className="owner-photo-actions">
        <label className="owner-photo-button" htmlFor={id}>
          {uploading ? "Uploading..." : image ? "Replace photo" : "Upload photo"}
        </label>
        <input
          id={id}
          type="file"
          accept="image/*"
          onChange={(event) => onFile(event.target.files?.[0] || null)}
        />
        {image && (
          <button className="owner-link-button" type="button" onClick={onClear}>
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

export default function Admin({ onChange, onLogout }) {
  const [items, setItems] = useState([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("add");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_PRODUCT_FORM);
  const [query, setQuery] = useState("");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyProductId, setBusyProductId] = useState("");
  const [uploadingImages, setUploadingImages] = useState({});
  const [storageState, setStorageState] = useState("loading");
  const [ordersList, setOrdersList] = useState([]);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("");

  useEffect(() => {
    async function loadProducts() {
      try {
        const products = await fetchProducts({ includeHidden: true });
        setItems(products.map(normalizeProductImages));
        setStorageState("ready");
      } catch (e) {
        setStorageState("offline");

        try {
          const raw = localStorage.getItem("products");
          const parsed = raw ? JSON.parse(raw) : null;

          if (Array.isArray(parsed)) {
            setItems(parsed.map(normalizeProductImages));
          } else {
            setItems(defaultProducts.map(normalizeProductImages));
          }
        } catch (error) {
          setItems(defaultProducts.map(normalizeProductImages));
        }
      } finally {
        setItemsLoaded(true);
      }
    }

    loadProducts();
  }, []);

  useEffect(() => {
    if (!itemsLoaded) return;

    try {
      localStorage.setItem("products", JSON.stringify(items));
    } catch (e) {}

    if (onChange) onChange(items.map(normalizeProductImages));
  }, [items, itemsLoaded]);

  useEffect(() => {
    refreshOrders();
  }, []);

  const categoryOptions = useMemo(
    () => getCategoryOptions(items, form.category),
    [items, form.category],
  );

  const visibleCount = items.filter((item) => item.active !== false).length;
  const hiddenCount = items.length - visibleCount;
  const recentOrders = ordersList.filter(
    (order) => (order.currentStatus || "Placed") !== "Delivered",
  ).length;

  const filteredItems = useMemo(() => {
    const search = query.trim().toLowerCase();

    return items.filter((item) => {
      if (visibilityFilter === "visible" && item.active === false) return false;
      if (visibilityFilter === "hidden" && item.active !== false) return false;

      if (!search) return true;

      return [item.name, item.category, item.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search));
    });
  }, [items, query, visibilityFilter]);

  const displayedOrders = useMemo(() => {
    const search = orderQuery.trim().toLowerCase();

    return ordersList
      .filter((order) => {
        if (
          search &&
          ![order.id, order.userId, order.email]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(search))
        ) {
          return false;
        }

        if (
          orderStatusFilter &&
          (order.currentStatus || "Placed") !== orderStatusFilter
        ) {
          return false;
        }

        return true;
      })
      .slice()
      .sort(
        (a, b) =>
          (b.createdAt || b.created || 0) - (a.createdAt || a.created || 0),
      );
  }, [ordersList, orderQuery, orderStatusFilter]);

  async function refreshProducts() {
    try {
      const products = await fetchProducts({ includeHidden: true });
      setItems(products.map(normalizeProductImages));
      setStorageState("ready");
      setNotice("Catalog refreshed.");
    } catch (e) {
      setStorageState("offline");
      setNotice("Catalog storage is offline. Saved changes need the store server.");
    }
  }

  async function refreshOrders() {
    try {
      setOrdersList(await fetchOrders());
    } catch (e) {
      setOrdersList([]);
    }
  }

  function resetForm() {
    setEditingId(null);
    setForm(EMPTY_PRODUCT_FORM);
  }

  function startAdd() {
    resetForm();
    setNotice("");
    setActiveTab("add");
  }

  function startEdit(product) {
    setEditingId(product.id);
    setForm(formFromProduct(product));
    setNotice("");
    setActiveTab("add");
  }

  function updateForm(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === "imageFront" ? { image: value } : {}),
    }));
  }

  async function handlePhoto(field, file) {
    if (!file) return;

    setNotice("");
    setUploadingImages((current) => ({ ...current, [field]: true }));

    try {
      const imageUrl = await uploadProductImage(
        file,
        field === "imageBack" ? "back" : "front",
      );
      updateForm(field, imageUrl);
      setStorageState("ready");
    } catch (e) {
      setStorageState("offline");
      setNotice(e.message || "Photo upload failed.");
    } finally {
      setUploadingImages((current) => ({ ...current, [field]: false }));
    }
  }

  async function saveProduct() {
    const id = editingId || makeProductId();
    const product = productFromForm(form, id);

    if (!product.name || product.price <= 0 || !product.imageFront) {
      setNotice("Name, price, and front photo are required.");
      return;
    }

    setSaving(true);
    setNotice("");

    try {
      const saved = editingId
        ? await updateProduct(editingId, product)
        : await createProduct(product);
      const normalized = normalizeProductImages(saved);

      setItems((current) =>
        editingId
          ? current.map((item) => (item.id === editingId ? normalized : item))
          : [normalized, ...current],
      );
      resetForm();
      setActiveTab("dresses");
      setStorageState("ready");
      setNotice(editingId ? "Dress updated." : "Dress published.");
    } catch (e) {
      setStorageState("offline");
      setNotice(e.message || "The dress could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleVisibility(product) {
    const nextActive = product.active === false;
    const nextProduct = { ...product, active: nextActive };

    setBusyProductId(product.id);
    setNotice("");

    try {
      const saved = await updateProduct(product.id, nextProduct);
      const normalized = normalizeProductImages(saved);

      setItems((current) =>
        current.map((item) => (item.id === product.id ? normalized : item)),
      );
      setStorageState("ready");
      setNotice(nextActive ? "Dress is visible in the shop." : "Dress is hidden.");
    } catch (e) {
      setStorageState("offline");
      setNotice(e.message || "Visibility could not be changed.");
    } finally {
      setBusyProductId("");
    }
  }

  async function removeProduct(product) {
    if (!confirm(`Delete ${product.name || "this dress"} from the catalog?`)) {
      return;
    }

    setBusyProductId(product.id);
    setNotice("");

    try {
      await deleteProduct(product.id);
      setItems((current) => current.filter((item) => item.id !== product.id));
      setStorageState("ready");
      setNotice("Dress deleted.");
    } catch (e) {
      setStorageState("offline");
      setNotice(e.message || "The dress could not be deleted.");
    } finally {
      setBusyProductId("");
    }
  }

  async function changeOrderStatus(orderId, status) {
    setOrdersList((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, currentStatus: status } : order,
      ),
    );

    try {
      await updateOrderStatus(orderId, status);
    } catch (e) {
      setNotice(e.message || "Order status could not be saved.");
    }
  }

  function renderCatalogList() {
    return (
      <section className="owner-panel">
        <div className="owner-panel-heading">
          <div>
            <span className="owner-kicker">Shop Catalog</span>
            <h3>Dresses</h3>
          </div>
          <button className="btn" type="button" onClick={startAdd}>
            Add Dress
          </button>
        </div>

        <div className="owner-toolbar">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search dresses"
          />
          <select
            value={visibilityFilter}
            onChange={(event) => setVisibilityFilter(event.target.value)}
          >
            <option value="all">All dresses</option>
            <option value="visible">Visible only</option>
            <option value="hidden">Hidden only</option>
          </select>
          <button
            className="btn secondary"
            type="button"
            onClick={refreshProducts}
          >
            Refresh
          </button>
        </div>

        <div className="owner-catalog-list">
          {filteredItems.length === 0 && (
            <div className="owner-empty-state">No dresses match this view.</div>
          )}

          {filteredItems.map((item) => {
            const images = getProductImages(item);
            const isBusy = busyProductId === item.id;

            return (
              <article className="owner-product-row" key={item.id}>
                <div className="owner-product-thumb">
                  {images.front ? (
                    <img src={images.front} alt={item.name} />
                  ) : (
                    <span>{(item.name || "DR").slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="owner-product-main">
                  <div className="owner-product-title-row">
                    <h4>{item.name || "Untitled dress"}</h4>
                    <span
                      className={
                        "owner-status-pill" +
                        (item.active === false ? " hidden" : "")
                      }
                    >
                      {item.active === false ? "Hidden" : "Visible"}
                    </span>
                  </div>
                  <p>
                    {item.category || "Dresses"} / {formatMoney(item.price)}
                  </p>
                  {item.description && <p>{item.description}</p>}
                </div>
                <div className="owner-row-actions">
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={() => startEdit(item)}
                  >
                    Edit
                  </button>
                  <button
                    className="btn secondary"
                    type="button"
                    disabled={isBusy}
                    onClick={() => toggleVisibility(item)}
                  >
                    {item.active === false ? "Show" : "Hide"}
                  </button>
                  <button
                    className="owner-danger-button"
                    type="button"
                    disabled={isBusy}
                    onClick={() => removeProduct(item)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  function renderProductForm() {
    const formImages = getProductImages(form);

    return (
      <section className="owner-panel">
        <div className="owner-panel-heading">
          <div>
            <span className="owner-kicker">
              {editingId ? "Edit Dress" : "New Dress"}
            </span>
            <h3>{editingId ? "Update shop item" : "Add a dress"}</h3>
          </div>
          {editingId && (
            <button className="btn secondary" type="button" onClick={startAdd}>
              Add New
            </button>
          )}
        </div>

        <div className="owner-form-grid">
          <div className="owner-photo-grid">
            <PhotoPicker
              id="front-photo"
              label="Front photo"
              image={formImages.front}
              uploading={uploadingImages.imageFront}
              onFile={(file) => handlePhoto("imageFront", file)}
              onClear={() => updateForm("imageFront", "")}
            />
            <PhotoPicker
              id="back-photo"
              label="Back photo"
              image={formImages.back}
              uploading={uploadingImages.imageBack}
              onFile={(file) => handlePhoto("imageBack", file)}
              onClear={() => updateForm("imageBack", "")}
            />
          </div>

          <div className="owner-fields">
            <label>
              Dress name
              <input
                value={form.name}
                onChange={(event) => updateForm("name", event.target.value)}
                placeholder="Classic wrap dress"
              />
            </label>
            <div className="owner-two-fields">
              <label>
                Price
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.price}
                  onChange={(event) => updateForm("price", event.target.value)}
                  placeholder="59.99"
                />
              </label>
              <label>
                Category
                <select
                  value={form.category}
                  onChange={(event) => updateForm("category", event.target.value)}
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Short description
              <textarea
                value={form.description}
                onChange={(event) =>
                  updateForm("description", event.target.value)
                }
                rows="4"
                placeholder="Light fabric, easy fit, perfect for weekend events."
              />
            </label>
            <label className="owner-toggle-row">
              <input
                type="checkbox"
                checked={form.active !== false}
                onChange={(event) => updateForm("active", event.target.checked)}
              />
              Visible in shop
            </label>
            <div className="owner-form-actions">
              <button
                className="btn"
                type="button"
                disabled={saving}
                onClick={saveProduct}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Save Dress"
                    : form.active === false
                      ? "Save Hidden"
                      : "Publish Dress"}
              </button>
              <button
                className="btn secondary"
                type="button"
                disabled={saving}
                onClick={resetForm}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  function renderOrders() {
    return (
      <section className="owner-panel">
        <div className="owner-panel-heading">
          <div>
            <span className="owner-kicker">Customer Orders</span>
            <h3>Orders</h3>
          </div>
          <button className="btn secondary" type="button" onClick={refreshOrders}>
            Refresh
          </button>
        </div>

        <div className="owner-toolbar">
          <input
            value={orderQuery}
            onChange={(event) => setOrderQuery(event.target.value)}
            placeholder="Search orders"
          />
          <select
            value={orderStatusFilter}
            onChange={(event) => setOrderStatusFilter(event.target.value)}
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </div>

        <div className="owner-orders-list">
          {displayedOrders.length === 0 && (
            <div className="owner-empty-state">No orders found.</div>
          )}

          {displayedOrders.map((order) => (
            <article className="owner-order-row" key={order.id}>
              <div>
                <div className="owner-order-title">Order {order.id}</div>
                <p>
                  {new Date(
                    order.createdAt || order.created || Date.now(),
                  ).toLocaleString()}
                </p>
                <div className="owner-order-items">
                  {(order.items || []).map((item, index) => (
                    <span key={`${order.id}-${index}`}>
                      {item.name || item.title || "Item"} x{" "}
                      {item.quantity || item.qty || 1}
                    </span>
                  ))}
                </div>
              </div>
              <div className="owner-order-side">
                <strong>{formatMoney(order.total || order.subtotal)}</strong>
                <select
                  value={order.currentStatus || "Placed"}
                  onChange={(event) =>
                    changeOrderStatus(order.id, event.target.value)
                  }
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </article>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="admin owner-admin container">
      <header className="owner-header">
        <div>
          <span className="owner-kicker">Owner Studio</span>
          <h2>Lizzy shop manager</h2>
          <p>
            {storageState === "ready"
              ? "Catalog storage is connected."
              : storageState === "loading"
                ? "Opening catalog storage..."
                : "Catalog storage is offline."}
          </p>
        </div>
        <button className="btn secondary" type="button" onClick={onLogout}>
          Sign Out
        </button>
      </header>

      <section className="owner-summary" aria-label="Store summary">
        <div>
          <strong>{visibleCount}</strong>
          <span>Visible dresses</span>
        </div>
        <div>
          <strong>{hiddenCount}</strong>
          <span>Hidden drafts</span>
        </div>
        <div>
          <strong>{recentOrders}</strong>
          <span>Open orders</span>
        </div>
      </section>

      <nav className="owner-tabs" aria-label="Owner sections">
        <button
          className={activeTab === "add" ? "active" : ""}
          type="button"
          onClick={() => setActiveTab("add")}
        >
          Add Dress
        </button>
        <button
          className={activeTab === "dresses" ? "active" : ""}
          type="button"
          onClick={() => setActiveTab("dresses")}
        >
          Dresses
        </button>
        <button
          className={activeTab === "orders" ? "active" : ""}
          type="button"
          onClick={() => setActiveTab("orders")}
        >
          Orders
        </button>
      </nav>

      {notice && <div className="owner-notice">{notice}</div>}

      {activeTab === "add" && renderProductForm()}
      {activeTab === "dresses" && renderCatalogList()}
      {activeTab === "orders" && renderOrders()}
    </div>
  );
}
