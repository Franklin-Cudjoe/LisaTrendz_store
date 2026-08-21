# LisaTrendz Store - Frontend (React + Vite)

This is a lightweight, mobile-optimized React + Vite frontend scaffold for a clothing e-commerce shop.

Getting started

```bash
npm install
cd server
npm install
cd ..
npm run start
```

`npm run start` starts both the backend and the storefront, opens the local site in your browser, and automatically uses the next available local port if `4000` is already busy.

Files of interest

- `src/App.jsx` — app layout and view state
- `src/components/` — UI components (Header, Home, ProductList, ProductCard, ProductPage, Cart)
- `src/data/products.js` — sample product data
- `src/styles.css` — global responsive styles

Paystack payments

Checkout uses the backend to initialize and verify Paystack payments. Add the
Paystack server keys to `.env` or `server/.env`:

```bash
PAYSTACK_SECRET_KEY=sk_test_your_paystack_secret_key
PAYSTACK_CURRENCY=GHS
PAYSTACK_CHANNELS=card,mobile_money
PUBLIC_SITE_ORIGIN=http://127.0.0.1:5173
PUBLIC_API_ORIGIN=http://localhost:4000
```

Next steps

- Hook up a real backend/API for products and cart persistence
- Improve accessibility and add tests
