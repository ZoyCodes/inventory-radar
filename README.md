# Inventory Radar

MVP for a local Pokemon community inventory map in the Capital Region, NY.

The app helps collectors answer: what is worth checking near me right now?

## Deployment Model

- GitHub repository hosts source control.
- `dev` branch maps to staging/preview.
- `main` branch maps to production.
- Vercel hosts the Next.js app.
- Neon hosts Postgres.
- Mapbox provides the public browser map token.

No real secrets should be committed. Configure environment variables in Vercel and local `.env.local` files only.

## Required Environment Variables

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"
TEST_DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/TEST_DATABASE?schema=public"
ADMIN_TOKEN="replace-with-at-least-32-random-characters"
NEXT_PUBLIC_MAPBOX_TOKEN="pk_your_public_mapbox_token"
```

Notes:

- `DATABASE_URL` is server-only and must point to the runtime database for that environment.
- `TEST_DATABASE_URL` is for destructive tests only and must never point at production.
- `ADMIN_TOKEN` is server-only and must not use the `NEXT_PUBLIC_` prefix.
- `NEXT_PUBLIC_MAPBOX_TOKEN` is intentionally public and will be bundled into browser JavaScript.

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

Open http://localhost:3000.

For database-backed tests, set `DATABASE_URL` and `TEST_DATABASE_URL` to the same non-production test database before running:

```bash
DATABASE_URL="postgresql://..." TEST_DATABASE_URL="postgresql://..." npm test
```

Tests that reset database state intentionally skip unless `DATABASE_URL === TEST_DATABASE_URL`.

## Staging Setup

Use the `dev` branch for staging/preview deployments.

Required staging configuration:

- Vercel project/environment connected to `dev`.
- Separate Neon staging database.
- `DATABASE_URL` points to the staging Neon database.
- `TEST_DATABASE_URL` points to a separate disposable staging test database, or is omitted if CI should skip DB integration tests.
- `ADMIN_TOKEN` is unique to staging.
- `NEXT_PUBLIC_MAPBOX_TOKEN` is configured for staging domains.

Warning: staging/preview must not use the production `DATABASE_URL`.

## Production Setup

Use the `main` branch for production deployments.

Required production configuration:

- Vercel production environment connected to `main`.
- Neon production database.
- `DATABASE_URL` points only to the production Neon database.
- `ADMIN_TOKEN` is unique to production and differs from local/staging.
- `NEXT_PUBLIC_MAPBOX_TOKEN` is restricted to production domains in Mapbox.
- `TEST_DATABASE_URL` must not point at production.

Run migrations before or during deploy:

```bash
npm run prisma:deploy
```

Then seed baseline stores/products/product identifiers only when appropriate:

```bash
npm run prisma:seed
```

## Vercel Notes

- Framework preset: Next.js.
- Build command: `npm run build`.
- Install command: `npm ci`.
- Add all required environment variables in Vercel project settings.
- Do not expose `DATABASE_URL` or `ADMIN_TOKEN` through `NEXT_PUBLIC_`.
- Configure branch/environment mapping so `dev` is preview/staging and `main` is production.

## Neon Notes

- Create separate Neon databases/projects for staging and production.
- Use pooled or direct connection strings according to Vercel/Prisma guidance for the deployment target.
- Run Prisma migrations against each environment before using the app.
- Verify `npm run prisma:seed` against the intended database before inviting users.

## Mapbox Notes

- `NEXT_PUBLIC_MAPBOX_TOKEN` is a public token by design.
- Restrict the token in Mapbox provider settings by allowed URLs/domains before production.
- Configure separate restrictions for localhost, staging, and production where practical.

## Data Model

Runtime persistence uses Postgres through Prisma.

- Schema: `prisma/schema.prisma`
- Migrations: `prisma/migrations`
- Seed script: `prisma/seed.ts`
- Runtime data facade: `app/lib/data.ts`

The old JSON seed utility remains available only for local experiments:

```bash
npm run seed
```

It writes `data/mvp-db.json`, but the app runtime does not read that file.

## Production Safety Checklist

Before public deployment:

- CI passes.
- `npm audit` high vulnerabilities are reviewed and fixed or explicitly accepted.
- Production `DATABASE_URL` is configured.
- Staging `DATABASE_URL` is configured separately.
- Staging/preview does not use the production database.
- `TEST_DATABASE_URL` never points at production.
- `ADMIN_TOKEN` is server-only and different per environment.
- Mapbox token is restricted by domain.
- Prisma migrations are tested against real Postgres.
- Prisma seed is tested against real Postgres.
- `/admin` and `/api/admin/*` remain protected by server-side authorization.

## MVP Notes

- Store seed data should be verified before launch.
- Photo upload is intentionally a placeholder.
- Public reporting uses anonymous contributor IDs.
- Admin access requires a server-only token.
- Product matching follows the MVP pipeline: exact UPC, exact retailer SKU, exact alias/normalized name, fuzzy name, then unmatched review.
