import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// Clear corrupted empty products cache so defaults always show
try {
  const raw = localStorage.getItem("products");
  if (raw) {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.removeItem("products");
    }
  }
} catch (e) {
  localStorage.removeItem("products");
}

// Remove locally cached orders — the server DB is the source of truth
try {
  localStorage.removeItem("orders");
} catch (e) {}

const root = createRoot(document.getElementById("root"));
root.render(<App />);
