import React from "react";
import "../styles/product.css";

export default function ProductPage({ product, onAdd, onBack }) {
  return (
    <div className="product-page">
      <button className="back" onClick={onBack}>
        ← Back
      </button>
      <div className="product-detail">
        <img src={product.image} alt={product.name} />
        <div className="product-info">
          <h2>{product.name}</h2>
          <p className="price">${product.price.toFixed(2)}</p>
          <p className="desc">{product.description}</p>
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
