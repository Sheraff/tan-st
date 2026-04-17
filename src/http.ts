import { CONTENT_TYPE_HEADER, ERROR_CODES, JSON_CONTENT_TYPE, type ErrorCode } from "./constants.ts";

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE,
    },
  });
}

function error(status: number, code: ErrorCode): Response {
  return json({ error: code }, status);
}

export function badRequest(code: typeof ERROR_CODES.invalid_request | typeof ERROR_CODES.invalid_url): Response {
  return error(400, code);
}

export function unauthorized(): Response {
  return error(401, ERROR_CODES.unauthorized);
}

export function notFound(): Response {
  return error(404, ERROR_CODES.not_found);
}

export function methodNotAllowed(): Response {
  return error(405, ERROR_CODES.method_not_allowed);
}
