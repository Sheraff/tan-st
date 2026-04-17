# tan.st

Cloudflare Worker shortener for `tan.st` built with `Hono`, `Valibot`, `Drizzle`, `D1`, and `KV`.

## Routes

- `GET /api/health`
- `POST /api/shorten`
- `POST /api/links/:slug/deactivate`
- `GET /:slug`

Redirect lookups stay `KV`-first for the fast path. `D1` remains the source of truth for creation, reactivation, and deactivation.

## Local Setup

1. Install dependencies:

```sh
pnpm install
```

2. Generate Cloudflare runtime and binding types:

```sh
pnpm run cf-typegen
```

3. Add a local secret in `.dev.vars`:

```text
SHORTENER_API_TOKEN=replace-me
```

4. Apply the local D1 migrations:

```sh
pnpm exec wrangler d1 migrations apply D1_DATABASE --local
```

5. Start local development:

```sh
pnpm dev
```

## Drizzle Migrations

The schema lives in `src/schema.ts`. Drizzle-generated SQL migrations are committed in `migrations/` so Wrangler and the Cloudflare Vitest pool both apply the same files.

When the schema changes:

```sh
pnpm run db:generate
pnpm exec wrangler d1 migrations apply D1_DATABASE --local
```

Review the generated SQL in `migrations/` before applying it remotely.

## Checks

Run the full local check suite with:

```sh
pnpm run check
```

Useful individual commands:

```sh
pnpm test
pnpm run format
pnpm run format:check
pnpm run lint
```

`pnpm run check` runs the same core commands as pull request CI: Cloudflare type checks, both TypeScript projects, tests, formatting checks, and linting.

## Resource Provisioning

`wrangler.jsonc` is valid for local development as-is. Wrangler supports omitting the production `D1` and `KV` binding IDs so deploys can provision them automatically, but Cloudflare still documents that workflow as Beta.

If you want to create the Cloudflare resources up front and pin their IDs in `wrangler.jsonc`, use:

```sh
pnpm exec wrangler d1 create tan-st
pnpm exec wrangler kv namespace create LINKS_KV
```

Then copy the returned `database_id` and `id` values into `wrangler.jsonc`.

## Secrets Notes

- `.dev.vars*` and `.env*` are gitignored.
- Use `.dev.vars` for local secrets by default.
- Do not use `.dev.vars` and `.env` together. If `.dev.vars` exists, Wrangler ignores `.env`.
- If you later add `.dev.vars.<env>`, that file replaces `.dev.vars` instead of merging with it.
- Local development uses local `D1` and `KV` state because the bindings are not marked `remote: true`.

## Deploy

1. Set the production token:

```sh
pnpm exec wrangler secret put SHORTENER_API_TOKEN
```

2. Apply the production migrations:

```sh
pnpm exec wrangler d1 migrations apply D1_DATABASE --remote
```

3. Deploy the Worker:

```sh
pnpm deploy
```

4. Attach the custom domain `tan.st` to the Worker in Cloudflare once the zone is ready.
