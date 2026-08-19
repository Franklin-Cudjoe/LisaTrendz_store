import React, { useEffect, useRef, useState } from "react";
import "../styles/header.css";
import logoSrc from "../assets/logo.png";

export default function Header({
  cartCount,
  onCart,
  onHome,
  onAdmin,
  onTrack,
}) {
  const [visible, setVisible] = useState(true);
  const hideRef = useRef();

  useEffect(() => {
    // show header at top on mount
    try {
      if (window && (window.scrollY || window.pageYOffset) === 0)
        setVisible(true);
    } catch (e) {}
    function handleScroll() {
      const y =
        window.scrollY ||
        window.pageYOffset ||
        document.documentElement.scrollTop;
      if (y === 0) {
        // always show when at very top
        setVisible(true);
        if (hideRef.current) {
          clearTimeout(hideRef.current);
          hideRef.current = null;
        }
        return;
      }
      setVisible(true);
      if (hideRef.current) clearTimeout(hideRef.current);
      hideRef.current = setTimeout(() => setVisible(false), 700);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (hideRef.current) clearTimeout(hideRef.current);
    };
  }, []);

  return (
    <header className={"site-header" + (visible ? " visible" : "")}>
      {/* toggles on scroll */}
      <div className="header-inner container-row">
        <h1 className="brand" onClick={onHome} style={{ cursor: "pointer" }}>
          <img src={logoSrc} alt="Lizzy" />
        </h1>
        <nav className="nav">
          <button className="btn" onClick={onTrack}>
            Track Order
          </button>
          <button className="cart-btn" onClick={onCart} aria-label="Open cart">
            Cart <span className="cart-count">{cartCount}</span>
          </button>
        </nav>
      </div>
    </header>
  );
}
