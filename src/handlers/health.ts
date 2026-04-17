import type { Context } from "hono"

export function handleHealth(c: Context<{ Bindings: Env }>): Response {
	return c.json({ ok: true })
}
