import type { MiddlewareHandler } from "hono";

import { AUTHORIZATION_SCHEME } from "./constants.ts";
import { unauthorized } from "./errors.ts";

export const requireBearerToken: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const authorization = c.req.header("authorization");
  const prefix = `${AUTHORIZATION_SCHEME} `;

  if (authorization === undefined || !authorization.startsWith(prefix)) {
    return unauthorized(c);
  }

  const token = authorization.slice(prefix.length);

  if (token.length === 0 || token !== c.env.SHORTENER_API_TOKEN) {
    return unauthorized(c);
  }

  await next();
};
