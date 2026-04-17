# tan.st v1 Spec

## Scope

- `tan.st` is a single Cloudflare Worker.
- Public redirects read from `KV` first and fall back to `D1` on a KV miss.
- `D1` is the canonical store.
- `KV` is a read-through cache plus inactive tombstones.
- Only exact `https://tanstack.com/...` destinations are allowed.
- No custom slugs in v1.
- No analytics in v1.

## Routes

- `GET /:slug`
- `POST /api/shorten`
- `POST /api/links/:slug/deactivate`
- `GET /health`

`GET /` returns `404` in v1.

## Reserved Paths

These exact paths are reserved, case-insensitively:

- `api`
- `admin`
- `health`
- `favicon.ico`
- `robots.txt`

Slugs are single path segments only.

## Data Model

### D1

```sql
CREATE TABLE links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE,
  destination_url TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_links_slug_active ON links (slug, active);
```

Notes:

- `destination_url` is already canonicalized, so it is also the idempotency key.
- `slug` is nullable only during row creation. Application code must assign a slug before the create flow completes.
- `created_by` is intentionally omitted.

### KV

Key format:

```text
slug:{slug}
```

Value for active links:

```json
{
  "active": true,
  "destinationUrl": "https://tanstack.com/?foo=1"
}
```

Value for inactive links:

```json
{
  "active": false
}
```

Inactive tombstones avoid repeated D1 lookups after deactivation.

## URL Normalization

Incoming create requests are normalized before storage. The normalized result becomes `destination_url`.

Algorithm:

1. Accept a single input string.
2. Trim surrounding whitespace.
3. If the input has no scheme, prepend `https://`.
4. Parse with the standard `URL` API.
5. Require `protocol === "https:"`.
6. Require `hostname === "tanstack.com"` exactly.
7. Reject any username or password.
8. Accept no port, or `443`. If `443` is present, strip it.
9. Preserve the pathname as parsed by the URL API.
10. Canonicalize query params by keeping only the last value for each key.
11. Treat parameter order as irrelevant.
12. Sort keys lexicographically ascending.
13. Preserve the fragment exactly as parsed.
14. Serialize with the standard URL serializer.

Examples:

- `tanstack.com` -> `https://tanstack.com/`
- `tanstack.com?b=2&a=1` -> `https://tanstack.com/?a=1&b=2`
- `tanstack.com?foo=1&foo=2` -> `https://tanstack.com/?foo=2`

Rejected examples:

- `http://tanstack.com/...`
- `https://www.tanstack.com/...`
- `https://tanstack.com:8443/...`
- `https://user:pass@tanstack.com/...`

## Slug Format

- Slugs use base62.
- Minimum length is `4`.
- Slugs are left-padded with `0` until length `4`.
- The alphabet is fixed:

```text
0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ
```

Examples:

- `1` -> `0001`
- `35` -> `000z`
- `36` -> `000A`

Rules:

- Slugs are case-sensitive.
- Any slug matching a reserved path, case-insensitively, must be prefixed with additional leading `0` characters until it is no longer reserved.
- The same canonical `destination_url` must always resolve to the same slug.

## Slug Generation

Slug generation is monotonic and deterministic.

Algorithm:

1. Normalize the requested destination URL.
2. Look up an existing row by `destination_url`.
3. If one exists, return its slug.
4. If not, insert a new row with `slug = NULL` and the normalized `destination_url`.
5. Read the inserted numeric `id`.
6. Encode `id` to base62.
7. Left-pad to length `4`.
8. If the generated slug matches a reserved path, case-insensitively, prepend additional leading `0` characters until it no longer matches.
9. Update the row with the final slug.

The exact SQL mechanics may vary, but the observable behavior is fixed by the rules above. Reserved-path handling must not change the numeric source, which avoids future slug collisions.

## Create API

`POST /api/shorten`

Request:

```json
{
  "url": "tanstack.com?foo=1"
}
```

Success response:

```json
{
  "slug": "000a",
  "shortUrl": "https://tan.st/000a",
  "destinationUrl": "https://tanstack.com/?foo=1",
  "created": true,
  "reactivated": false
}
```

Behavior:

1. Authenticate the request.
2. Normalize the input URL.
3. Look up `links.destination_url`.
4. If an active row exists, return it.
5. If an inactive row exists, reactivate it, repopulate KV, and return it.
6. If no row exists, create one, generate the slug, store it in D1, and populate KV.

Status codes:

- `201` when newly created
- `200` when existing or reactivated

## Deactivate API

`POST /api/links/:slug/deactivate`

Behavior:

1. Authenticate the request.
2. Reject reserved paths.
3. Set `active = 0` and `updated_at = CURRENT_TIMESTAMP` in D1.
4. Write the KV tombstone `{ "active": false }`.

Status codes:

- `204` on success
- `404` if the slug does not exist

## Redirect Behavior

`GET /:slug`

Algorithm:

1. Reject reserved paths.
2. Read `KV["slug:{slug}"]`.
3. If KV says inactive, return `404`.
4. If KV says active, use its `destinationUrl`.
5. If KV misses, query D1 by `slug`.
6. If the D1 row is missing or inactive, write an inactive tombstone to KV and return `404`.
7. If the D1 row is active, populate KV and continue.
8. Merge query params from the stored destination and the incoming short URL request.
9. Return a `302` redirect to the final URL.

## Query Param Merge on Redirect

The stored destination query is the base.

Incoming request query overrides by key.

Rules:

1. Start with the stored destination query params.
2. For each incoming request query param, keep only its last value.
3. If an incoming key already exists, replace the stored value.
4. If an incoming key does not exist, add it.
5. Fragments are preserved from the stored destination.
6. A fragment on the short URL request is irrelevant because browsers do not send it to the server.

Examples:

- Stored: `https://tanstack.com/?foo=1`
- Request: `GET /000a`
- Redirect: `https://tanstack.com/?foo=1`

- Stored: `https://tanstack.com/?foo=1`
- Request: `GET /000a?bar=2`
- Redirect: `https://tanstack.com/?foo=1&bar=2`

- Stored: `https://tanstack.com/?foo=1&bar=2`
- Request: `GET /000a?bar=9&baz=3&baz=4`
- Redirect: `https://tanstack.com/?foo=1&bar=9&baz=4`

## Auth Model

Do not assume `tanstack.com` runs on Cloudflare.

Use a server-to-server HTTPS API protected by a shared bearer token:

```text
Authorization: Bearer <SHORTENER_API_TOKEN>
```

This works from TanStack Start server functions regardless of hosting platform.

Example:

```ts
await fetch("https://tan.st/api/shorten", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "authorization": `Bearer ${process.env.SHORTENER_API_TOKEN}`,
  },
  body: JSON.stringify({ url: "tanstack.com?foo=1" }),
})
```

If `tanstack.com` later moves to Cloudflare, the shortener may switch to service bindings without changing the API contract.

## Operational Notes

- Redirects use `302` in v1.
- KV is eventually consistent, so create, reactivate, and deactivate operations may have a short global propagation window.
- Editing an existing slug's destination is out of scope for v1.

## Error Responses

`GET /health`

```json
{ "ok": true }
```

`POST /api/shorten` errors:

```json
{ "error": "invalid_url" }
```

```json
{ "error": "unauthorized" }
```

`GET /:slug` missing or inactive:

```json
{ "error": "not_found" }
```
