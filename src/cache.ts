import * as v from "valibot"

import { KV_KEY_PREFIX } from "./constants.ts"

const cachedLinkSchema = v.union([
	v.object({ active: v.literal(false) }),
	v.object({ active: v.literal(true), destinationUrl: v.string() }),
])

export type CachedLink = v.InferOutput<typeof cachedLinkSchema>

function cacheKey(slug: string): string {
	return `${KV_KEY_PREFIX}${slug}`
}

export async function getCachedLink(env: Env, slug: string): Promise<CachedLink | null> {
	const cached = await env.LINKS_KV.get(cacheKey(slug), "json")
	const result = v.safeParse(cachedLinkSchema, cached)

	if (!result.success) {
		return null
	}

	return result.output
}

export async function putActiveLink(env: Env, slug: string, destinationUrl: string): Promise<void> {
	await env.LINKS_KV.put(cacheKey(slug), JSON.stringify({ active: true, destinationUrl }))
}

export async function putInactiveLink(env: Env, slug: string): Promise<void> {
	await env.LINKS_KV.put(cacheKey(slug), JSON.stringify({ active: false }))
}
