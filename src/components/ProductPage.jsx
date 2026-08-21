import React, { useEffect, useMemo, useState } from "react";
import "../styles/product.css";
import ProductShelf from "./ProductShelf.jsx";
import { getProductImages } from "../utils/productImages.js";
import { colorOptionKey, getProductColors } from "../utils/productColors.js";
import {
  getProductFitNote,
  getProductSizes,
  SIZE_GUIDE_ROWS,
} from "../utils/productSizing.js";
import { getProductStockStatus } from "../utils/productStock.js";

export default function ProductPage({
  product,
  onAdd,
  onBack,
  allProducts = [],
  onViewProduct,
  isSaved = false,
  onToggleSave,
  reviews = [],
  onAddReview,
  savedProductIds = [],
  onToggleProductSave,
  recentlyViewedProducts = [],
}) {
  const productImages = getProductImages(product);
  const productColors = getProductColors(product);
  const productSizes = getProductSizes(product);
  const productColorKey = productColors
    .map((color) => `${color.name}:${color.value}`)
    .join("|");
  const productSizeKey = productSizes.join("|");
  const galleryImages = productImages.list.length ? productImages.list : [""];
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState(productColors[0] || null);
  const [selectedSize, setSelectedSize] = useState(productSizes[0] || "");
  const activeImage = galleryImages[activeImageIndex] || galleryImages[0] || "";
  const hasGalleryControls = galleryImages.length > 1;
  const stockStatus = getProductStockStatus(product);
  const isSoldOut = !stockStatus.available;
  const [reviewName, setReviewName] = useState("");
  const [reviewRating, setReviewRating] = useState("5");
  const [reviewText, setReviewText] = useState("");
  const [reviewMessage, setReviewMessage] = useState("");

  const relatedProducts = useMemo(() => {
    const category = String(product.category || "").toLowerCase();
    const colorNames = new Set(
      productColors.map((color) => String(color.name || "").toLowerCase()),
    );

    return allProducts
      .filter((item) => item.id !== product.id)
      .map((item) => {
        const itemColors = getProductColors(item);
        const sharedColors = itemColors.filter((color) =>
          colorNames.has(String(color.name || "").toLowerCase()),
        ).length;
        const sameCategory =
          category &&
          String(item.category || "").toLowerCase() === category;
        const priceGap = Math.abs(
          Number(item.price || 0) - Number(product.price || 0),
        );

        return {
          item,
          score: (sameCategory ? 8 : 0) + sharedColors * 2 - priceGap / 100,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(({ item }) => item);
  }, [allProducts, product.id, product.category, product.price, productColorKey]);

  const cleanReviews = Array.isArray(reviews) ? reviews : [];
  const reviewAverage =
    cleanReviews.length > 0
      ? (
          cleanReviews.reduce(
            (total, review) => total + Number(review.rating || 0),
            0,
          ) / cleanReviews.length
        ).toFixed(1)
      : "";

  useEffect(() => {
    setActiveImageIndex(0);
  }, [product.id, galleryImages.length]);

  useEffect(() => {
    setSelectedColor(productColors[0] || null);
  }, [product.id, productColorKey]);

  useEffect(() => {
    setSelectedSize(productSizes[0] || "");
  }, [product.id, productSizeKey]);

  useEffect(() => {
    setReviewName("");
    setReviewRating("5");
    setReviewText("");
    setReviewMessage("");
  }, [product.id]);

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
    if (isSoldOut) return;
    onAdd({
      ...product,
      selectedColor: selectedColor || null,
      selectedSize,
    });
  }

  function handleReviewSubmit(event) {
    event.preventDefault();

    if (!reviewText.trim()) {
      setReviewMessage("Write a short review first.");
      return;
    }

    if (!onAddReview) return;

    onAddReview({
      name: reviewName,
      rating: reviewRating,
      text: reviewText,
    });
    setReviewName("");
    setReviewRating("5");
    setReviewText("");
    setReviewMessage("Review added.");
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
          <div className="product-stock-status">
            <span className={`stock-pill ${stockStatus.key}`}>
              {stockStatus.label}
            </span>
          </div>
          <p className="desc">{product.description}</p>
          <div className="product-size-section">
            <div className="product-size-heading">
              <span>Choose size</span>
              <strong>{selectedSize}</strong>
            </div>
            <div className="product-size-options" aria-label="Choose size">
              {productSizes.map((size) => (
                <button
                  key={size}
                  className={selectedSize === size ? "active" : ""}
                  type="button"
                  onClick={() => setSelectedSize(size)}
                  aria-pressed={selectedSize === size}
                >
                  {size}
                </button>
              ))}
            </div>
            <details className="size-guide">
              <summary>Size guide</summary>
              <p>{getProductFitNote(product)}</p>
              <div className="size-guide-table-wrap">
                <table className="size-guide-table">
                  <caption>Body measurements in inches</caption>
                  <thead>
                    <tr>
                      <th scope="col">Size</th>
                      <th scope="col">Bust</th>
                      <th scope="col">Waist</th>
                      <th scope="col">Hip</th>
                    </tr>
                  </thead>
                  <tbody>
                    {SIZE_GUIDE_ROWS.map((row) => (
                      <tr key={row.size}>
                        <th scope="row">{row.size}</th>
                        <td>{row.bust}</td>
                        <td>{row.waist}</td>
                        <td>{row.hip}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>
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
            <button className="btn" onClick={addSelectedProduct} disabled={isSoldOut}>
              {isSoldOut ? "Sold out" : "Add to cart"}
            </button>
            {onToggleSave && (
              <button
                className="btn secondary"
                type="button"
                onClick={onToggleSave}
                aria-pressed={isSaved}
              >
                {isSaved ? "Saved" : "Save for later"}
              </button>
            )}
          </div>
        </div>
      </div>

      <section className="reviews-panel" aria-labelledby="product-reviews-title">
        <div className="detail-section-heading">
          <div>
            <span className="eyebrow">Customer Reviews</span>
            <h3 id="product-reviews-title">Reviews</h3>
          </div>
          <p>
            {cleanReviews.length > 0
              ? `${reviewAverage}/5 average from ${cleanReviews.length} ${
                  cleanReviews.length === 1 ? "review" : "reviews"
                }.`
              : "Be the first to review this piece."}
          </p>
        </div>

        <div className="reviews-layout">
          <form className="review-form" onSubmit={handleReviewSubmit}>
            <label>
              Name
              <input
                value={reviewName}
                onChange={(event) => setReviewName(event.target.value)}
                placeholder="Your name"
              />
            </label>
            <label>
              Rating
              <select
                value={reviewRating}
                onChange={(event) => setReviewRating(event.target.value)}
              >
                <option value="5">5 - Excellent</option>
                <option value="4">4 - Good</option>
                <option value="3">3 - Okay</option>
                <option value="2">2 - Not ideal</option>
                <option value="1">1 - Poor</option>
              </select>
            </label>
            <label className="review-text-field">
              Review
              <textarea
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value)}
                rows="4"
                placeholder="Share fit, fabric, or styling notes"
              />
            </label>
            <div className="review-form-actions">
              <button className="btn" type="submit">
                Add review
              </button>
              {reviewMessage && <span>{reviewMessage}</span>}
            </div>
          </form>

          <div className="review-list">
            {cleanReviews.length > 0 ? (
              cleanReviews.map((review, index) => (
                <article
                  className="review-card"
                  key={review.id || `${review.createdAt || "review"}-${index}`}
                >
                  <div className="review-card-top">
                    <strong>{review.name || "Customer"}</strong>
                    <span>{Number(review.rating || 5)}/5</span>
                  </div>
                  <p>{review.text}</p>
                  <small>
                    {new Date(review.createdAt || Date.now()).toLocaleDateString()}
                  </small>
                </article>
              ))
            ) : (
              <div className="review-empty">No reviews yet.</div>
            )}
          </div>
        </div>
      </section>

      <ProductShelf
        kicker="More To Try"
        title="Related products"
        description="Pieces from the same edit, colours, or price range."
        products={relatedProducts}
        onView={onViewProduct}
        onAdd={onAdd}
        savedProductIds={savedProductIds}
        onToggleSave={onToggleProductSave}
        className="related-products"
      />

      <ProductShelf
        kicker="Recently Viewed"
        title="Viewed recently"
        description="A quick path back to products you opened earlier."
        products={recentlyViewedProducts.slice(0, 4)}
        onView={onViewProduct}
        onAdd={onAdd}
        savedProductIds={savedProductIds}
        onToggleSave={onToggleProductSave}
        className="recently-viewed-products"
      />
    </div>
  );
}
