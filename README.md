# tan.st

Cloudflare Worker shortener for `tan.st` backed by `D1` and `KV`.

## Routes

- `GET /health`
- `POST /api/shorten`
- `POST /api/links/:slug/deactivate`
- `GET /:slug`

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

4. Apply the local D1 migration:

```sh
pnpm exec wrangler d1 migrations apply D1_DATABASE --local
```

5. Start local development:

```sh
pnpm dev
```

## Checks

```sh
pnpm run check
pnpm test
```

`pnpm run check` includes `wrangler types --check`, application type-checking, and test type-checking without local emit.

## Resource Provisioning

`wrangler.jsonc` is valid for local development as-is. Because the binding IDs are intentionally omitted, Wrangler can auto-provision the production `D1` database and `KV` namespace on deploy.

If you want to create the Cloudflare resources up front and pin their IDs in `wrangler.jsonc`, use:

```sh
pnpm exec wrangler d1 create tan-st
pnpm exec wrangler kv namespace create LINKS_KV
```

Then copy the returned `database_id` and `id` values into `wrangler.jsonc`.

## Secrets Notes

- Use `.dev.vars` for local secrets by default.
- Do not use `.dev.vars` and `.env` together. If `.dev.vars` exists, Wrangler ignores `.env`.
- If you later add `.dev.vars.<env>`, that file replaces `.dev.vars` instead of merging with it.
- Local development uses local D1 and KV state because the bindings are not marked `remote: true`.

## Deploy

1. Set the production token:

```sh
pnpm exec wrangler secret put SHORTENER_API_TOKEN
```

2. Apply the production migration:

```sh
pnpm exec wrangler d1 migrations apply D1_DATABASE --remote
```

3. Deploy the Worker:

```sh
pnpm deploy
```

4. Attach the custom domain `tan.st` to the Worker in Cloudflare once the zone is ready.
