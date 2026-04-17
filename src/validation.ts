import * as v from "valibot"

import { isValidSlug } from "./slug.ts"

export const shortenRequestBodySchema = v.object({
	url: v.pipe(
		v.string(),
		v.check((value) => value.trim().length > 0, "URL is required."),
	),
})

export const slugParamsSchema = v.object({
	slug: v.pipe(v.string(), v.check(isValidSlug, "Slug must be base62 and at least 4 characters.")),
})

export type ShortenRequestBody = v.InferOutput<typeof shortenRequestBodySchema>
export type SlugParams = v.InferOutput<typeof slugParamsSchema>
