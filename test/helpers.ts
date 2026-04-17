import { env, exports } from "cloudflare:workers";

export interface ShortenResponseBody {
  slug: string;
  shortUrl: string;
  destinationUrl: string;
  created: boolean;
  reactivated: boolean;
}

export async function clearState(): Promise<void> {
  await env.D1_DATABASE.exec("DELETE FROM links");

  let cursor: string | undefined;

  do {
    const page = await env.LINKS_KV.list({ cursor });
    await Promise.all(page.keys.map(({ name }) => env.LINKS_KV.delete(name)));
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor !== undefined);
}

export async function shorten(url: string, token = env.SHORTENER_API_TOKEN): Promise<Response> {
  return exports.default.fetch("https://tan.st/api/shorten", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ url }),
  });
}

export async function deactivate(slug: string, token = env.SHORTENER_API_TOKEN): Promise<Response> {
  return exports.default.fetch(`https://tan.st/api/links/${slug}/deactivate`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
}

export async function readJson<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}
