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
import {
  colorOptionKey,
  getProductColors,
  normalizeColorOption,
  normalizeProductColors,
} from "../utils/productColors.js";

const EMPTY_PRODUCT_FORM = {
  name: "",
  price: "",
  category: "Dresses",
  image: "",
  imageFront: "",
  imageBack: "",
  images: [],
  colors: [],
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

function normalizeProduct(product) {
  return normalizeProductColors(normalizeProductImages(product));
}

function photoCountLabel(count) {
  return `${count} ${count === 1 ? "photo" : "photos"}`;
}

function applyGalleryImages(current, images) {
  const galleryImages = getProductImages({ images }).list;

  return {
    ...current,
    images: galleryImages,
    image: galleryImages[0] || "",
    imageFront: galleryImages[0] || "",
    imageBack: galleryImages[1] || "",
  };
}

function colorCountLabel(count) {
  return `${count} ${count === 1 ? "color" : "colors"}`;
}

function applyProductColors(current, colors) {
  return {
    ...current,
    colors: getProductColors({ colors }),
  };
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
  const galleryImages = getProductImages(form).list;
  const imageFront = galleryImages[0] || "";
  const imageBack = galleryImages[1] || "";

  return normalizeProductColors(
    normalizeProductImages({
      id,
      name: cleanText(form.name),
      price: Number(form.price),
      category: cleanText(form.category) || "Dresses",
      image: imageFront,
      imageFront,
      imageBack,
      images: galleryImages,
      colors: getProductColors(form),
      description: cleanText(form.description),
      active: form.active !== false,
    }),
  );
}

function formFromProduct(product) {
  const images = getProductImages(product);
  const colors = getProductColors(product);

  return {
    name: product.name || "",
    price: product.price ?? "",
    category: product.category || "Dresses",
    image: images.front,
    imageFront: images.front,
    imageBack: images.back,
    images: images.list,
    colors,
    description: product.description || "",
    active: product.active !== false,
  };
}

function GalleryPhotoManager({
  images,
  uploading,
  onUploadFiles,
  onRemove,
  onMakePrimary,
}) {
  const count = images.length;

  return (
    <div className="owner-gallery-manager">
      <div className="owner-gallery-heading">
        <span>Dress photos</span>
        <strong>{photoCountLabel(count)}</strong>
      </div>
      <div className="owner-gallery-list">
        {images.map((image, index) => (
          <figure className="owner-gallery-tile" key={`${image}-${index}`}>
            <img src={image} alt={`Dress photo ${index + 1}`} />
            <figcaption>
              {index === 0 ? "Main photo" : `Photo ${index + 1}`}
            </figcaption>
            <div className="owner-gallery-actions">
              {index > 0 && (
                <button type="button" onClick={() => onMakePrimary(index)}>
                  Make Main
                </button>
              )}
              <button type="button" onClick={() => onRemove(index)}>
                Remove
              </button>
            </div>
          </figure>
        ))}

        <label
          className={
            "owner-gallery-upload" + (uploading ? " is-uploading" : "")
          }
          htmlFor="dress-gallery-upload"
          aria-disabled={uploading}
        >
          <span>
            {uploading
              ? "Uploading..."
              : count > 0
                ? "Add More Photos"
                : "Add Photos"}
          </span>
          <small>{count > 0 ? "Choose more photos" : "Choose photos"}</small>
        </label>
        <input
          id="dress-gallery-upload"
          type="file"
          accept="image/*"
          multiple
          disabled={uploading}
          onChange={(event) => {
            onUploadFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

function ColorManager({ colors, onAdd, onRemove }) {
  const [name, setName] = useState("");
  const [value, setValue] = useState("#20232a");

  function handleSubmit(event) {
    event.preventDefault();
    onAdd({ name, value });
    setName("");
  }

  return (
    <div className="owner-color-manager">
      <div className="owner-gallery-heading">
        <span>Available colors</span>
        <strong>{colorCountLabel(colors.length)}</strong>
      </div>

      <div className="owner-color-list">
        {colors.map((color, index) => (
          <span className="owner-color-pill" key={colorOptionKey(color, index)}>
            <span
              className="owner-color-swatch"
              style={{ backgroundColor: color.value }}
              aria-hidden="true"
            />
            {color.name}
            <button
              type="button"
              onClick={() => onRemove(index)}
              aria-label={`Remove ${color.name}`}
            >
              Remove
            </button>
          </span>
        ))}
      </div>

      <form className="owner-color-form" onSubmit={handleSubmit}>
        <input
          type="color"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label="Color swatch"
        />
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Color name"
        />
        <button className="btn secondary" type="submit">
          Add Color
        </button>
      </form>
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
  const [uploadMessage, setUploadMessage] = useState("");
  const [storageState, setStorageState] = useState("loading");
  const [ordersList, setOrdersList] = useState([]);
  const [orderQuery, setOrderQuery] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("");

  useEffect(() => {
    async function loadProducts() {
      try {
        const products = await fetchProducts({ includeHidden: true });
        setItems(products.map(normalizeProduct));
        setStorageState("ready");
      } catch (e) {
        setStorageState("offline");

        try {
          const raw = localStorage.getItem("products");
          const parsed = raw ? JSON.parse(raw) : null;

          if (Array.isArray(parsed)) {
            setItems(parsed.map(normalizeProduct));
          } else {
            setItems(defaultProducts.map(normalizeProduct));
          }
        } catch (error) {
          setItems(defaultProducts.map(normalizeProduct));
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

    if (onChange) onChange(items.map(normalizeProduct));
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
      setItems(products.map(normalizeProduct));
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

  function updateGalleryImages(images) {
    setForm((current) => applyGalleryImages(current, images));
  }

  function appendGalleryImages(images) {
    setForm((current) =>
      applyGalleryImages(current, [...getProductImages(current).list, ...images]),
    );
  }

  function removeGalleryImage(index) {
    setForm((current) =>
      applyGalleryImages(
        current,
        getProductImages(current).list.filter(
          (_, imageIndex) => imageIndex !== index,
        ),
      ),
    );
  }

  function makePrimaryImage(index) {
    setForm((current) => {
      const galleryImages = getProductImages(current).list;
      const selectedImage = galleryImages[index];

      if (!selectedImage) return current;

      return applyGalleryImages(current, [
        selectedImage,
        ...galleryImages.filter((_, imageIndex) => imageIndex !== index),
      ]);
    });
  }

  function addProductColor(color) {
    const normalized = normalizeColorOption(color);

    if (!normalized) {
      setNotice("Add a color name first.");
      return;
    }

    setForm((current) =>
      applyProductColors(current, [
        ...getProductColors(current),
        normalized,
      ]),
    );
    setNotice("");
  }

  function removeProductColor(index) {
    setForm((current) =>
      applyProductColors(
        current,
        getProductColors(current).filter((_, colorIndex) => colorIndex !== index),
      ),
    );
  }

  async function handleGalleryPhotos(fileList) {
    const files = Array.from(fileList || []);

    if (files.length === 0) return;

    setNotice("");
    setUploadMessage(
      files.length === 1 ? "Preparing photo..." : `Preparing ${files.length} photos...`,
    );
    setUploadingImages((current) => ({ ...current, gallery: true }));

    try {
      let uploadedCount = 0;
      const failedFiles = [];

      for (const [index, file] of files.entries()) {
        setUploadMessage(
          `Reducing and uploading photo ${index + 1} of ${files.length}...`,
        );

        try {
          const uploadedUrl = await uploadProductImage(file, "gallery");
          appendGalleryImages([uploadedUrl]);
          uploadedCount += 1;
        } catch (error) {
          failedFiles.push(file.name || `photo ${index + 1}`);
        }
      }

      if (uploadedCount > 0) {
        setStorageState("ready");
      }

      if (failedFiles.length > 0) {
        setNotice(
          uploadedCount > 0
            ? `${photoCountLabel(uploadedCount)} added. ${photoCountLabel(
                failedFiles.length,
              )} could not upload.`
            : "Photo upload failed.",
        );
      } else {
        setNotice("");
      }

      setUploadMessage(
        uploadedCount === 0
          ? ""
          : uploadedCount === 1
            ? "Photo ready."
            : `${photoCountLabel(uploadedCount)} ready.`,
      );
    } catch (e) {
      setStorageState("offline");
      setNotice(e.message || "Photo upload failed.");
      setUploadMessage("");
    } finally {
      setUploadingImages((current) => ({ ...current, gallery: false }));
      setTimeout(() => setUploadMessage(""), 1800);
    }
  }

  async function saveProduct() {
    const id = editingId || makeProductId();
    const product = productFromForm(form, id);

    if (!product.name || product.price <= 0 || product.images.length === 0) {
      setNotice("Name, price, and at least one photo are required.");
      return;
    }

    setSaving(true);
    setNotice("");

    try {
      const saved = editingId
        ? await updateProduct(editingId, product)
        : await createProduct(product);
      const normalized = normalizeProduct(saved);

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
      const normalized = normalizeProduct(saved);

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
            const colors = getProductColors(item);
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
                  <p>
                    {photoCountLabel(images.count)} in gallery
                  </p>
                  <p>
                    {colors.length > 0
                      ? `${colorCountLabel(colors.length)} available`
                      : "No colors set"}
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
            <GalleryPhotoManager
              images={formImages.list}
              uploading={uploadingImages.gallery}
              onUploadFiles={handleGalleryPhotos}
              onRemove={removeGalleryImage}
              onMakePrimary={makePrimaryImage}
            />
            {uploadMessage && (
              <div className="owner-upload-message">{uploadMessage}</div>
            )}
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
            <ColorManager
              colors={getProductColors(form)}
              onAdd={addProductColor}
              onRemove={removeProductColor}
            />
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
