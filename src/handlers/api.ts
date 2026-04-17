import type { Context } from "hono"

import { SHORT_URL_ORIGIN } from "../constants.ts"
import { putActiveLink, putInactiveLink } from "../cache.ts"
import { notFound } from "../errors.ts"
import {
	assignSlug,
	createLink,
	getLinkByDestinationUrl,
	reactivateLink,
	deactivateLink,
	type LinkRecord,
} from "../repository.ts"
import { slugFromId } from "../slug.ts"
import { normalizeDestinationUrl } from "../url.ts"
import type { ShortenRequestBody } from "../validation.ts"

type AppContext = Context<{ Bindings: Env }>
type LinkWithSlug = LinkRecord & { slug: string }

async function ensureAssignedSlug(env: Env, link: LinkRecord): Promise<LinkWithSlug> {
	if (link.slug !== null) {
		return link as LinkWithSlug
	}

	const assigned = await assignSlug(env, link.id, slugFromId(link.id))

	if (assigned === undefined || assigned.slug === null) {
		throw new Error(`Failed to assign a slug for link ${link.id}.`)
	}

	return assigned as LinkWithSlug
}

function shortenResponse(
	c: AppContext,
	link: LinkWithSlug,
	created: boolean,
	reactivated: boolean,
): Response {
	return c.json(
		{
			slug: link.slug,
			shortUrl: `${SHORT_URL_ORIGIN}/${link.slug}`,
			destinationUrl: link.destinationUrl,
			created,
			reactivated,
		},
		created ? 201 : 200,
	)
}

export async function handleShorten(c: AppContext, body: ShortenRequestBody): Promise<Response> {
	const destinationUrl = normalizeDestinationUrl(body.url)
	const existingLink = await getLinkByDestinationUrl(c.env, destinationUrl)

	if (existingLink !== undefined) {
		const linkWithSlug = await ensureAssignedSlug(c.env, existingLink)

		if (linkWithSlug.active) {
			await putActiveLink(c.env, linkWithSlug.slug, linkWithSlug.destinationUrl)
			return shortenResponse(c, linkWithSlug, false, false)
		}

		const reactivatedLink = await reactivateLink(c.env, linkWithSlug.slug)

		if (reactivatedLink === undefined) {
			throw new Error(`Failed to reactivate existing link ${linkWithSlug.slug}.`)
		}

		await putActiveLink(c.env, linkWithSlug.slug, destinationUrl)
		return shortenResponse(c, reactivatedLink as LinkWithSlug, false, true)
	}

	const creation = await createLink(c.env, destinationUrl)
	const linkWithSlug = await ensureAssignedSlug(c.env, creation.link)

	if (!creation.created) {
		if (linkWithSlug.active) {
			await putActiveLink(c.env, linkWithSlug.slug, linkWithSlug.destinationUrl)
			return shortenResponse(c, linkWithSlug, false, false)
		}

		const reactivatedLink = await reactivateLink(c.env, linkWithSlug.slug)

		if (reactivatedLink === undefined) {
			throw new Error(`Failed to reactivate raced link ${linkWithSlug.slug}.`)
		}

		await putActiveLink(c.env, linkWithSlug.slug, destinationUrl)
		return shortenResponse(c, reactivatedLink as LinkWithSlug, false, true)
	}

	await putActiveLink(c.env, linkWithSlug.slug, destinationUrl)
	return shortenResponse(c, linkWithSlug, true, false)
}

export async function handleDeactivate(c: AppContext, slug: string): Promise<Response> {
	const deactivatedLink = await deactivateLink(c.env, slug)

	if (deactivatedLink === undefined) {
		return notFound(c)
	}

	await putInactiveLink(c.env, slug)
	return c.body(null, 204)
}
