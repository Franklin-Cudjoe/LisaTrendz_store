import React from "react";
import "../styles/product.css";
import ProductCard from "./ProductCard.jsx";

export default function ProductList({ products, onView, onAdd }) {
  return (
    <div className="product-grid">
      {products.map((p) => (
        <ProductCard
          key={p.id}
          product={p}
          onView={() => onView(p)}
          onAdd={(item) => onAdd(item || p)}
        />
      ))}
    </div>
  );
}
