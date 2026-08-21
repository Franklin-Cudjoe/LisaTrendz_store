import React from "react";
import "../styles/hero.css";
import heroImage from "../assets/lizzy-editorial-hero-mobile.jpg";

export default function Hero({ onShop, onExplore }) {
  return (
    <header
      className="hero-spot"
      role="banner"
      aria-label="Shop hero"
      style={{ "--hero-bg": `url(${heroImage})` }}
    >
      <img className="hero-image-layer" src={heroImage} alt="" aria-hidden />
      <div className="container hero-inner">
        <div className="hero-left">
          <span className="hero-kicker">LisaTrendz</span>
          <h2>Everyday pieces with storefront energy.</h2>
          <p className="lead">
            Fresh fits, bold colour, and easy pieces curated for everyday style.
          </p>
          <div className="hero-actions">
            <button className="btn" onClick={onShop}>
              Shop New
            </button>
            <button
              className="btn secondary hero-secondary"
              onClick={onExplore}
            >
              Explore Collections
            </button>
          </div>
          {/* <div className="hero-proof" aria-label="Store promises">
            <span>
              <strong>4.9</strong> Fit confidence
            </span>
            <span>
              <strong>30d</strong> Easy returns
            </span>
            <span>
              <strong>48h</strong> Dispatch window
            </span>
          </div> */}
        </div>
      </div>
    </header>
  );
}
