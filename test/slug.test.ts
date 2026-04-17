import { describe, expect, it } from "vitest";

import { encodeBase62, isReservedSlug, padSlug, slugFromId } from "../src/slug.ts";

describe("slug helpers", () => {
  it("encodes using the fixed base62 alphabet", () => {
    expect(encodeBase62(0)).toBe("0");
    expect(encodeBase62(1)).toBe("1");
    expect(encodeBase62(35)).toBe("z");
    expect(encodeBase62(36)).toBe("A");
  });

  it("pads short slugs to the minimum length", () => {
    expect(padSlug("1")).toBe("0001");
    expect(padSlug("z")).toBe("000z");
  });

  it("checks reserved slugs case-insensitively", () => {
    expect(isReservedSlug("API")).toBe(true);
    expect(isReservedSlug("health")).toBe(true);
    expect(isReservedSlug("abcd")).toBe(false);
  });

  it("prefixes reserved generated slugs with extra zeroes", () => {
    expect(slugFromId(1)).toBe("0001");
    expect(slugFromId(35)).toBe("000z");
    expect(slugFromId(36)).toBe("000A");
    expect(slugFromId(150947331)).toBe("0admin");
  });
});
