import { ERROR_CODES, SHORT_URL_ORIGIN } from "../constants.ts";
import { requireBearerToken } from "../auth.ts";
import { putActiveLink, putInactiveLink } from "../cache.ts";
import { badRequest, notFound, json } from "../http.ts";
import { assignSlug, createLink, getLinkByDestinationUrl, reactivateLink, deactivateLink, type LinkRecord } from "../repository.ts";
import { isReservedSlug, isValidSlug, slugFromId } from "../slug.ts";
import { InvalidUrlError, normalizeDestinationUrl } from "../url.ts";

interface ShortenRequestBody {
  url?: unknown;
}

function isShortenRequestBody(value: unknown): value is ShortenRequestBody {
  return typeof value === "object" && value !== null;
}

async function parseJsonBody(request: Request): Promise<unknown | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function ensureAssignedSlug(env: Env, link: LinkRecord): Promise<LinkRecord & { slug: string }> {
  if (link.slug !== null) {
    return link as LinkRecord & { slug: string };
  }

  const assigned = await assignSlug(env, link.id, slugFromId(link.id));

  if (assigned === null || assigned.slug === null) {
    throw new Error(`Failed to assign a slug for link ${link.id}.`);
  }

  return assigned as LinkRecord & { slug: string };
}

function shortenResponse(link: LinkRecord & { slug: string }, created: boolean, reactivated: boolean): Response {
  return json(
    {
      slug: link.slug,
      shortUrl: `${SHORT_URL_ORIGIN}/${link.slug}`,
      destinationUrl: link.destinationUrl,
      created,
      reactivated,
    },
    created ? 201 : 200,
  );
}

export async function handleShorten(request: Request, env: Env): Promise<Response> {
  const authFailure = requireBearerToken(request, env);

  if (authFailure !== null) {
    return authFailure;
  }

  const body = await parseJsonBody(request);

  if (!isShortenRequestBody(body) || typeof body.url !== "string" || body.url.trim().length === 0) {
    return badRequest(ERROR_CODES.invalid_request);
  }

  let destinationUrl: string;

  try {
    destinationUrl = normalizeDestinationUrl(body.url);
  } catch (error) {
    if (error instanceof InvalidUrlError) {
      return badRequest(ERROR_CODES.invalid_url);
    }

    throw error;
  }

  const existingLink = await getLinkByDestinationUrl(env, destinationUrl);

  if (existingLink !== null) {
    const linkWithSlug = await ensureAssignedSlug(env, existingLink);

    if (linkWithSlug.active) {
      await putActiveLink(env, linkWithSlug.slug, linkWithSlug.destinationUrl);
      return shortenResponse(linkWithSlug, false, false);
    }

    const reactivatedLink = await reactivateLink(env, linkWithSlug.slug);

    if (reactivatedLink === null) {
      throw new Error(`Failed to reactivate existing link ${linkWithSlug.slug}.`);
    }

    await putActiveLink(env, linkWithSlug.slug, destinationUrl);
    return shortenResponse(reactivatedLink as LinkRecord & { slug: string }, false, true);
  }

  const creation = await createLink(env, destinationUrl);
  const linkWithSlug = await ensureAssignedSlug(env, creation.link);

  if (!creation.created) {
    if (linkWithSlug.active) {
      await putActiveLink(env, linkWithSlug.slug, linkWithSlug.destinationUrl);
      return shortenResponse(linkWithSlug, false, false);
    }

    const reactivatedLink = await reactivateLink(env, linkWithSlug.slug);

    if (reactivatedLink === null) {
      throw new Error(`Failed to reactivate raced link ${linkWithSlug.slug}.`);
    }

    await putActiveLink(env, linkWithSlug.slug, destinationUrl);
    return shortenResponse(reactivatedLink as LinkRecord & { slug: string }, false, true);
  }

  await putActiveLink(env, linkWithSlug.slug, destinationUrl);
  return shortenResponse(linkWithSlug, true, false);
}

export async function handleDeactivate(request: Request, env: Env, slug: string): Promise<Response> {
  const authFailure = requireBearerToken(request, env);

  if (authFailure !== null) {
    return authFailure;
  }

  if (isReservedSlug(slug) || !isValidSlug(slug)) {
    return notFound();
  }

  const deactivatedLink = await deactivateLink(env, slug);

  if (deactivatedLink === null) {
    return notFound();
  }

  await putInactiveLink(env, slug);
  return new Response(null, { status: 204 });
}
