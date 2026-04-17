import { getCachedLink, putActiveLink, putInactiveLink } from "../cache.ts";
import { notFound } from "../http.ts";
import { getLinkBySlug } from "../repository.ts";
import { isReservedSlug, isValidSlug } from "../slug.ts";
import { mergeRedirectQuery } from "../url.ts";

export async function handleRedirect(request: Request, env: Env, slug: string): Promise<Response> {
  if (isReservedSlug(slug) || !isValidSlug(slug)) {
    return notFound();
  }

  const requestUrl = new URL(request.url);
  const cachedLink = await getCachedLink(env, slug);

  if (cachedLink !== null) {
    if (!cachedLink.active) {
      return notFound();
    }

    return Response.redirect(mergeRedirectQuery(cachedLink.destinationUrl, requestUrl), 302);
  }

  const link = await getLinkBySlug(env, slug);

  if (link === null || !link.active || link.slug === null) {
    await putInactiveLink(env, slug);
    return notFound();
  }

  await putActiveLink(env, slug, link.destinationUrl);
  return Response.redirect(mergeRedirectQuery(link.destinationUrl, requestUrl), 302);
}
