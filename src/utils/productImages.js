export function getProductImages(product = {}) {
  const front =
    product.imageFront ||
    product.frontImage ||
    product.images?.front ||
    product.images?.[0] ||
    product.image ||
    "";
  const back =
    product.imageBack ||
    product.backImage ||
    product.images?.back ||
    product.images?.[1] ||
    "";

  return {
    front,
    back: back && back !== front ? back : "",
    hasBack: Boolean(back && back !== front),
  };
}

export function normalizeProductImages(product = {}) {
  const { front, back } = getProductImages(product);

  return {
    ...product,
    image: front,
    imageFront: front,
    imageBack: back,
  };
}
