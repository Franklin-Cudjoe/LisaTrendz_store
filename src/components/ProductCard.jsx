import React from "react";
import "../styles/product.css";
import { getProductImages } from "../utils/productImages.js";
import { colorOptionKey, getProductColors } from "../utils/productColors.js";

export default function ProductCard({ product, onView, onAdd }) {
  const productImages = getProductImages(product);
  const productColors = getProductColors(product);
  const visibleColors = productColors.slice(0, 5);
  const categoryKey = product.category || "Collection";
  const initials = product.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
  const rating = product.price >= 100 ? "4.9" : "4.8";
  const stockLabel = product.price >= 100 ? "Low stock" : "In stock";
  const productForCart =
    productColors.length > 0
      ? { ...product, selectedColor: productColors[0] }
      : product;

  function handleImageError(event) {
    event.currentTarget.hidden = true;
    event.currentTarget.parentElement?.classList.add("media-fallback");
  }

  return (
    <article className="card">
      <div className="media">
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
        {productColors.length > 0 && (
          <div className="product-commerce-row">
            <div
              className="swatches"
              aria-label={`${product.name} available colours`}
            >
              {visibleColors.map((color, index) => (
                <span
                  key={colorOptionKey(color, index)}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
            <span className="product-fit">
              {productColors.length} {productColors.length === 1 ? "colour" : "colours"}
            </span>
          </div>
        )}
        <p className="price">₵{product.price.toFixed(2)}</p>
        <div className="card-actions">
          <button className="btn secondary" onClick={onView}>
            Details
          </button>
          <button
            className="btn"
            onClick={() => onAdd(productForCart)}
            aria-label={`Add ${product.name} to cart`}
          >
            Add to bag
          </button>
        </div>
      </div>
    </article>
  );
}
