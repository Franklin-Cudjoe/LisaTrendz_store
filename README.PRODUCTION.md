Production Deployment Notes

This project includes a minimal file-backed API and a React+Vite frontend.

Run locally for production-like behavior:

1. Install root and server dependencies:

```bash
npm install
cd server
npm install
cd ..
```

2. Build frontend and start server:

```bash
npm exec -- vite build
# set admin credentials via env or use defaults (Franklin/Cudjoe)
ADMIN_USER=Franklin ADMIN_PASS=Cudjoe NODE_ENV=production node server/index.js
```

3. Open http://localhost:4000 — the server serves the built frontend and the API on the same origin.

Docker

Build and run:

```bash
docker build -t lizzy-store .
docker run -p 4000:4000 lizzy-store
```

Security & recommendations

- The server uses Basic auth for admin endpoints; set secure credentials in environment variables (ADMIN_USER, ADMIN_PASS).
- For production, replace file-backed persistence with a real database (Postgres/Supabase/Firestore).
- Use HTTPS in front of the server, enable backups for `server/products.json` and rotate logs.
- Consider using a real auth provider (OAuth, Auth0, or a JWT-based server-side system) rather than Basic auth.
- For large image uploads, integrate S3 or similar and store image URLs in products.

Environment variables

- ADMIN_USER, ADMIN_PASS — admin credentials
- PORT — server port (default 4000)
- ALLOWED_ORIGINS — comma-separated list of CORS origins (optional)
- NODE_ENV=production to serve built frontend
- VITE_API_BASE_URL - frontend build-time API origin when the frontend and API are on different domains
- PUBLIC_API_ORIGIN - server public API origin used when returning uploaded image URLs
- PUBLIC_SITE_ORIGIN - public storefront URL used as the Paystack callback URL
- PAYSTACK_SECRET_KEY - Paystack secret key from the Paystack dashboard
- PAYSTACK_CURRENCY - payment currency, usually GHS
- PAYSTACK_CHANNELS - comma-separated Paystack channels, default card,mobile_money
- SMS_ENABLED - set to true after your SMS provider is ready
- SMS_PROVIDER - currently arkesel
- SMS_DEFAULT_COUNTRY_CODE - default country code for local numbers, usually +233
- SMS_BRAND_NAME - brand text used in the SMS body
- ARKESEL_API_KEY - Arkesel SMS API key
- ARKESEL_SENDER_ID - approved Arkesel sender ID, max 11 letters/numbers
- ARKESEL_CALLBACK_URL - optional public delivery report URL, for example https://your-api-domain.com/api/sms/arkesel/delivery-report
- DEV_PAYMENT_BYPASS - local testing only; keep false or unset in production

In production, the order-code SMS is sent after Paystack confirms a successful
payment through transaction verification or the signed webhook. Do not enable
`DEV_PAYMENT_BYPASS` in production.
