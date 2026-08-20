const products = [
  {
    id: "p1",
    name: "Everyday Tee",
    price: 24.99,
    image: "/src/assets/everyday-tee.svg",
    category: "Tops",
    colors: [
      { name: "White", value: "#f7f5ef" },
      { name: "Black", value: "#20232a" },
      { name: "Blush", value: "#f8c7cc" },
    ],
    description: "Soft, breathable cotton tee — perfect for daily wear.",
  },
  {
    id: "p2",
    name: "Chic Dress",
    price: 59.99,
    image: "/src/assets/chic-dress.svg",
    imageFront: "/src/assets/chic-dress.svg",
    imageBack: "/src/assets/chic-dress-back.svg",
    category: "Dresses",
    colors: [
      { name: "Teal", value: "#0f766e" },
      { name: "Ivory", value: "#fff8e7" },
      { name: "Gold", value: "#c6a15b" },
    ],
    description: "Flowy silhouette designed for comfort and style.",
  },
  {
    id: "p3",
    name: "Denim Jacket",
    price: 89.99,
    image: "/src/assets/denim-jacket.svg",
    category: "Tops",
    colors: [
      { name: "Blue", value: "#2563eb" },
      { name: "Navy", value: "#1e3a8a" },
    ],
    description: "Classic denim with modern tailoring.",
  },
  {
    id: "p4",
    name: "Comfort Joggers",
    price: 39.99,
    image: "/src/assets/comfort-joggers.svg",
    category: "Leggings",
    colors: [
      { name: "Grey", value: "#6b7280" },
      { name: "Black", value: "#20232a" },
    ],
    description: "Stretchy, relaxed joggers for at-home or on-the-go.",
  },
  {
    id: "p5",
    name: "Lightweight Hoodie",
    price: 49.99,
    image: "/src/assets/lightweight-hoodie.svg",
    category: "Seamless set",
    colors: [
      { name: "Cream", value: "#f5ead6" },
      { name: "Brown", value: "#7a4f36" },
    ],
    description: "Cozy hoodie with a sleek profile.",
  },
  {
    id: "p6",
    name: "Summer Shorts",
    price: 29.99,
    image: "/src/assets/summer-shorts.svg",
    category: "Shorts",
    colors: [
      { name: "Pink", value: "#f4a7b9" },
      { name: "White", value: "#f7f5ef" },
      { name: "Green", value: "#15803d" },
    ],
    description: "Breathable shorts with a comfortable fit.",
  },
];

export default products;
