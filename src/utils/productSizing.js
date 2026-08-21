export const DEFAULT_SIZE_OPTIONS = ["XS", "S", "M", "L", "XL"];

export const SIZE_GUIDE_ROWS = [
  { size: "XS", bust: "30-32", waist: "24-26", hip: "34-36" },
  { size: "S", bust: "33-35", waist: "27-29", hip: "37-39" },
  { size: "M", bust: "36-38", waist: "30-32", hip: "40-42" },
  { size: "L", bust: "39-41", waist: "33-35", hip: "43-45" },
  { size: "XL", bust: "42-45", waist: "36-39", hip: "46-49" },
];

function cleanSize(value) {
  return String(value || "").trim().toUpperCase();
}

export function getProductSizes(product = {}) {
  const rawSizes =
    product.sizes || product.sizeOptions || product.availableSizes || [];
  const sizes = Array.isArray(rawSizes)
    ? rawSizes.map(cleanSize).filter(Boolean)
    : String(rawSizes || "")
        .split(",")
        .map(cleanSize)
        .filter(Boolean);
  const uniqueSizes = [...new Set(sizes)];

  return uniqueSizes.length > 0 ? uniqueSizes : DEFAULT_SIZE_OPTIONS;
}

export function normalizeProductSizes(product = {}) {
  return {
    ...product,
    sizes: getProductSizes(product),
  };
}

export function getProductFitNote(product = {}) {
  const category = String(product.category || "").toLowerCase();

  if (category.includes("legging") || category.includes("seamless")) {
    return "Stretch fit. Choose your usual size for support, or size up for a softer everyday fit.";
  }

  if (category.includes("dress") || category.includes("romper")) {
    return "Shaped through the body. If you are between sizes, choose the larger size.";
  }

  if (category.includes("short")) {
    return "Easy fit through the hip. Choose your usual size for a relaxed feel.";
  }

  return "True to size. Choose your usual size, or size up for a relaxed fit.";
}
