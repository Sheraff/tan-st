import { AUTHORIZATION_SCHEME } from "./constants.ts";
import { unauthorized } from "./http.ts";

export function requireBearerToken(request: Request, env: Env): Response | null {
  const authorization = request.headers.get("authorization");
  const prefix = `${AUTHORIZATION_SCHEME} `;

  if (authorization === null || !authorization.startsWith(prefix)) {
    return unauthorized();
  }

  const token = authorization.slice(prefix.length);

  if (token.length === 0 || token !== env.SHORTENER_API_TOKEN) {
    return unauthorized();
  }

  return null;
}
