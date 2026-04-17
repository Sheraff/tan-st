# Cleanup Plan

## Decisions

- Use `hono` for routing.
- Use `valibot` for runtime validation at unsafe boundaries.
- Use `@hono/standard-validator` for Hono request validation.
- Keep the current API error contract. Validation should still map back to `{ error: "invalid_request" }`, `{ error: "invalid_url" }`, `{ error: "unauthorized" }`, `{ error: "not_found" }`, and `{ error: "method_not_allowed" }` instead of exposing raw validator issue payloads.
- Keep `KV` as the fast path for redirects. We accept eventual consistency for rare deactivate/reactivate operations.
- No backwards compatibility work is needed.
- The current hand-written baseline migration must be replaced with a Drizzle-generated baseline.
- Move the health endpoint from `/health` to `/api/health`.
- Drop root-level reserved slug handling entirely. If an admin surface is added later, it should live under `/app/admin`.

## Goals

- Replace hand-written routing and param parsing in `src/index.ts`.
- Remove most or all of `src/http.ts` by moving response handling to Hono helpers and shared error mapping.
- Replace hand-written repository typing and row-mapping in `src/repository.ts` with Drizzle queries and inferred types. Only add explicit named types when they are actually needed.
- Replace ad-hoc shape checks with Valibot where data crosses an unsafe boundary.
- Add `oxfmt`, `oxlint`, and pull request CI.

## Work Items

### 1. Introduce Hono and simplify HTTP flow

- Replace the manual dispatch tree in `src/index.ts` with a Hono app.
- Define these routes in Hono: `GET /api/health`, `POST /api/shorten`, `POST /api/links/:slug/deactivate`, `GET /:slug`.
- Remove root-level reserved-path handling. With a minimum slug length of `4`, no `.` in the base62 alphabet, and health moved under `/api`, generated slugs do not collide with the current fixed routes.
- Use Hono route params instead of regular expressions and manual extraction.
- Use Hono `notFound` handling and a single shared error-mapping path.
- Remove `src/http.ts` once the JSON helpers and error helpers are no longer needed.
- Keep response bodies and status codes unchanged from the current app behavior.

### 2. Validate request inputs with Valibot and `@hono/standard-validator`

- Add `valibot` and `@hono/standard-validator`.
- Define schemas for the shorten request body, slug route params, and any other request data that enters through Hono.
- Use `sValidator("json", ...)` for `POST /api/shorten`.
- Use `sValidator("param", ...)` for `GET /:slug` and `POST /api/links/:slug/deactivate`.
- Keep auth as dedicated middleware so `401 unauthorized` remains explicit and does not turn into a generic validator error.
- If we validate headers through Hono's `header` target, the schema key must be lowercase `authorization` because Hono normalizes header names internally. Clients may still send `Authorization` with any casing.
- Use `sValidator` hooks directly on the small set of routes so failures still map to the current error contract.
- Keep URL normalization and redirect-query merging in `src/url.ts`; those are domain rules, not just shape validation.

### 3. Replace manual unsafe-boundary checks outside Hono

- Replace the manual `typeof` checks in `src/handlers/api.ts` with schema-driven validation.
- Replace the manual `KV` payload shape checks in `src/cache.ts` with Valibot parsing.
- Keep simple internal checks simple if the value is already trusted and strongly typed.

### 4. Move D1 access to Drizzle

- Add `drizzle-orm` and `drizzle-kit`.
- Create a Drizzle schema for the `links` table.
- Create a small Drizzle client helper for `Env.D1_DATABASE`.
- Refactor `src/repository.ts` to use Drizzle queries and inferred return types instead of `LinkRow`, `LinkRecord`, and manual conversion code.
- Preserve the current behavior around canonical destination URLs, slug assignment from IDs, and link reactivation.
- Add `drizzle.config.ts`.
- Generate SQL migrations with `drizzle-kit generate`.
- Keep generated SQL migrations in `migrations/` so existing Wrangler and Vitest D1 migration flows continue to work.
- Replace the current hand-written baseline migration with the Drizzle-generated baseline.

### 5. Keep KV-first redirects

- Preserve `KV` as the fast path for redirect lookups.
- Do not do a broader D1-first redirect consistency redesign in this cleanup.
- Keep current deactivate/reactivate behavior, accepting that propagation may lag briefly across regions.
- Make cache parsing and writes cleaner and better typed as part of the validation pass.

### 6. Add formatting and linting

- Add `oxfmt` and `oxlint`.
- Add scripts for `format`, `format:check`, and `lint`.
- Update the aggregate `check` script so local checks and CI run the same core commands.
- Exclude generated files like `worker-configuration.d.ts` from lint and formatting noise if needed.

### 7. Add GitHub Actions pull request checks

- Add `.github/workflows/ci.yml`.
- Run on pull requests.
- Use Node `24` and `pnpm`.
- Run `pnpm install --frozen-lockfile`.
- Run `pnpm run cf-typecheck`.
- Run `pnpm exec tsc --noEmit`.
- Run `pnpm exec tsc --noEmit -p test/tsconfig.json`.
- Run `pnpm test`.
- Run `pnpm run format:check`.
- Run `pnpm run lint`.

### 8. Clean up docs and config

- Update `.gitignore` to ignore `.dev.vars*` and `.env*`.
- Update `README.md` for the Hono, Drizzle, and Valibot stack.
- Document the Drizzle migration workflow and generated SQL migrations.
- Document the formatting and linting commands.
- Update the note about omitted D1 and KV binding IDs to match current Cloudflare docs: supported, but documented as Beta.
- Keep the current Cloudflare Vitest migration setup unless a small Drizzle-related adjustment is needed.

### 9. Verify behavior

- Update tests as needed so the current API and redirect behavior stays covered.
- Add targeted tests for validator-backed invalid request cases.
- Add targeted tests for auth failure behavior.
- Add targeted tests for slug param validation and not-found behavior.
- Add targeted tests for repository behavior after the Drizzle migration rewrite.
- Run the full local check suite before considering the cleanup complete.

## Suggested Implementation Order

1. Add Hono, Valibot, and `@hono/standard-validator`, then refactor routing while preserving the current HTTP contract.
2. Replace manual request and `KV` boundary checks with Valibot.
3. Introduce Drizzle schema and config, generate the new baseline migration, and refactor repository access.
4. Add `oxfmt` and `oxlint`, then wire the scripts.
5. Add the GitHub Actions workflow.
6. Update docs and run the full verification pass.

## Out of Scope

- Backwards compatibility layers.
- A D1-first redirect consistency redesign.
- Production routing or custom-domain config changes beyond documentation cleanup.
