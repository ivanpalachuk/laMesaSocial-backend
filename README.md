# La Mesa Social Backend

Backend API for La Mesa Social running on Cloudflare Workers + D1.

## Included scope

- Authentication: register, login, refresh, logout, me.
- Users table and admin-only user list endpoints.
- CRUD for upcoming events (`encuentros`).

## Stack

- Cloudflare Workers
- Hono
- D1 (SQLite)
- Drizzle ORM
- JWT + bcrypt

## Setup

1. Install dependencies:
   - `npm install`
2. Create a D1 database and replace IDs in `wrangler.toml`.
3. Set secrets (never commit these values):
   - `wrangler secret put JWT_SECRET`
   - `wrangler secret put JWT_REFRESH_SECRET`
   - `wrangler secret put RESEND_API_KEY`
   - For production: append `--env production` to each secret command.
4. For local dev, copy `.dev.vars.example` to `.dev.vars` and fill in your secrets.
5. Update `RESEND_FROM_EMAIL` in `wrangler.toml` to match your verified Resend sender domain.
6. Run migrations:
   - `npm run db:migrate:local`
7. Run local dev server:
   - `npm run dev`

## Scripts

- `npm run dev`
- `npm run deploy`
- `npm run typecheck`
- `npm run db:generate`
- `npm run db:migrate:local`
- `npm run db:migrate:remote`

## API routes

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/users` (admin)
- `GET /api/users/:id` (admin)
- `POST /api/users` (admin)
- `PATCH /api/users/:id` (admin)
- `GET /api/encuentros`
- `GET /api/encuentros/:id`
- `POST /api/encuentros` (auth)
- `PATCH /api/encuentros/:id` (auth)
- `DELETE /api/encuentros/:id` (auth)
