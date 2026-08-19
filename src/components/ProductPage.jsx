import React from "react";
import "../styles/product.css";
import { getProductImages } from "../utils/productImages.js";

export default function ProductPage({ product, onAdd, onBack }) {
  const productImages = getProductImages(product);

  function handleImageError(event) {
    event.currentTarget.hidden = true;
    event.currentTarget
      .closest(".garment-view-panel")
      ?.classList.add("product-image-fallback");
  }

  function renderGarmentView(src, label) {
    return (
      <div className="garment-view-panel">
        <span className="garment-view-label">{label}</span>
        <span aria-hidden>{product.name.slice(0, 2).toUpperCase()}</span>
        <img src={src} alt={`${product.name} ${label.toLowerCase()} view`} onError={handleImageError} />
      </div>
    );
  }

  return (
    <div className="product-page">
      <button className="back" onClick={onBack}>
        Back
      </button>
      <div className="product-detail">
        <div
          className={
            "product-detail-media garment-gallery" +
            (productImages.hasBack ? " has-back" : "")
          }
        >
          {renderGarmentView(productImages.front, "Front")}
          {productImages.hasBack && renderGarmentView(productImages.back, "Back")}
        </div>
        <div className="product-info">
          <span className="product-category">
            {product.category || "Collection"}
          </span>
          <h2>{product.name}</h2>
          <p className="price">₵{product.price.toFixed(2)}</p>
          <p className="desc">{product.description}</p>
          <div className="product-page-perks">
            <span>Secure checkout</span>
            <span>30-day returns</span>
            <span>Ships quickly</span>
          </div>
          <div className="actions">
            <button className="btn" onClick={() => onAdd(product)}>
              Add to cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
