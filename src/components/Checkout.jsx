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

function isValidPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");

  return digits.length >= 9 && digits.length <= 15;
}

function isValidName(value) {
  return String(value || "").trim().length >= 2;
}

export default function Checkout({
  items,
  delivery,
  promotion,
  onBack,
  onPay,
  onDevPay,
}) {
  const [customer, setCustomer] = useState({
    name: "",
    email: "",
    phone: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDevSubmitting, setIsDevSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const totals = calculateOrderTotals(items, delivery, promotion);
  const subtotal = totals.subtotal;
  const shipping = totals.shipping;
  const total = totals.total;
  const totalDiscount = totals.discount.totalDiscount;
  const canPay = useMemo(
    () =>
      items.length > 0 &&
      isValidName(customer.name) &&
      isValidEmail(customer.email) &&
      isValidPhone(customer.phone) &&
      !isSubmitting &&
      !isDevSubmitting,
    [
      customer.email,
      customer.name,
      customer.phone,
      isDevSubmitting,
      isSubmitting,
      items.length,
    ],
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

    if (!isValidName(customer.name)) {
      setPaymentError("Enter the full name for this order.");
      return;
    }

    if (!isValidEmail(customer.email)) {
      setPaymentError("Enter a valid email address for your receipt.");
      return;
    }

    if (!isValidPhone(customer.phone)) {
      setPaymentError("Enter the mobile number that should receive the order code.");
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

  async function handleDevSubmit() {
    setPaymentError("");

    if (!items.length) {
      setPaymentError("Your cart is empty.");
      return;
    }

    if (!isValidName(customer.name)) {
      setPaymentError("Enter the full name for this order.");
      return;
    }

    if (!isValidEmail(customer.email)) {
      setPaymentError("Enter a valid email address for your receipt.");
      return;
    }

    if (!isValidPhone(customer.phone)) {
      setPaymentError("Enter the mobile number that should receive the order code.");
      return;
    }

    setIsDevSubmitting(true);

    try {
      await onDevPay({
        name: customer.name.trim(),
        email: customer.email.trim(),
        phone: customer.phone.trim(),
      });
    } catch (e) {
      setPaymentError(
        e.message ||
          "The SMS test could not run. Check your Arkesel settings.",
      );
      setIsDevSubmitting(false);
    }
  }

  return (
    <div className="checkout container">
      <button className="back" onClick={onBack} type="button">
        Back to cart
      </button>
      <h2>Receipt info</h2>
      <div className="checkout-grid">
        <form className="checkout-form" onSubmit={handleSubmit}>
          <div className="checkout-section-heading">
            <p>An Order code will be sent to you, using the information provided below. You can use this unique code to track your order later.</p>
          </div>

          <label htmlFor="checkout-name">Full name</label>
          <input
            id="checkout-name"
            value={customer.name}
            onChange={(event) => updateCustomer("name", event.target.value)}
            placeholder="Franklin Cudjoe"
            autoComplete="name"
            required
          />

          <label htmlFor="checkout-email">Email</label>
          <input
            id="checkout-email"
            value={customer.email}
            onChange={(event) => updateCustomer("email", event.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            inputMode="email"
            required
          />

          <label htmlFor="checkout-phone">Mobile number for order code</label>
          <input
            id="checkout-phone"
            value={customer.phone}
            onChange={(event) => updateCustomer("phone", event.target.value)}
            placeholder="+233 55 000 0000"
            autoComplete="tel"
            inputMode="tel"
            required
          />

          <div className="checkout-handoff">
            <div>
              <strong>Secure Paystack payment</strong>
            </div>
            <p>Card and mobile-money details are entered on Paystack.</p>
          </div>

          

          {paymentError && <div className="checkout-error">{paymentError}</div>}

          <button className="btn" type="submit" disabled={!canPay}>
            {isSubmitting
              ? "Opening Paystack..."
              : `Pay ${formatMoney(total)} with Paystack`}
          </button>
          {onDevPay && (
            <button
              className="btn secondary"
              type="button"
              disabled={!canPay}
              onClick={handleDevSubmit}
            >
              {isDevSubmitting ? "Sending test SMS..." : "Send test SMS instead"}
            </button>
          )}
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
            <span>{deliveryLabel(delivery)}</span>
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
