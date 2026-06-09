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
3. Set secrets:
   - `wrangler secret put JWT_SECRET`
   - `wrangler secret put JWT_REFRESH_SECRET`
4. Run migrations:
   - `npm run db:migrate:local`
5. Run local dev server:
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
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/users` (admin)
- `GET /api/users/:id` (admin)
- `GET /api/encuentros`
- `GET /api/encuentros/:id`
- `POST /api/encuentros` (auth)
- `PATCH /api/encuentros/:id` (auth)
- `DELETE /api/encuentros/:id` (auth)
