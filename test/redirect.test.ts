import { env, exports } from "cloudflare:workers";
import { createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

import worker from "../src/index.ts";
import { clearState, deactivate, readJson, shorten, type ShortenResponseBody } from "./helpers.ts";

async function dispatch(
  url: string,
  init?: RequestInit<RequestInitCfProperties>,
): Promise<Response> {
  const request = new Request(url, init);
  const ctx = createExecutionContext();
  const response = await worker.fetch(request, env, ctx);

  await waitOnExecutionContext(ctx);

  return response;
}

beforeEach(async () => {
  await clearState();
});

describe("redirect behavior", () => {
  it("redirects directly from an active KV hit", async () => {
    await env.LINKS_KV.put(
      "slug:000a",
      JSON.stringify({ active: true, destinationUrl: "https://tanstack.com/?foo=1" }),
    );

    const response = await dispatch("https://tan.st/000a?bar=2");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://tanstack.com/?foo=1&bar=2");
  });

  it("falls back to D1 on a KV miss and repopulates the cache", async () => {
    await env.D1_DATABASE.prepare(
      "INSERT INTO links (slug, destination_url, active) VALUES (?, ?, 1)",
    )
      .bind("000b", "https://tanstack.com/?a=1")
      .run();

    const response = await dispatch("https://tan.st/000b?b=2");
    const cached = await env.LINKS_KV.get("slug:000b", "json");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("https://tanstack.com/?a=1&b=2");
    expect(cached).toEqual({ active: true, destinationUrl: "https://tanstack.com/?a=1" });
  });

  it("writes an inactive tombstone and returns not found after deactivation", async () => {
    const createdResponse = await shorten("tanstack.com/docs/framework?foo=1");
    const createdBody = await readJson<ShortenResponseBody>(createdResponse);

    expect((await deactivate(createdBody.slug)).status).toBe(204);
    expect(await env.LINKS_KV.get(`slug:${createdBody.slug}`, "json")).toEqual({ active: false });

    const response = await dispatch(`https://tan.st/${createdBody.slug}`);

    expect(response.status).toBe(404);
    expect(await readJson<{ error: string }>(response)).toEqual({ error: "not_found" });
  });

  it("returns not_found when redirect slug params fail validation", async () => {
    const response = await dispatch("https://tan.st/abc");

    expect(response.status).toBe(404);
    expect(await readJson<{ error: string }>(response)).toEqual({ error: "not_found" });
  });

  it("returns method not allowed for unsupported endpoint methods", async () => {
    const response = await exports.default.fetch("https://tan.st/api/shorten", { method: "GET" });

    expect(response.status).toBe(405);
    expect(await readJson<{ error: string }>(response)).toEqual({ error: "method_not_allowed" });
  });
});
