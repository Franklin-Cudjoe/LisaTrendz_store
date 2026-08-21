import React, { useEffect, useMemo, useState } from "react";
import ProductList from "./ProductList.jsx";
import ProductShelf from "./ProductShelf.jsx";
import Hero from "./Hero.jsx";
import CategoryNav from "./CategoryNav.jsx";
import StoreHelp from "./StoreHelp.jsx";
import { getProductColors } from "../utils/productColors.js";
import { getProductStockStatus } from "../utils/productStock.js";

const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "newest", label: "Newest" },
  { value: "price-low", label: "Price: low to high" },
  { value: "price-high", label: "Price: high to low" },
  { value: "name", label: "Name: A to Z" },
];

const AVAILABILITY_OPTIONS = [
  { value: "all", label: "All availability" },
  { value: "in-stock", label: "In stock" },
  { value: "low-stock", label: "Low stock" },
  { value: "sold-out", label: "Sold out" },
];

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function getCreatedTime(product) {
  const raw = product.createdAt || product.updatedAt || product.created || 0;
  const value = typeof raw === "number" ? raw : Date.parse(raw);

  return Number.isFinite(value) ? value : 0;
}

export default function Home({
  products,
  onView,
  onAdd,
  category,
  onCategoryChange,
  categories,
  savedProductIds = [],
  onToggleSave,
  recentlyViewedProducts = [],
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const [selectedColor, setSelectedColor] = useState("all");
  const [availability, setAvailability] = useState("all");
  const [priceLimit, setPriceLimit] = useState("");

  const maxPrice = useMemo(
    () =>
      products.reduce(
        (highest, product) => Math.max(highest, Number(product.price) || 0),
        0,
      ),
    [products],
  );

  const colorOptions = useMemo(() => {
    const seen = new Set();

    return products.reduce((list, product) => {
      getProductColors(product).forEach((color) => {
        const key = normalizeText(color.name || color.value);

        if (!key || seen.has(key)) return;

        seen.add(key);
        list.push(color);
      });

      return list;
    }, []);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = normalizeText(searchQuery);
    const colorKey = normalizeText(selectedColor);
    const maxAllowedPrice = priceLimit ? Number(priceLimit) : null;

    const matches = products.filter((product) => {
      const productColors = getProductColors(product);
      const searchable = normalizeText(
        [
          product.name,
          product.category,
          product.description,
          ...productColors.map((color) => color.name),
        ].join(" "),
      );
      const matchesQuery = !query || searchable.includes(query);
      const matchesColor =
        selectedColor === "all" ||
        productColors.some((color) => normalizeText(color.name) === colorKey);
      const matchesAvailability =
        availability === "all" ||
        getProductStockStatus(product).key === availability;
      const matchesPrice =
        maxAllowedPrice == null || Number(product.price) <= maxAllowedPrice;

      return (
        matchesQuery && matchesColor && matchesAvailability && matchesPrice
      );
    });

    return [...matches].sort((a, b) => {
      if (sortBy === "newest") return getCreatedTime(b) - getCreatedTime(a);
      if (sortBy === "price-low") return Number(a.price) - Number(b.price);
      if (sortBy === "price-high") return Number(b.price) - Number(a.price);
      if (sortBy === "name") return a.name.localeCompare(b.name);

      return 0;
    });
  }, [availability, priceLimit, products, searchQuery, selectedColor, sortBy]);

  const hasActiveFilters =
    searchQuery ||
    sortBy !== "featured" ||
    selectedColor !== "all" ||
    availability !== "all" ||
    priceLimit;

  useEffect(() => {
    const selectedColorExists = colorOptions.some(
      (color) => normalizeText(color.name) === normalizeText(selectedColor),
    );

    if (selectedColor !== "all" && !selectedColorExists) {
      setSelectedColor("all");
    }
  }, [colorOptions, selectedColor]);

  useEffect(() => {
    if (priceLimit && Number(priceLimit) > Math.ceil(maxPrice)) {
      setPriceLimit("");
    }
  }, [maxPrice, priceLimit]);

  function scrollToCollections() {
    const element = document.getElementById("collections");
    if (!element) return;

    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function clearFilters() {
    setSearchQuery("");
    setSortBy("featured");
    setSelectedColor("all");
    setAvailability("all");
    setPriceLimit("");
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
            <span className="eyebrow">THE LISATRENDZ EDIT</span>
            <h2>
              {category === "All" ? "Pieces with a point of view." : category}
            </h2>
          </div>
          <p>
            {category === "All"
              ? `${filteredProducts.length} selected arrivals.`
              : `${filteredProducts.length} ${category.toLowerCase()} pieces.`}
          </p>
        </div>
        <div className="collection-toolbar" aria-label="Product filters">
          <label className="filter-field search-field">
            <span>Search</span>
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search products"
            />
          </label>

          <label className="filter-field">
            <span>Sort</span>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Colour</span>
            <select
              value={selectedColor}
              onChange={(event) => setSelectedColor(event.target.value)}
            >
              <option value="all">All colours</option>
              {colorOptions.map((color) => (
                <option key={`${color.name}-${color.value}`} value={color.name}>
                  {color.name}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field">
            <span>Availability</span>
            <select
              value={availability}
              onChange={(event) => setAvailability(event.target.value)}
            >
              {AVAILABILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="filter-field price-filter">
            <span>
              {priceLimit ? `Price up to GHS ${priceLimit}` : "All prices"}
            </span>
            <input
              type="range"
              min="0"
              max={Math.max(Math.ceil(maxPrice), 1)}
              value={priceLimit || Math.ceil(maxPrice)}
              onChange={(event) => setPriceLimit(event.target.value)}
              disabled={maxPrice <= 0}
            />
          </label>

          <div className="filter-actions">
            <span>{filteredProducts.length} found</span>
            <button
              type="button"
              className="btn secondary tiny"
              onClick={clearFilters}
              disabled={!hasActiveFilters}
            >
              Clear
            </button>
          </div>
        </div>

        {filteredProducts.length > 0 ? (
          <ProductList
            products={filteredProducts}
            onView={onView}
            onAdd={onAdd}
            savedProductIds={savedProductIds}
            onToggleSave={onToggleSave}
          />
        ) : (
          <div className="empty-products">
            <h3>No products found</h3>
            <p>Try a different search, colour, price, or availability.</p>
            <button type="button" className="btn secondary" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}
      </div>
      {recentlyViewedProducts.length > 0 && (
        <div className="container">
          <ProductShelf
            kicker="Recently Viewed"
            title="Pick up where you left off"
            description="Your latest product views, kept on this device."
            products={recentlyViewedProducts.slice(0, 4)}
            onView={onView}
            onAdd={onAdd}
            savedProductIds={savedProductIds}
            onToggleSave={onToggleSave}
            className="home-recently-viewed"
          />
        </div>
      )}
      <StoreHelp />
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
