import React from "react";
import "../styles/product.css";
import ProductCard from "./ProductCard.jsx";

export default function ProductShelf({
  kicker,
  title,
  description,
  products,
  onView,
  onAdd,
  savedProductIds = [],
  onToggleSave,
  className = "",
}) {
  if (!Array.isArray(products) || products.length === 0) return null;

  return (
    <section className={`product-shelf ${className}`.trim()}>
      <div className="detail-section-heading">
        <div>
          {kicker && <span className="eyebrow">{kicker}</span>}
          <h3>{title}</h3>
        </div>
        {description && <p>{description}</p>}
      </div>
      <div className="product-grid shelf-grid">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onView={() => onView && onView(product)}
            onAdd={(item) => onAdd && onAdd(item || product)}
            isSaved={savedProductIds.includes(product.id)}
            onToggleSave={onToggleSave}
          />
        ))}
      </div>
    </section>
  );
}
