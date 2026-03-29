import React from "react";
import "../styles/category.css";

const CATEGORIES = [
  "All",
  "Rompers and Jumpsuits",
  "Tops",
  "Leggings",
  "Seamless set",
  "Shorts",
  "Dresses",
];

export default function CategoryNav({ selected = "All", onChange }) {
  return (
    <nav className="category-nav" aria-label="Categories">
      <ul className="category-list">
        {CATEGORIES.map((cat) => (
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
