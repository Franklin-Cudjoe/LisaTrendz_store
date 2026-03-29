import React from "react";
import ProductList from "./ProductList.jsx";
import Hero from "./Hero.jsx";
import CategoryNav from "./CategoryNav.jsx";

export default function Home({
  products,
  onView,
  onAdd,
  category,
  onCategoryChange,
}) {
  return (
    <section>
      <Hero />

      <div className="category-wrap">
        <CategoryNav selected={category} onChange={onCategoryChange} />
      </div>

      <div className="container">
        <ProductList products={products} onView={onView} onAdd={onAdd} />
      </div>
    </section>
  );
}
