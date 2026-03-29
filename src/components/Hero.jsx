import React from "react";
import "../styles/hero.css";

export default function Hero() {
  return (
    <header className="hero-spot" role="banner" aria-label="Shop hero">
      <div className="container hero-inner">
        <div className="hero-left">
          <h2>Effortless Style, Everyday Comfort</h2>
          <p className="lead">
            Curated clothing collections that move with you — discover the
            season's essentials.
          </p>
          <div className="hero-actions">
            <button className="btn">Shop New</button>
            <button className="btn secondary">Explore Collections</button>
          </div>
        </div>
        <div className="hero-media" aria-hidden="true" />
      </div>
    </header>
  );
}
