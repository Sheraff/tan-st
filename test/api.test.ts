import { exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import { clearState, deactivate, readJson, shorten, type ShortenResponseBody } from "./helpers.ts";

beforeEach(async () => {
  await clearState();
});

describe("api routes", () => {
  it("returns health without authentication", async () => {
    const response = await exports.default.fetch("https://tan.st/health");

    expect(response.status).toBe(200);
    expect(await readJson<{ ok: boolean }>(response)).toEqual({ ok: true });
  });

  it("rejects unauthorized shorten requests", async () => {
    const response = await exports.default.fetch("https://tan.st/api/shorten", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ url: "tanstack.com" }),
    });

    expect(response.status).toBe(401);
    expect(await readJson<{ error: string }>(response)).toEqual({ error: "unauthorized" });
  });

  it("normalizes destinations and reuses the same slug for canonical matches", async () => {
    const createdResponse = await shorten("tanstack.com?b=2&a=1");
    const createdBody = await readJson<ShortenResponseBody>(createdResponse);

    expect(createdResponse.status).toBe(201);
    expect(createdBody).toMatchObject({
      destinationUrl: "https://tanstack.com/?a=1&b=2",
      shortUrl: `https://tan.st/${createdBody.slug}`,
      created: true,
      reactivated: false,
    });

    const existingResponse = await shorten("https://tanstack.com/?a=1&b=2");
    const existingBody = await readJson<ShortenResponseBody>(existingResponse);

    expect(existingResponse.status).toBe(200);
    expect(existingBody).toMatchObject({
      slug: createdBody.slug,
      destinationUrl: "https://tanstack.com/?a=1&b=2",
      created: false,
      reactivated: false,
    });
  });

  it("reactivates inactive links with the same slug", async () => {
    const createdResponse = await shorten("tanstack.com/docs?foo=1");
    const createdBody = await readJson<ShortenResponseBody>(createdResponse);

    expect((await deactivate(createdBody.slug)).status).toBe(204);

    const reactivatedResponse = await shorten("https://tanstack.com/docs?foo=1");
    const reactivatedBody = await readJson<ShortenResponseBody>(reactivatedResponse);

    expect(reactivatedResponse.status).toBe(200);
    expect(reactivatedBody).toMatchObject({
      slug: createdBody.slug,
      created: false,
      reactivated: true,
    });
  });
});
