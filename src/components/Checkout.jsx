import React from "react";
import "../styles/checkout.css";

export default function Checkout({ items, delivery, onBack, onPay }) {
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = delivery ? delivery.cost || 0 : 0;
  const total = subtotal + shipping;

  return (
    <div className="checkout container">
      <button className="back" onClick={onBack}>
        ← Back to cart
      </button>
      <h2>Checkout</h2>
      <div className="checkout-grid">
        <div className="checkout-form">
          <label>Cardholder name</label>
          <input placeholder="Jane Doe" />
          <label>Card number</label>
          <input placeholder="4242 4242 4242 4242" />
          <div className="row">
            <div>
              <label>Expiry</label>
              <input placeholder="MM/YY" />
            </div>
            <div>
              <label>CVC</label>
              <input placeholder="123" />
            </div>
          </div>
          <div className="note">
            This is a mock payment UI. To accept real payments, integrate a
            payments backend (Stripe/PayPal).
          </div>
          <div style={{ marginTop: 12 }}>
            <div
              className="note delivery-summary"
              style={{ display: "flex", alignItems: "center", gap: 8 }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 32,
                  height: 32,
                }}
              >
                {delivery && delivery.type === "pickup" ? (
                  <svg
                    width="20"
                    height="20"
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
                ) : delivery &&
                  delivery.type === "ship" &&
                  delivery.method === "within" ? (
                  <svg
                    width="20"
                    height="20"
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
                ) : (
                  <svg
                    width="20"
                    height="20"
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
                )}
              </span>
              <span>
                {delivery
                  ? delivery.type === "pickup"
                    ? "Pick-up — Free"
                    : delivery.method === "within"
                      ? "Ship — Within Accra"
                      : "Ship — Outside Accra"
                  : "Shipping"}
              </span>
              <strong style={{ marginLeft: 8 }}>₵{shipping.toFixed(2)}</strong>
            </div>
            <button className="btn" onClick={() => onPay()}>
              Pay ₵{total.toFixed(2)}
            </button>
          </div>
        </div>

        <aside className="checkout-summary">
          <h3>Order summary</h3>
          {items.map((i) => (
            <div key={i.id} className="summary-item">
              <div>
                {i.name} × {i.qty}
              </div>
              <div>₵{(i.price * i.qty).toFixed(2)}</div>
            </div>
          ))}
          <div className="summary-item">
            <div>Subtotal</div>
            <div>₵{subtotal.toFixed(2)}</div>
          </div>
          <div className="summary-item">
            <div>Shipping</div>
            <div>₵{shipping.toFixed(2)}</div>
          </div>
          <div className="summary-total">
            Total: <strong>₵{total.toFixed(2)}</strong>
          </div>
        </aside>
      </div>
    </div>
  );
}
