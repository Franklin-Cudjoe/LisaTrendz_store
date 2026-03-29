import React from "react";

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="container-row">
        <small>© {new Date().getFullYear()} Lizzy — All rights reserved</small>
      </div>
    </footer>
  );
}
