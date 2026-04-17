import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";

import {
  assignSlug,
  createLink,
  deactivateLink,
  getLinkByDestinationUrl,
  getLinkBySlug,
  reactivateLink,
} from "../src/repository.ts";
import { clearState } from "./helpers.ts";

beforeEach(async () => {
  await clearState();
});

describe("repository", () => {
  it("reuses the existing row when destination inserts race", async () => {
    const first = await createLink(env, "https://tanstack.com/");
    const second = await createLink(env, "https://tanstack.com/");

    expect(first.created).toBe(true);
    expect(second).toMatchObject({
      created: false,
      link: {
        id: first.link.id,
        destinationUrl: "https://tanstack.com/",
      },
    });
  });

  it("assigns a slug once and keeps the persisted value", async () => {
    const creation = await createLink(env, "https://tanstack.com/docs");
    const assigned = await assignSlug(env, creation.link.id, "000a");
    const preserved = await assignSlug(env, creation.link.id, "000b");

    expect(assigned?.slug).toBe("000a");
    expect(preserved?.slug).toBe("000a");
    expect(await getLinkBySlug(env, "000a")).toMatchObject({
      id: creation.link.id,
      slug: "000a",
    });
  });

  it("toggles link activity without losing the stored destination", async () => {
    const creation = await createLink(env, "https://tanstack.com/router");

    await assignSlug(env, creation.link.id, "000c");

    const deactivated = await deactivateLink(env, "000c");
    const reactivated = await reactivateLink(env, "000c");
    const stored = await getLinkByDestinationUrl(env, "https://tanstack.com/router");

    expect(deactivated?.active).toBe(false);
    expect(reactivated).toMatchObject({
      active: true,
      destinationUrl: "https://tanstack.com/router",
      slug: "000c",
    });
    expect(stored?.active).toBe(true);
  });
});
