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
  categories,
}) {
  function scrollToCollections() {
    const element = document.getElementById("collections");
    if (!element) return;

    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="storefront">
      <Hero
        onShop={scrollToCollections}
        onExplore={() => onCategoryChange("All")}
      />

      <div className="container post-hero-edit" aria-label="Store highlights">
        {/* <div>
          <span className="eyebrow">CURATED DROP 08</span>
          <p>New arrivals, cleaner checkout, and easy garment browsing.</p>
        </div> */}
        {/* <div className="post-hero-pills" aria-label="Shopping benefits">
          <span>48h dispatch</span>
          <span>30d returns</span>
          <span>4.9 fit</span>
        </div> */}
      </div>

      <div className="category-wrap">
        <CategoryNav
          selected={category}
          onChange={onCategoryChange}
          categories={categories}
        />
      </div>

      <div className="container" id="collections">
        <div className="collection-heading">
          <div>
            <span className="eyebrow">THE LIZZY EDIT</span>
            <h2>
              {category === "All" ? "Pieces with a point of view." : category}
            </h2>
          </div>
          <p>
            {category === "All"
              ? `${products.length} selected arrivals.`
              : `${products.length} ${category.toLowerCase()} pieces.`}
          </p>
        </div>
        <ProductList products={products} onView={onView} onAdd={onAdd} />
      </div>
      <div className="service-strip" aria-label="Shopping benefits">
        <span>
          <strong>01</strong> Free shipping over ₵75
        </span>
        <span>
          <strong>02</strong> Easy 30-day returns
        </span>
        <span>
          <strong>03</strong> Designed for every day
        </span>
      </div>
    </section>
  );
}
