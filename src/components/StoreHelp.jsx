import React from "react";
import "../styles/product.css";

const HELP_ITEMS = [
  {
    title: "Delivery",
    text: "Pick-up is free. Accra delivery is GHS 50, and delivery outside Accra is GHS 100.",
  },
  {
    title: "Returns",
    text: "Items can be returned within 30 days when they are unworn, unwashed, and still in good condition.",
  },
  {
    title: "Sizing",
    text: "Product pages include fit notes and colour options. For close-fitting pieces, choose your usual size for a shaped fit or size up for comfort.",
  },
  {
    title: "Payments",
    text: "Secure card and mobile money payments are handled through Paystack. Your order code is sent by SMS after Paystack verifies payment.",
  },
];

export default function StoreHelp() {
  return (
    <section className="store-help container" aria-labelledby="store-help-title">
      <div className="store-help-heading">
        <div>
          <span className="eyebrow">Need To Know</span>
          <h2 id="store-help-title">Shopping help</h2>
        </div>
        <p>Clear delivery, returns, sizing, and payment details before checkout.</p>
      </div>

      <div className="help-grid">
        {HELP_ITEMS.map((item) => (
          <details className="help-card" key={item.title}>
            <summary>{item.title}</summary>
            <p>{item.text}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
