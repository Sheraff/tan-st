import type { MiddlewareHandler } from "hono"
import { bearerAuth } from "hono/bearer-auth"
import { HTTPException } from "hono/http-exception"

import { unauthorized } from "./errors.ts"

const bearerTokenAuth = bearerAuth({
	verifyToken: async (token, c) => token === c.env.SHORTENER_API_TOKEN,
})

export const requireBearerToken: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
	try {
		await bearerTokenAuth(c, next)
	} catch (error) {
		if (error instanceof HTTPException && error.getResponse().headers.has("WWW-Authenticate")) {
			return unauthorized(c)
		}

		throw error
	}
}
