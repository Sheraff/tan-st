# tan.st

Cloudflare Worker shortener for `tan.st` built with `Hono`, `Valibot`, `Drizzle`, `D1`, and `KV`.

## API

Redirect lookups stay `KV`-first for the fast path. `D1` remains the source of truth for creation, reactivation, and deactivation.

Write endpoints require an `Authorization` header:

```text
Authorization: Bearer <SHORTENER_API_TOKEN>
```

### `GET /api/health`

Use this to check whether the worker is up.

Request shape:

- No authentication required.
- No request body.

Response:

```json
{
	"ok": true
}
```

### `POST /api/shorten`

Create, reuse, or reactivate a short link for a `tanstack.com` URL.

Request shape:

- Requires bearer token authentication.
- `Content-Type: application/json`
- JSON body:

```json
{
	"url": "tanstack.com/foo?bar=1"
}
```

Notes:

- `url` must be a non-empty string.
- `url` may be a full `https://tanstack.com/...` URL, a `tanstack.com/...` shorthand, a root-relative path like `/docs/start`, or a bare relative path like `docs/start`.
- Inputs without an origin are resolved against `https://tanstack.com`.
- Only destinations that resolve to `https://tanstack.com/...` are accepted.
- Query params are normalized before storage, so equivalent URLs reuse the same slug.

Success response:

```json
{
	"slug": "000a",
	"shortUrl": "https://tan.st/000a",
	"destinationUrl": "https://tanstack.com/foo?bar=1",
	"created": true,
	"reactivated": false
}
```

Status codes:

- `201` when a new short link is created.
- `200` when the URL already exists or an inactive link is reactivated.

### `POST /api/links/:slug/deactivate`

Deactivate an existing short link.

Request shape:

- Requires bearer token authentication.
- No request body.
- `slug` must be base62 and at least 4 characters, for example `000a`.

Response:

- `204 No Content` on success.
- Empty response body.

### `GET /:slug`

Resolve a short slug and redirect to the stored destination.

Request shape:

- No authentication required.
- No request body.
- `slug` must be base62 and at least 4 characters.

Response:

- `302 Found` redirect to the stored `destinationUrl`.
- If the incoming request includes query params, they are merged into the destination URL.

Example:

- `GET /000a?qux=2` can redirect to `https://tanstack.com/foo?bar=1&qux=2`.

### Error responses

Errors are returned as JSON:

```json
{
	"error": "invalid_request"
}
```

Possible error codes:

- `invalid_request` for malformed JSON or a missing/invalid request body.
- `invalid_url` when the submitted URL is not an allowed `https://tanstack.com/...` destination.
- `unauthorized` when the bearer token is missing or wrong.
- `not_found` when a slug is invalid, missing, or inactive.
- `method_not_allowed` when the endpoint does not support the HTTP method used.

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
