# OpsCenter

OpsCenter is an enterprise PC support and ticket management app with a Next.js App Router frontend, Express API, Oracle Database schema, JWT authentication, and bcrypt password hashing.

## Structure

- `frontend/` - Next.js, React, TypeScript, Tailwind CSS
- `backend/` - Node.js, Express, Oracle, JWT, bcrypt
- `database/` - Oracle SQL schema, indexes, optional seed data
- `docs/` - setup and architecture notes

## Quick Start

1. Create an Oracle user/schema and run:
   - `database/01_schema.sql`
   - `database/02_indexes.sql`
   - optionally `database/03_seed_optional.sql`
   - for existing schemas, run `database/05_oracle_runtime_alignment.sql`
   - optionally run `database/06_seed_test_users.sql` to align the local Oracle admin baseline
2. Copy `backend/.env.example` to `backend/.env` and set Oracle credentials plus `JWT_SECRET`.
3. Copy `frontend/.env.example` to `frontend/.env.local`.
4. Start the API: `npm run dev` from `backend/`.
5. Start the UI: `npm run dev` from `frontend/`.
6. Open `http://localhost:3000`.

When the `USERS` table is empty, the root page redirects to `/setup-admin`. After the first admin exists, it redirects to `/login`.
