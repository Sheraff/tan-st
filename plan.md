# tan.st Implementation Plan

## Goal

Implement the v1 shortener as a Cloudflare Worker backed by `KV` and `D1`, with a small authenticated HTTP API for creating and deactivating links.

The repository is currently near-empty, with only lightweight project files present, so this plan assumes a fresh Worker implementation.

## Project Shape

Use a plain TypeScript Worker rather than adding a framework.

Implementation notes:

- Keep source files in TypeScript.
- Target the latest Node runtime for local tooling.
- Do not add a separate application transpile step for local development; use Node's TypeScript support for local scripts and let Wrangler and Cloudflare CI/CD handle Worker bundling and transpilation.
- Use TypeScript type-checking directly, such as `tsc --noEmit`, rather than producing build artifacts locally.
- Implement the Worker with Module Worker syntax using `export default { async fetch(...) {} } satisfies ExportedHandler<Env>`.
- Avoid deprecated Service Worker syntax.

Recommended layout:

```text
.
├── migrations/
│   └── 0001_init.sql
├── src/
│   ├── index.ts
│   ├── constants.ts
│   ├── http.ts
│   ├── auth.ts
│   ├── slug.ts
│   ├── url.ts
│   ├── cache.ts
│   ├── repository.ts
│   └── handlers/
│       ├── health.ts
│       ├── redirect.ts
│       └── api.ts
├── test/
│   ├── slug.test.ts
│   ├── url.test.ts
│   ├── redirect.test.ts
│   └── api.test.ts
├── worker-configuration.d.ts
├── package.json
├── tsconfig.json
└── wrangler.jsonc
```

## Bindings

Configure the Worker with:

- `D1_DATABASE` for canonical storage
- `LINKS_KV` for redirect cache and tombstones
- `SHORTENER_API_TOKEN` as a secret for authenticated API access

`wrangler.jsonc` should also define:

- worker name
- main entrypoint
- explicit current `compatibility_date`
- `d1_databases` binding with `migrations_dir`
- `kv_namespaces` binding
- local dev bindings for D1 and KV
- `upload_source_maps: true` for deployed TypeScript stack traces

Type generation:

- generate Cloudflare runtime and binding types with `wrangler types`
- treat the generated declarations file as the source of truth for `Env` and other platform types
- do not manually author Cloudflare binding interfaces in application code
- rerun `wrangler types` whenever Wrangler config or bindings change
- commit the generated declarations file
- add a `wrangler types --check` step to local checks or CI

## Phase 1: Bootstrap the Worker

1. Create a minimal Cloudflare Worker TypeScript project.
2. Add `wrangler.jsonc` with KV and D1 bindings.
3. Add scripts for `dev`, `deploy`, `check`, `test`, `cf-typegen`, and `cf-typecheck` or equivalent.
4. Generate Cloudflare types with `wrangler types`, commit the generated file, and include it in TypeScript checking.
5. Add a strict `tsconfig.json` configured for type-checking without local emit.

Acceptance criteria:

- `wrangler dev` starts successfully.
- `wrangler types` generates the Cloudflare declarations used by the project.
- `wrangler types --check` or equivalent passes.
- `GET /health` can be implemented and exercised locally.
- `npm run check` or equivalent runs TypeScript checks without emitting JavaScript.

## Phase 2: Create the D1 Schema

1. Add `migrations/0001_init.sql`.
2. Create the `links` table and index defined in `spec.md`.
3. Document the migration commands in `README.md` or a short setup section.

Important implementation detail:

- Keep `slug` nullable during insert.
- Assign the slug immediately afterward in application code.

Acceptance criteria:

- Local D1 migration applies cleanly.
- `SELECT` by `slug` and `destination_url` works as expected.

## Phase 3: Implement Core Helpers

### `src/constants.ts`

- reserved paths set
- base62 alphabet
- minimum slug length
- shared header names and JSON error codes

### `src/url.ts`

Implement:

- `normalizeDestinationUrl(input: string): string`
- `mergeRedirectQuery(destinationUrl: string, requestUrl: URL): string`

Requirements:

- exact `tanstack.com` validation
- HTTPS only
- strip explicit `:443`
- canonicalize query params by keeping last value per key
- sort normalized create-time params lexicographically
- preserve fragment from the destination
- ignore request fragment

### `src/slug.ts`

Implement:

- `encodeBase62(value: number): string`
- `padSlug(slug: string): string`
- `isReservedSlug(slug: string): boolean`
- `slugFromId(id: number): string`

Requirements:

- base62 alphabet exactly as specified
- minimum length `4`
- reserved path check is case-insensitive
- if a generated slug matches a reserved path, prefix additional leading `0` characters until it is valid

### `src/auth.ts`

Implement:

- `requireBearerToken(request: Request, env: Env): Response | null`

Behavior:

- read `Authorization` header
- validate `Bearer <token>`
- return `401` JSON on failure
- return `null` on success

Acceptance criteria:

- helper tests cover valid and invalid URLs
- helper tests cover duplicate query params and param ordering
- helper tests cover reserved slugs and short slug padding

## Phase 4: Implement D1 and KV Access

### `src/repository.ts`

Implement repository functions for:

- `getLinkBySlug(slug)`
- `getLinkByDestinationUrl(destinationUrl)`
- `createLink(destinationUrl)`
- `assignSlug(id, slug)`
- `reactivateLink(slug)`
- `deactivateLink(slug)`

Recommended behavior:

- keep SQL centralized here
- always update `updated_at` on state changes
- return typed row objects rather than raw D1 results
- when creating a link, handle the unique `destination_url` race by re-reading the winning row after an insert conflict

### `src/cache.ts`

Implement KV helpers for:

- `getCachedLink(slug)`
- `putActiveLink(slug, destinationUrl)`
- `putInactiveLink(slug)`

Acceptance criteria:

- active and inactive KV payloads match the spec
- D1 read and write paths are isolated from HTTP handlers

## Phase 5: Implement Request Handlers

### `GET /health`

- return `{ "ok": true }`
- status `200`
- no auth required

### `POST /api/shorten`

Flow:

1. require auth
2. parse JSON body
3. validate `url` field is a non-empty string
4. normalize URL
5. look up existing row by canonical `destination_url`
6. if active, return existing slug with status `200`
7. if inactive, reactivate in D1, repopulate KV, return existing slug with status `200`
8. if missing, create row with `slug = NULL`
9. if the insert loses a race on unique `destination_url`, re-read the winning row and return it according to its current active state
10. derive slug from inserted `id`
11. if derived slug is reserved, prefix additional leading `0` characters until valid
12. assign slug to the row
13. write active KV record
14. return JSON payload from the spec with status `201` when newly created

### `POST /api/links/:slug/deactivate`

Flow:

1. require auth
2. validate slug path segment
3. reject reserved paths
4. deactivate in D1
5. if the slug does not exist, return `404`
6. write inactive KV tombstone
7. return `204`

### `GET /:slug`

Flow:

1. return `404` for `GET /`
2. validate slug path segment
3. reject reserved paths
4. read KV
5. if inactive tombstone, return `404`
6. if active cache hit, merge request query and redirect
7. on KV miss, query D1
8. if D1 missing or inactive, write inactive tombstone and return `404`
9. if D1 active, populate KV, merge request query, redirect with `302`

Acceptance criteria:

- create, deactivate, and redirect all follow the exact v1 behavior
- same normalized destination returns the same slug
- incoming request query params override stored params by key
- duplicate incoming request query params collapse to the last value before overriding stored params

## Phase 6: Error Handling and Response Helpers

Add small shared helpers in `src/http.ts` for:

- `json(data, status)`
- `notFound()`
- `badRequest(code)`
- `unauthorized()`

Use consistent JSON errors:

- `invalid_url`
- `invalid_request`
- `unauthorized`
- `not_found`
- `method_not_allowed`

Acceptance criteria:

- every non-redirect response is JSON except `204 No Content`
- unsupported methods return a clear status and body

## Phase 7: Tests

Cover both pure logic and Worker behavior.

Test stack:

- use `vitest` for unit and integration-style tests
- use `@cloudflare/vitest-pool-workers` for Worker environment tests
- keep pure helpers testable in plain Vitest without requiring deployment or a manual transpile step
- use `wrangler types` generated declarations in both app and test TypeScript configuration instead of hand-written Cloudflare binding types
- include `@cloudflare/vitest-pool-workers` test types together with the generated `worker-configuration.d.ts`, and define `ProvidedEnv extends Env` where test helpers need typed bindings
- apply SQL migrations in D1 tests from the real migration files using `readD1Migrations()` and `applyD1Migrations()`
- assume per-test-file Worker storage isolation by default; only switch to `--max-workers=1 --no-isolate` when a shared-state integration test actually needs it

Priority tests:

1. normalization accepts `tanstack.com?b=2&a=1` and stores `https://tanstack.com/?a=1&b=2`
2. normalization collapses duplicate keys to the last value
3. normalization rejects non-HTTPS and non-`tanstack.com` URLs
4. slug encoding matches the agreed alphabet and minimum length
5. same canonical destination returns the same slug
6. redirect on KV hit works
7. redirect on KV miss falls back to D1 and repopulates KV
8. redirect query merging overrides stored keys
9. deactivate writes an inactive tombstone and returns `404` afterward
10. unauthorized API requests return `401`

Recommended tooling:

- `vitest`
- `@cloudflare/vitest-pool-workers`

## Phase 8: Local Development and Deployment

Document the exact commands for:

1. creating the D1 database
2. creating the KV namespace
3. applying local migrations
4. running local dev
5. setting `SHORTENER_API_TOKEN`
6. deploying the Worker

Local development notes:

- use `.dev.vars` for local secrets by default
- do not use `.dev.vars` and `.env` together; if `.dev.vars` exists, `.env` is ignored
- if environment-specific local secret files are used later, remember that `.dev.vars.<env>` replaces the base file rather than merging
- ordinary local development should use local D1 and KV state
- only add `preview_database_id`, `wrangler dev --remote`, or per-binding `remote: true` if remote Cloudflare resources are intentionally needed during development

Deployment checklist:

- D1 binding configured
- KV binding configured
- secret token configured
- custom domain `tan.st` attached to the Worker

## Phase 9: Integration From `tanstack.com`

Keep the integration point as plain HTTPS so deployment platform does not matter.

Server-side contract:

- `POST https://tan.st/api/shorten`
- bearer auth
- JSON request body `{ "url": "tanstack.com/..." }`
- JSON response with `slug`, `shortUrl`, and `destinationUrl`

Recommended next step for the consumer app:

- add a thin server-side helper such as `createShortLink(url: string)` in the `tanstack.com` codebase
- keep it server-only so the token never reaches the browser

## Suggested Implementation Order

1. Bootstrap Worker project and bindings.
2. Add D1 migration.
3. Implement URL normalization and slug helpers with tests.
4. Implement repository and KV helpers.
5. Implement `/health`.
6. Implement `POST /api/shorten`.
7. Implement `GET /:slug`.
8. Implement `POST /api/links/:slug/deactivate`.
9. Add integration tests.
10. Document setup and deploy.

## Risks and Mitigations

### KV eventual consistency

- Risk: newly created or deactivated links may briefly be stale globally.
- Mitigation: D1 remains the source of truth and KV miss paths always reconcile.

### Slug assignment around reserved words

- Risk: a numeric id may map to a reserved slug.
- Mitigation: keep the same numeric source and add leading `0` characters until the slug is no longer reserved.

### Duplicate create requests

- Risk: concurrent requests for the same destination could race.
- Mitigation: rely on the unique constraint on `destination_url`, then re-read the winning row when an insert conflict happens.

### Future destination edits

- Risk: editing slug destinations would make cache invalidation harder.
- Mitigation: keep destination editing out of v1.
