const DEFAULT_COLOR_VALUE = "#20232a";

const NAMED_COLOR_VALUES = {
  black: "#20232a",
  white: "#f7f5ef",
  ivory: "#fff8e7",
  cream: "#f5ead6",
  beige: "#d7c3a3",
  brown: "#7a4f36",
  red: "#b91c1c",
  burgundy: "#7f1d1d",
  pink: "#f4a7b9",
  blush: "#f8c7cc",
  orange: "#f97316",
  yellow: "#facc15",
  green: "#15803d",
  emerald: "#047857",
  teal: "#0f766e",
  blue: "#2563eb",
  navy: "#1e3a8a",
  purple: "#7c3aed",
  lavender: "#c4b5fd",
  grey: "#6b7280",
  gray: "#6b7280",
  silver: "#c0c0c0",
  gold: "#c6a15b",
};

function cleanText(value, maxLength = 44) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanColorValue(value) {
  const color = cleanText(value, 24);
  return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : "";
}

function valueFromName(name) {
  const key = cleanText(name).toLowerCase();
  return NAMED_COLOR_VALUES[key] || DEFAULT_COLOR_VALUE;
}

export function normalizeColorOption(input, index = 0) {
  let name = "";
  let value = "";

  if (typeof input === "string") {
    const text = cleanText(input);
    value = cleanColorValue(text);
    name = value ? `Color ${index + 1}` : text;
  } else if (input && typeof input === "object") {
    name = cleanText(input.name || input.label || input.title);
    value = cleanColorValue(input.value || input.hex || input.color);
  }

  if (!name && value) {
    name = `Color ${index + 1}`;
  }

  if (!name) return null;

  return {
    name,
    value: value || valueFromName(name),
  };
}

export function getProductColors(product = {}) {
  const rawColors =
    product.colors || product.colours || product.availableColors || [];
  const input = Array.isArray(rawColors)
    ? rawColors
    : typeof rawColors === "string"
      ? rawColors.split(",")
      : [];
  const seen = new Set();

  return input.reduce((list, color, index) => {
    const normalized = normalizeColorOption(color, index);

    if (!normalized) return list;

    const key = `${normalized.name.toLowerCase()}|${normalized.value}`;
    if (seen.has(key)) return list;

    seen.add(key);
    return [...list, normalized];
  }, []);
}

export function normalizeProductColors(product = {}) {
  return {
    ...product,
    colors: getProductColors(product),
  };
}

export function colorOptionKey(color, index = 0) {
  return `${color?.name || "color"}-${color?.value || index}-${index}`;
}
