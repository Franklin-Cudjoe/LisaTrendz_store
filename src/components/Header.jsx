import React from "react";
import "../styles/header.css";
import logoSrc from "../assets/logo.png";

export default function Header({
  cartCount,
  onCart,
  onHome,
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
          aria-label="Lizzy home"
        >
          <img src={logoSrc} alt="Lizzy" />
          <span className="brand-word">Lizzy</span>
        </h1>
        <nav className="nav">
          <button className="btn track-btn" onClick={onTrack}>
            <span className="track-full">Track Order</span>
            <span className="track-short">Track</span>
          </button>
          <button className="cart-btn" onClick={onCart} aria-label="Open cart">
            Cart <span className="cart-count">{cartCount}</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
