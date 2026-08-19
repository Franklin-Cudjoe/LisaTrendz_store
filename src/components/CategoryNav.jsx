import React from "react";
import "../styles/category.css";
import { DEFAULT_CATEGORIES } from "../data/categories.js";

export default function CategoryNav({
  selected = "All",
  onChange,
  categories = DEFAULT_CATEGORIES,
}) {
  const visibleCategories =
    Array.isArray(categories) && categories.length > 0
      ? categories
      : DEFAULT_CATEGORIES;

  return (
    <nav className="category-nav" aria-label="Categories">
      <ul className="category-list">
        {visibleCategories.map((cat) => (
          <li key={cat} className="category-item">
            <button
              className={"cat-btn" + (cat === selected ? " active" : "")}
              onClick={() => onChange(cat)}
              aria-pressed={cat === selected}
            >
              <span className="cat-icon" aria-hidden />
              <span className="cat-label">{cat}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
