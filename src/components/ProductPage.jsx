import React, { useEffect, useState } from "react";
import "../styles/product.css";
import { getProductImages } from "../utils/productImages.js";
import { colorOptionKey, getProductColors } from "../utils/productColors.js";

export default function ProductPage({ product, onAdd, onBack }) {
  const productImages = getProductImages(product);
  const productColors = getProductColors(product);
  const productColorKey = productColors
    .map((color) => `${color.name}:${color.value}`)
    .join("|");
  const galleryImages = productImages.list.length ? productImages.list : [""];
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState(productColors[0] || null);
  const activeImage = galleryImages[activeImageIndex] || galleryImages[0] || "";
  const hasGalleryControls = galleryImages.length > 1;

  useEffect(() => {
    setActiveImageIndex(0);
  }, [product.id, galleryImages.length]);

  useEffect(() => {
    setSelectedColor(productColors[0] || null);
  }, [product.id, productColorKey]);

  function handleImageError(event) {
    event.currentTarget.hidden = true;
    event.currentTarget
      .closest(".garment-view-panel")
      ?.classList.add("product-image-fallback");
  }

  function showPreviousImage() {
    setActiveImageIndex((index) =>
      index === 0 ? galleryImages.length - 1 : index - 1,
    );
  }

  function showNextImage() {
    setActiveImageIndex((index) =>
      index === galleryImages.length - 1 ? 0 : index + 1,
    );
  }

  function addSelectedProduct() {
    onAdd(selectedColor ? { ...product, selectedColor } : product);
  }

  return (
    <div className="product-page">
      <button className="back" onClick={onBack}>
        Back
      </button>
      <div className="product-detail">
        <div className="product-detail-media garment-gallery">
          <div className="garment-view-panel">
            <span aria-hidden>{product.name.slice(0, 2).toUpperCase()}</span>
            {activeImage && (
              <img
                src={activeImage}
                alt={`${product.name} view ${activeImageIndex + 1}`}
                onError={handleImageError}
              />
            )}
            {hasGalleryControls && (
              <div className="garment-gallery-controls" aria-label="Product photos">
                <button
                  className="garment-arrow prev"
                  type="button"
                  onClick={showPreviousImage}
                  aria-label="Previous photo"
                >
                  <span aria-hidden="true">‹</span>
                </button>
                <button
                  className="garment-arrow next"
                  type="button"
                  onClick={showNextImage}
                  aria-label="Next photo"
                >
                  <span aria-hidden="true">›</span>
                </button>
              </div>
            )}
          </div>

          {hasGalleryControls && (
            <div className="garment-thumbnails" aria-label="Choose product photo">
              {galleryImages.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  className={index === activeImageIndex ? "active" : ""}
                  onClick={() => setActiveImageIndex(index)}
                  aria-label={`Show photo ${index + 1}`}
                >
                  <img src={image} alt="" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="product-info">
          <span className="product-category">
            {product.category || "Collection"}
          </span>
          <h2>{product.name}</h2>
          <p className="price">₵{product.price.toFixed(2)}</p>
          <p className="desc">{product.description}</p>
          {productColors.length > 0 && (
            <div className="product-color-section">
              <div className="product-color-heading">Available colours</div>
              <div className="product-color-options">
                {productColors.map((color, index) => {
                  const active =
                    selectedColor &&
                    selectedColor.name === color.name &&
                    selectedColor.value === color.value;

                  return (
                    <button
                      key={colorOptionKey(color, index)}
                      className={active ? "active" : ""}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      aria-pressed={active}
                    >
                      <span
                        className="color-dot"
                        style={{ backgroundColor: color.value }}
                        aria-hidden="true"
                      />
                      {color.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <div className="product-page-perks">
            <span>Secure checkout</span>
            <span>30-day returns</span>
            <span>Ships quickly</span>
          </div>
          <div className="actions">
            <button className="btn" onClick={addSelectedProduct}>
              Add to cart
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
