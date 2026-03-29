import React from "react";
import "../styles/product.css";

export default function ProductCard({ product, onView, onAdd }) {
  return (
    <article className="card">
      <div className="media">
        <img src={product.image} alt={product.name} loading="lazy" />
      </div>
      <div className="card-body">
        <h3 className="product-title">{product.name}</h3>
        <p className="price">${product.price.toFixed(2)}</p>
        <div className="card-actions">
          <button className="btn" onClick={onView}>
            View
          </button>
          <button className="btn secondary" onClick={onAdd}>
            Add
          </button>
        </div>
      </div>
    </article>
  );
}
