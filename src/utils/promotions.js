// export const PROMO_CODES = [
//   {
//     code: "LISA10",
//     label: "10% off",
//     description: "10% off your product subtotal.",
//     type: "percent",
//     value: 10,
//     minSubtotal: 0,
//   },
//   {
//     code: "TREND20",
//     label: "GHS 20 off",
//     description: "GHS 20 off orders from GHS 150.",
//     type: "amount",
//     value: 20,
//     minSubtotal: 150,
//   },
//   {
//     code: "FREESHIP",
//     label: "Free delivery",
//     description: "Delivery fee removed at checkout.",
//     type: "shipping",
//     value: 0,
//     minSubtotal: 0,
//   },
// ];

export function formatMoney(value) {
  return `GHS ${Number(value || 0).toFixed(2)}`;
}

export function normalizePromoCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

export function findPromoCode(value) {
  const code = normalizePromoCode(value);

  return PROMO_CODES.find((promo) => promo.code === code) || null;
}

export function getCartSubtotal(items = []) {
  return items.reduce(
    (total, item) =>
      total + Number(item.price || 0) * Number(item.qty || item.quantity || 1),
    0,
  );
}

export function validatePromoCode(value, subtotal = 0) {
  const code = normalizePromoCode(value);
  const promo = findPromoCode(code);

  if (!code) {
    return { ok: false, promo: null, message: "Enter a promo code." };
  }

  if (!promo) {
    return { ok: false, promo: null, message: "Promo code not found." };
  }

  if (Number(subtotal || 0) < Number(promo.minSubtotal || 0)) {
    return {
      ok: false,
      promo: null,
      message: `${promo.code} applies from ${formatMoney(promo.minSubtotal)}.`,
    };
  }

  return { ok: true, promo, message: `${promo.code} applied.` };
}

export function calculatePromoDiscount(promo, subtotal = 0, shipping = 0) {
  if (!promo || Number(subtotal || 0) < Number(promo.minSubtotal || 0)) {
    return { subtotalDiscount: 0, shippingDiscount: 0, totalDiscount: 0 };
  }

  let subtotalDiscount = 0;
  let shippingDiscount = 0;

  if (promo.type === "percent") {
    subtotalDiscount = Number(subtotal || 0) * (Number(promo.value || 0) / 100);
  } else if (promo.type === "amount") {
    subtotalDiscount = Number(promo.value || 0);
  } else if (promo.type === "shipping") {
    shippingDiscount = Number(shipping || 0);
  }

  subtotalDiscount = Math.min(Number(subtotal || 0), Math.max(0, subtotalDiscount));
  shippingDiscount = Math.min(Number(shipping || 0), Math.max(0, shippingDiscount));

  return {
    subtotalDiscount,
    shippingDiscount,
    totalDiscount: subtotalDiscount + shippingDiscount,
  };
}

export function calculateOrderTotals(items = [], delivery = null, promo = null) {
  const subtotal = getCartSubtotal(items);
  const shipping = delivery ? Number(delivery.cost || 0) : 0;
  const discount = calculatePromoDiscount(promo, subtotal, shipping);
  const total = Math.max(
    0,
    subtotal + shipping - Number(discount.totalDiscount || 0),
  );

  return {
    subtotal,
    shipping,
    discount,
    total,
    promo:
      promo && Number(discount.totalDiscount || 0) > 0
        ? { code: promo.code, label: promo.label }
        : promo || null,
  };
}
