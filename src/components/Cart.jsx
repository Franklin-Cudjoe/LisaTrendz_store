import React, { useState } from "react";
import "../styles/cart.css";

export default function Cart({
  items,
  onRemove,
  onBack,
  onCheckout,
  drawer,
  onClose,
}) {
  const [showDelivery, setShowDelivery] = useState(false);
  const [delivery, setDelivery] = useState({ type: "pickup", cost: 0 });

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);

  function handleProceed() {
    if (!showDelivery) {
      setShowDelivery(true);
      return;
    }
    // call onCheckout with delivery info
    onCheckout && onCheckout(delivery);
  }

  const content = (
    <div className="cart-content">
      <button className="back" onClick={onBack}>
        ← Continue shopping
      </button>
      <h2>Your Cart</h2>
      {items.length === 0 ? (
        <p>Your cart is empty.</p>
      ) : (
        <div className="cart-list">
          {items.map((i) => (
            <div className="cart-item" key={i.cartKey || i.id}>
              <img src={i.image} alt={i.name} />
              <div className="meta">
                <h3>{i.name}</h3>
                {i.selectedColor && (
                  <p className="cart-color">
                    <span
                      style={{ backgroundColor: i.selectedColor.value }}
                      aria-hidden="true"
                    />
                    Color: {i.selectedColor.name}
                  </p>
                )}
                <p>Qty: {i.qty}</p>
                <p>₵{(i.price * i.qty).toFixed(2)}</p>
                <button
                  className="btn tiny"
                  onClick={() => onRemove(i.cartKey || i.id)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}

          <div className="cart-total">
            Subtotal: <strong>₵{subtotal.toFixed(2)}</strong>
          </div>

          {showDelivery && (
            <div className="delivery-panel">
              <h4>Delivery options</h4>
              <div className="delivery-options">
                <label
                  className={`delivery-card ${delivery.type === "pickup" ? "selected" : ""}`}
                  onClick={() => setDelivery({ type: "pickup", cost: 0 })}
                >
                  <input
                    type="radio"
                    name="delivery"
                    checked={delivery.type === "pickup"}
                    onChange={() => setDelivery({ type: "pickup", cost: 0 })}
                  />
                  <div className="delivery-icon" aria-hidden>
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M3 11h18v7a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-7z"
                        stroke="#20232a"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M7 11V6a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v5"
                        stroke="#20232a"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="delivery-info">
                    <div className="title">Pick-up</div>
                    <div className="desc">Collect from our store</div>
                  </div>
                  <div className="price">Free</div>
                </label>

                <label
                  className={`delivery-card ${delivery.type === "ship" && delivery.method === "within" ? "selected" : ""}`}
                  onClick={() =>
                    setDelivery({ type: "ship", method: "within", cost: 50 })
                  }
                >
                  <input
                    type="radio"
                    name="delivery"
                    checked={
                      delivery.type === "ship" && delivery.method === "within"
                    }
                    onChange={() =>
                      setDelivery({ type: "ship", method: "within", cost: 50 })
                    }
                  />
                  <div className="delivery-icon" aria-hidden>
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M3 7h13l4 4v6a1 1 0 0 1-1 1h-1"
                        stroke="#0f766e"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle cx="7" cy="18" r="1" fill="#0f766e" />
                      <circle cx="18" cy="18" r="1" fill="#0f766e" />
                    </svg>
                  </div>
                  <div className="delivery-info">
                    <div className="title">Delivery — Within Accra</div>
                    <div className="desc">Fast local delivery</div>
                  </div>
                  <div className="price">₵50</div>
                </label>

                <label
                  className={`delivery-card ${delivery.type === "ship" && delivery.method === "outside" ? "selected" : ""}`}
                  onClick={() =>
                    setDelivery({ type: "ship", method: "outside", cost: 100 })
                  }
                >
                  <input
                    type="radio"
                    name="delivery"
                    checked={
                      delivery.type === "ship" && delivery.method === "outside"
                    }
                    onChange={() =>
                      setDelivery({
                        type: "ship",
                        method: "outside",
                        cost: 100,
                      })
                    }
                  />
                  <div className="delivery-icon" aria-hidden>
                    <svg
                      width="28"
                      height="28"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M2 12c4 0 7-4 10-4s6 4 10 4"
                        stroke="#6d706b"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 2v4"
                        stroke="#6d706b"
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </div>
                  <div className="delivery-info">
                    <div className="title">Delivery — Outside Accra</div>
                    <div className="desc">Nationwide shipping</div>
                  </div>
                  <div className="price">₵100</div>
                </label>
              </div>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <button className="btn" onClick={handleProceed}>
              {showDelivery
                ? `Continue to payment (₵${(subtotal + (delivery.cost || 0)).toFixed(2)})`
                : "Proceed to checkout"}
            </button>
            {showDelivery && (
              <button
                className="btn secondary"
                style={{ marginLeft: 8 }}
                onClick={() => setShowDelivery(false)}
              >
                Change
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (drawer) {
    return (
      <div>
        <div className="cart-overlay" onClick={onClose} />
        <aside className="cart-drawer">
          <div className="cart-drawer-inner">
            <button className="cart-close" onClick={onClose} aria-label="Close">
              ×
            </button>
            {content}
          </div>
        </aside>
      </div>
    );
  }

  return <div className="cart-page">{content}</div>;
}
