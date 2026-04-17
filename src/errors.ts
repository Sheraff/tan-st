import type { Context } from "hono"

import { ERROR_CODES, type ErrorCode } from "./constants.ts"

type AppContext = Context<{ Bindings: Env }>

function errorResponse(c: AppContext, status: 400 | 401 | 404 | 405, code: ErrorCode): Response {
	return c.json({ error: code }, status)
}

export function invalidRequest(c: AppContext): Response {
	return errorResponse(c, 400, ERROR_CODES.invalid_request)
}

export function invalidUrl(c: AppContext): Response {
	return errorResponse(c, 400, ERROR_CODES.invalid_url)
}

export function unauthorized(c: AppContext): Response {
	return errorResponse(c, 401, ERROR_CODES.unauthorized)
}

export function notFound(c: AppContext): Response {
	return errorResponse(c, 404, ERROR_CODES.not_found)
}

export function methodNotAllowed(c: AppContext): Response {
	return errorResponse(c, 405, ERROR_CODES.method_not_allowed)
}
