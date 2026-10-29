# Thokbazar Backend API

Express REST API for the Thokbazar marketplace.

## Requirements
- Node.js 20+
- A private `JWT_SECRET` of at least 32 characters

## Local setup
1. Copy `.env.example` to `.env`.
2. Set `JWT_SECRET` in `.env` to a private random string of at least 32 characters.
3. Run `npm install`.
4. Run `npm run dev`.
5. Health check: `http://localhost:3000/api/health`.

The backend serves the frontend from its `public` directory when the full project is assembled. To use this backend separately, place the frontend's `index.html` in a `public/` folder at the backend project root, or configure the frontend to call `https://YOUR-BACKEND-DOMAIN/api` via `window.TB_API_BASE`.

## API routes
- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/categories` and `POST /api/categories`
- `GET /api/products`, `POST /api/products`, `PATCH /api/products/:id`, `DELETE /api/products/:id`
- `POST /api/enquiries`
- `GET /api/seller/enquiries`
- `POST /api/requirements`
- `GET /api/requirements`

## Notes
This starter uses JSON-file persistence. For production, use persistent storage or a managed database, HTTPS, and a restrictive CORS allowlist. GitHub stores source code; it does not itself run this Node server.
