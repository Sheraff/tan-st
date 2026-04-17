import { sValidator } from "@hono/standard-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { methodNotAllowed, invalidRequest, invalidUrl, notFound } from "./errors.ts";
import { requireBearerToken } from "./auth.ts";
import { handleDeactivate, handleShorten } from "./handlers/api.ts";
import { handleHealth } from "./handlers/health.ts";
import { handleRedirect } from "./handlers/redirect.ts";
import { InvalidUrlError } from "./url.ts";
import { shortenRequestBodySchema, slugParamsSchema } from "./validation.ts";

const app = new Hono<{ Bindings: Env }>();

const invalidRequestHook = (
  result: { success: boolean },
  c: Parameters<typeof invalidRequest>[0],
) => {
  if (!result.success) {
    return invalidRequest(c);
  }
};

const notFoundHook = (result: { success: boolean }, c: Parameters<typeof notFound>[0]) => {
  if (!result.success) {
    return notFound(c);
  }
};

app.onError((error, c) => {
  if (error instanceof InvalidUrlError) {
    return invalidUrl(c);
  }

  if (error instanceof HTTPException) {
    return error.status === 400 ? invalidRequest(c) : error.getResponse();
  }

  console.error(error);
  return c.text("Internal Server Error", 500);
});

app.notFound((c) => notFound(c));

app.get("/api/health", (c) => handleHealth(c));
app.all("/api/health", (c) => methodNotAllowed(c));

app.post(
  "/api/shorten",
  requireBearerToken,
  sValidator("json", shortenRequestBodySchema, invalidRequestHook),
  (c) => handleShorten(c, c.req.valid("json")),
);
app.all("/api/shorten", (c) => methodNotAllowed(c));

app.post(
  "/api/links/:slug/deactivate",
  requireBearerToken,
  sValidator("param", slugParamsSchema, notFoundHook),
  (c) => handleDeactivate(c, c.req.valid("param").slug),
);
app.all("/api/links/:slug/deactivate", (c) => methodNotAllowed(c));

app.get("/:slug", sValidator("param", slugParamsSchema, notFoundHook), (c) => {
  return handleRedirect(c, c.req.valid("param").slug);
});
app.all("/:slug", (c) => methodNotAllowed(c));

export default app;
