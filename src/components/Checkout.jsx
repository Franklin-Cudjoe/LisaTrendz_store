import React, { useMemo, useState } from "react";
import "../styles/checkout.css";
import { calculateOrderTotals, formatMoney } from "../utils/promotions.js";

function deliveryLabel(delivery) {
  if (!delivery) return "Delivery";
  if (delivery.type === "pickup") return "Pick-up";
  if (delivery.method === "within") return "Delivery within Accra";
  if (delivery.method === "outside") return "Delivery outside Accra";

  return "Delivery";
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

export default function Checkout({
  items,
  delivery,
  promotion,
  onBack,
  onPay,
}) {
  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const totals = calculateOrderTotals(items, delivery, promotion);
  const subtotal = totals.subtotal;
  const shipping = totals.shipping;
  const total = totals.total;
  const totalDiscount = totals.discount.totalDiscount;
  const canPay = useMemo(
    () => items.length > 0 && isValidEmail(customer.email) && !isSubmitting,
    [customer.email, isSubmitting, items.length],
  );

  function updateCustomer(field, value) {
    setCustomer((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setPaymentError("");

    if (!items.length) {
      setPaymentError("Your cart is empty.");
      return;
    }

    if (!isValidEmail(customer.email)) {
      setPaymentError("Enter a valid email address for your receipt.");
      return;
    }

    setIsSubmitting(true);

    try {
      await onPay({
        name: customer.name.trim(),
        email: customer.email.trim(),
        phone: customer.phone.trim(),
      });
    } catch (e) {
      setPaymentError(
        e.message ||
          "Paystack could not be started. Check your payment settings.",
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="checkout container">
      <button className="back" onClick={onBack} type="button">
        Back to cart
      </button>
      <h2>Checkout</h2>
      <div className="checkout-grid">
        <form className="checkout-form" onSubmit={handleSubmit}>
          <div className="checkout-section-heading">
            <span>Pay Securely</span>
            <h3>Pay with Paystack</h3>
          </div>

          <label htmlFor="checkout-name">Full name</label>
          <input
            id="checkout-name"
            value={customer.name}
            onChange={(event) => updateCustomer("name", event.target.value)}
            placeholder="Lisa Trendz Customer"
            autoComplete="name"
          />

          <label htmlFor="checkout-email">Email for receipt</label>
          <input
            id="checkout-email"
            value={customer.email}
            onChange={(event) => updateCustomer("email", event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            required
          />

          <label htmlFor="checkout-phone">Phone number</label>
          <input
            id="checkout-phone"
            value={customer.phone}
            onChange={(event) => updateCustomer("phone", event.target.value)}
            placeholder="+233..."
            autoComplete="tel"
            inputMode="tel"
          />

          <div className="paystack-method-grid" aria-label="Payment methods">
            <div>
              <span>VISA / Card</span>
              <strong>Debit and credit cards</strong>
            </div>
            <div>
              <span>Mobile Money</span>
              <strong>MTN, Telecel, AirtelTigo</strong>
            </div>
          </div>

          <div className="note">
            Card and mobile-money details are entered on Paystack's secure
            payment page.
          </div>

          <div className="note delivery-summary">
            <span>{deliveryLabel(delivery)}</span>
            <strong>{formatMoney(shipping)}</strong>
          </div>

          {paymentError && <div className="checkout-error">{paymentError}</div>}

          <button className="btn" type="submit" disabled={!canPay}>
            {isSubmitting
              ? "Opening Paystack..."
              : `Continue to Paystack (${formatMoney(total)})`}
          </button>
        </form>

        <aside className="checkout-summary">
          <h3>Order summary</h3>
          {items.map((item) => (
            <div key={item.cartKey || item.id} className="summary-item">
              <div>
                {item.selectedColor && (
                  <span className="summary-color">
                    Colour {item.selectedColor.name}
                  </span>
                )}
                {item.selectedSize && (
                  <span className="summary-color">Size {item.selectedSize}</span>
                )}
                {item.name} x {item.qty}
              </div>
              <div>{formatMoney(item.price * item.qty)}</div>
            </div>
          ))}
          <div className="summary-item">
            <div>Subtotal</div>
            <div>{formatMoney(subtotal)}</div>
          </div>
          <div className="summary-item">
            <div>Shipping</div>
            <div>{formatMoney(shipping)}</div>
          </div>
          {promotion && (
            <div className="summary-item discount">
              <div>Promo ({promotion.code})</div>
              <div>
                {totalDiscount > 0 ? `-${formatMoney(totalDiscount)}` : "Applied"}
              </div>
            </div>
          )}
          <div className="summary-total">
            Total: <strong>{formatMoney(total)}</strong>
          </div>
        </aside>
      </div>
    </div>
  );
}
