import React from "react";
import "../styles/product.css";
import ProductList from "./ProductList.jsx";

export default function SavedProducts({
  products,
  onView,
  onAdd,
  onBack,
  savedProductIds = [],
  onToggleSave,
}) {
  return (
    <section className="wishlist-page container">
      <button className="back" type="button" onClick={onBack}>
        Back
      </button>

      <div className="wishlist-hero">
        <div>
          <span className="eyebrow">Saved Edit</span>
          <h2>Your saved pieces</h2>
        </div>
        <p>
          {products.length > 0
            ? `${products.length} saved ${products.length === 1 ? "item" : "items"}.`
            : "Save pieces from the shop and compare them here."}
        </p>
      </div>

      {products.length > 0 ? (
        <ProductList
          products={products}
          onView={onView}
          onAdd={onAdd}
          savedProductIds={savedProductIds}
          onToggleSave={onToggleSave}
        />
      ) : (
        <div className="empty-products wishlist-empty">
          <h3>No saved products yet</h3>
          <p>Use Save on any product card to build a shortlist.</p>
          <button className="btn secondary" type="button" onClick={onBack}>
            Continue shopping
          </button>
        </div>
      )}
    </section>
  );
}
