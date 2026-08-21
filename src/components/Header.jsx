import React from "react";
import "../styles/header.css";
import logoSrc from "../assets/logo.png";

export default function Header({
  cartCount,
  savedCount = 0,
  onCart,
  onHome,
  onSaved,
  onAdmin,
  onTrack,
}) {
  return (
    <header className="site-header visible">
      <div className="header-inner container-row">
        <h1
          className="brand"
          onClick={onHome}
          style={{ cursor: "pointer" }}
          aria-label="LisaTrendz home"
        >
          <img src={logoSrc} alt="LisaTrendz" />
        </h1>
        <nav className="nav">
          <button className="btn track-btn" onClick={onTrack}>
            <span className="track-full">Track Order</span>
            <span className="track-short">Track</span>
          </button>
          <button
            className="saved-btn"
            type="button"
            onClick={onSaved}
            aria-label="Open saved products"
          >
            <span className="saved-full">Saved</span>
            <span className="saved-short">Save</span>
            <span className="saved-count">{savedCount}</span>
          </button>
          <button className="cart-btn" onClick={onCart} aria-label="Open cart">
            Cart <span className="cart-count">{cartCount}</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
