const LOW_STOCK_THRESHOLD = 3;

function cleanStockValue(value) {
  if (value === "" || value == null) return null;

  const stock = Number(value);

  if (!Number.isFinite(stock)) return null;

  return Math.max(0, Math.floor(stock));
}

export function getProductStock(product = {}) {
  return cleanStockValue(
    product.stock ?? product.quantity ?? product.inventory ?? product.stockCount,
  );
}

export function getProductStockStatus(product = {}) {
  const stock = getProductStock(product);

  if (stock != null) {
    if (stock <= 0) {
      return { key: "sold-out", label: "Sold out", stock, available: false };
    }

    if (stock <= LOW_STOCK_THRESHOLD) {
      return {
        key: "low-stock",
        label: `Only ${stock} left`,
        stock,
        available: true,
      };
    }

    return { key: "in-stock", label: "In stock", stock, available: true };
  }

  const status = String(product.stockStatus || product.availability || "")
    .trim()
    .toLowerCase();

  if (
    product.available === false ||
    product.inStock === false ||
    status.includes("sold") ||
    status.includes("out")
  ) {
    return { key: "sold-out", label: "Sold out", stock: 0, available: false };
  }

  if (status.includes("low")) {
    return {
      key: "low-stock",
      label: "Low stock",
      stock: null,
      available: true,
    };
  }

  return { key: "in-stock", label: "In stock", stock: null, available: true };
}

export function normalizeProductStock(product = {}) {
  const stock = getProductStock(product);

  return {
    ...product,
    stock,
  };
}
