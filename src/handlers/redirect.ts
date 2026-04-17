import type { Context } from "hono";

import { getCachedLink, putActiveLink, putInactiveLink } from "../cache.ts";
import { notFound } from "../errors.ts";
import { getLinkBySlug } from "../repository.ts";
import { mergeRedirectQuery } from "../url.ts";

export async function handleRedirect(
  c: Context<{ Bindings: Env }>,
  slug: string,
): Promise<Response> {
  const requestUrl = new URL(c.req.url);
  const cachedLink = await getCachedLink(c.env, slug);

  if (cachedLink !== null) {
    if (!cachedLink.active) {
      return notFound(c);
    }

    return Response.redirect(mergeRedirectQuery(cachedLink.destinationUrl, requestUrl), 302);
  }

  const link = await getLinkBySlug(c.env, slug);

  if (link === undefined || !link.active || link.slug === null) {
    await putInactiveLink(c.env, slug);
    return notFound(c);
  }

  await putActiveLink(c.env, slug, link.destinationUrl);
  return Response.redirect(mergeRedirectQuery(link.destinationUrl, requestUrl), 302);
}
