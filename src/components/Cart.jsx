import React, { useEffect, useState } from "react";
import "../styles/cart.css";
import {
  calculateOrderTotals,
  formatMoney,
  validatePromoCode,
} from "../utils/promotions.js";
import { colorOptionKey, getProductColors } from "../utils/productColors.js";
import { getProductSizes } from "../utils/productSizing.js";
import { getProductStock } from "../utils/productStock.js";

export default function Cart({
  items,
  onRemove,
  onQuantityChange,
  onBack,
  onCheckout,
  drawer,
  onClose,
  promotion,
  onPromotionChange,
  onVariantChange,
}) {
  const [showDelivery, setShowDelivery] = useState(false);
  const [delivery, setDelivery] = useState({ type: "pickup", cost: 0 });
  const [promoInput, setPromoInput] = useState(promotion?.code || "");
  const [promoMessage, setPromoMessage] = useState("");

  const totals = calculateOrderTotals(items, delivery, promotion);
  const subtotal = totals.subtotal;
  const totalDiscount = totals.discount.totalDiscount;

  useEffect(() => {
    setPromoInput(promotion?.code || "");
  }, [promotion?.code]);

  function handleApplyPromo(event) {
    event.preventDefault();

    const result = validatePromoCode(promoInput, subtotal);
    setPromoMessage(result.message);

    if (result.ok && onPromotionChange) {
      onPromotionChange(result.promo);
    }
  }

  function clearPromo() {
    if (onPromotionChange) onPromotionChange(null);
    setPromoInput("");
    setPromoMessage("");
  }

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
          {items.map((i) => {
            const cartKey = i.cartKey || i.id;
            const qty = Math.max(1, Number(i.qty || 1));
            const stock = getProductStock(i);
            const maxQty = stock == null ? undefined : Math.max(1, stock);
            const canIncrease = maxQty == null || qty < maxQty;
            const colors = getProductColors(i);
            const sizes = getProductSizes(i);

            return (
              <div className="cart-item" key={cartKey}>
              <img src={i.image} alt={i.name} />
              <div className="meta">
                <h3>{i.name}</h3>
                {colors.length > 0 && (
                  <div className="cart-option-row">
                    <span>Colour</span>
                    <div className="cart-color-options">
                      {colors.map((color, index) => {
                        const active =
                          i.selectedColor &&
                          i.selectedColor.name === color.name &&
                          i.selectedColor.value === color.value;

                        return (
                          <button
                            key={colorOptionKey(color, index)}
                            className={active ? "active" : ""}
                            type="button"
                            onClick={() =>
                              onVariantChange?.(cartKey, {
                                selectedColor: color,
                              })
                            }
                            aria-pressed={active}
                            aria-label={`Choose ${color.name} for ${i.name}`}
                            title={color.name}
                          >
                            <i
                              style={{ backgroundColor: color.value }}
                              aria-hidden="true"
                            />
                            {color.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {sizes.length > 0 && (
                  <div className="cart-option-row">
                    <span>Size</span>
                    <div className="cart-size-options">
                      {sizes.map((size) => (
                        <button
                          key={size}
                          className={i.selectedSize === size ? "active" : ""}
                          type="button"
                          onClick={() =>
                            onVariantChange?.(cartKey, {
                              selectedSize: size,
                            })
                          }
                          aria-pressed={i.selectedSize === size}
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="cart-quantity-row">
                  <span>Qty</span>
                  <div className="cart-quantity-control">
                    <button
                      type="button"
                      onClick={() => onQuantityChange?.(cartKey, qty - 1)}
                      disabled={qty <= 1}
                      aria-label={`Decrease ${i.name} quantity`}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={maxQty}
                      value={qty}
                      onChange={(event) =>
                        onQuantityChange?.(cartKey, event.target.value)
                      }
                      aria-label={`${i.name} quantity`}
                    />
                    <button
                      type="button"
                      onClick={() => onQuantityChange?.(cartKey, qty + 1)}
                      disabled={!canIncrease}
                      aria-label={`Increase ${i.name} quantity`}
                    >
                      +
                    </button>
                  </div>
                </div>
                {maxQty != null && (
                  <p className="cart-stock-note">Available: {maxQty}</p>
                )}
                <p className="cart-line-price">{formatMoney(i.price * qty)}</p>
                <button
                  className="btn tiny"
                  onClick={() => onRemove(cartKey)}
                >
                  Remove
                </button>
              </div>
            </div>
            );
          })}

          <div className="cart-total">
            <div>
              <span>Subtotal</span>
              <strong>{formatMoney(subtotal)}</strong>
            </div>
            {promotion && (
              <div>
                <span>Promo ({promotion.code})</span>
                <strong>
                  {totalDiscount > 0 ? `-${formatMoney(totalDiscount)}` : "Applied"}
                </strong>
              </div>
            )}
            {showDelivery && (
              <div>
                <span>Delivery</span>
                <strong>{formatMoney(totals.shipping)}</strong>
              </div>
            )}
            <div className="cart-total-final">
              <span>Total</span>
              <strong>{formatMoney(totals.total)}</strong>
            </div>
          </div>

          <form className="promo-panel" onSubmit={handleApplyPromo}>
            <label htmlFor="promo-code">Promo code</label>
            <div className="promo-entry">
              <input
                id="promo-code"
                value={promoInput}
                onChange={(event) => setPromoInput(event.target.value)}
                placeholder="LISA10"
              />
              <button className="btn secondary tiny" type="submit">
                Apply
              </button>
            </div>
            <div className="promo-foot">
              <span>{promoMessage}</span>
              {promotion && (
                <button type="button" onClick={clearPromo}>
                  Remove
                </button>
              )}
            </div>
          </form>

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
                ? `Continue to payment (${formatMoney(totals.total)})`
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
