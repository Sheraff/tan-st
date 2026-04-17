import { KV_KEY_PREFIX } from "./constants.ts";

export type CachedLink =
  | { active: true; destinationUrl: string }
  | { active: false };

function cacheKey(slug: string): string {
  return `${KV_KEY_PREFIX}${slug}`;
}

export async function getCachedLink(env: Env, slug: string): Promise<CachedLink | null> {
  const cached = await env.LINKS_KV.get(cacheKey(slug), "json");

  if (cached === null || typeof cached !== "object") {
    return null;
  }

  if ((cached as { active?: unknown }).active === false) {
    return { active: false };
  }

  if (
    (cached as { active?: unknown }).active === true &&
    typeof (cached as { destinationUrl?: unknown }).destinationUrl === "string"
  ) {
    return {
      active: true,
      destinationUrl: (cached as { destinationUrl: string }).destinationUrl,
    };
  }

  return null;
}

export async function putActiveLink(env: Env, slug: string, destinationUrl: string): Promise<void> {
  await env.LINKS_KV.put(cacheKey(slug), JSON.stringify({ active: true, destinationUrl }));
}

export async function putInactiveLink(env: Env, slug: string): Promise<void> {
  await env.LINKS_KV.put(cacheKey(slug), JSON.stringify({ active: false }));
}
