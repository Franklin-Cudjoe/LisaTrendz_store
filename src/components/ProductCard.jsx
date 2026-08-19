import React from "react";
import "../styles/product.css";
import { getProductImages } from "../utils/productImages.js";

export default function ProductCard({ product, onView, onAdd }) {
  const productImages = getProductImages(product);
  const categoryKey = product.category || "Collection";
  const initials = product.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  const badge =
    product.price >= 100
      ? "Premium pick"
      : product.price < 35
        ? "Everyday value"
        : "New arrival";
  const rating = product.price >= 100 ? "4.9" : "4.8";
  const stockLabel = product.price >= 100 ? "Low stock" : "In stock";
  const swatches = ["#20232a", "#f7f5ef", "#0f766e"];

  function handleImageError(event) {
    event.currentTarget.hidden = true;
    event.currentTarget.parentElement?.classList.add("media-fallback");
  }

  return (
    <article className="card">
      <div className="media">
        <span className="product-badge">{badge}</span>
        <span className="fallback-mark" aria-hidden>
          {initials}
        </span>
        <img
          src={productImages.front}
          alt={product.name}
          loading="lazy"
          onError={handleImageError}
        />
      </div>
      <div className="card-body">
        <div className="product-card-topline">
          <span className="product-category">{categoryKey}</span>
          <span className="product-rating">{rating}</span>
        </div>
        <h3 className="product-title">{product.name}</h3>
        <p className="product-summary">
          {product.description || "A refined staple from the Lizzy edit."}
        </p>
        <div className="product-meta">
          <span>{stockLabel}</span>
          <span>Ships in 48h</span>
        </div>
        <div className="product-commerce-row">
          <div className="swatches" aria-label={`${product.name} colors`}>
            {swatches.map((color) => (
              <span key={color} style={{ background: color }} />
            ))}
          </div>
          <span className="product-fit">True fit</span>
        </div>
        <p className="price">₵{product.price.toFixed(2)}</p>
        <div className="card-actions">
          <button className="btn secondary" onClick={onView}>
            Details
          </button>
          <button
            className="btn"
            onClick={onAdd}
            aria-label={`Add ${product.name} to cart`}
          >
            Add to bag
          </button>
        </div>
      </div>
    </article>
  );
}
