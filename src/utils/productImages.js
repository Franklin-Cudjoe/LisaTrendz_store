function cleanImageUrl(value) {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    return String(value.url || value.src || value.image || "").trim();
  }

  return "";
}

function appendImage(list, value) {
  const url = cleanImageUrl(value);

  if (!url || list.includes(url)) return list;

  return [...list, url];
}

export function getProductImages(product = {}) {
  let images = [];
  const rawImages = product.images;

  if (Array.isArray(rawImages)) {
    rawImages.forEach((image) => {
      images = appendImage(images, image);
    });
  } else if (rawImages && typeof rawImages === "object") {
    images = appendImage(images, rawImages.front);
    images = appendImage(images, rawImages.back);
    images = appendImage(images, rawImages.main);
  }

  [
    product.imageFront,
    product.frontImage,
    product.image,
    product.imageBack,
    product.backImage,
  ].forEach((image) => {
    images = appendImage(images, image);
  });

  const front = images[0] || "";
  const back = images[1] || "";

  return {
    front,
    back,
    list: images,
    images,
    hasBack: images.length > 1,
    count: images.length,
  };
}

export function normalizeProductImages(product = {}) {
  const { front, back, list } = getProductImages(product);

  return {
    ...product,
    image: front,
    imageFront: front,
    imageBack: back,
    images: list,
  };
}
