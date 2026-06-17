import { sValidator } from "@hono/standard-validator"
import { Hono } from "hono"
import { HTTPException } from "hono/http-exception"

import { methodNotAllowed, invalidRequest, invalidUrl, notFound } from "./errors.ts"
import { requireBearerToken } from "./auth.ts"
import { handleDeactivate, handleShorten } from "./handlers/api.ts"
import { handleHealth } from "./handlers/health.ts"
import { handleRedirect } from "./handlers/redirect.ts"
import { InvalidUrlError } from "./url.ts"
import { shortenRequestBodySchema, slugParamsSchema } from "./validation.ts"

const app = new Hono<{ Bindings: Env }>()

const invalidRequestHook = (
	result: { success: boolean },
	c: Parameters<typeof invalidRequest>[0],
) => {
	if (!result.success) {
		return invalidRequest(c)
	}
}

const notFoundHook = (result: { success: boolean }, c: Parameters<typeof notFound>[0]) => {
	if (!result.success) {
		return notFound(c)
	}
}

app.onError((error, c) => {
	if (error instanceof InvalidUrlError) {
		return invalidUrl(c)
	}

	if (error instanceof HTTPException) {
		return error.status === 400 ? invalidRequest(c) : error.getResponse()
	}

	console.error(error)
	return c.text("Internal Server Error", 500)
})

app.notFound(notFound)

app.get("/api/health", handleHealth)
app.all("/api/health", methodNotAllowed)

app.post(
	"/api/shorten",
	requireBearerToken,
	sValidator("json", shortenRequestBodySchema, invalidRequestHook),
	(c) => handleShorten(c, c.req.valid("json")),
)
app.all("/api/shorten", methodNotAllowed)

app.post(
	"/api/links/:slug/deactivate",
	requireBearerToken,
	sValidator("param", slugParamsSchema, notFoundHook),
	(c) => handleDeactivate(c, c.req.valid("param").slug),
)
app.all("/api/links/:slug/deactivate", methodNotAllowed)

app.get("/", () => Response.redirect("https://tanstack.com", 302))
app.all("/", methodNotAllowed)

app.get("/:slug", sValidator("param", slugParamsSchema, notFoundHook), (c) =>
	handleRedirect(c, c.req.valid("param").slug),
)
app.all("/:slug", methodNotAllowed)

export default app
