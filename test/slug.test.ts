import { describe, expect, it } from "vitest"

import { encodeBase62, isValidSlug, padSlug, slugFromId } from "../src/slug.ts"

describe("slug helpers", () => {
	it("encodes using the fixed base62 alphabet", () => {
		expect(encodeBase62(0)).toBe("0")
		expect(encodeBase62(1)).toBe("1")
		expect(encodeBase62(35)).toBe("z")
		expect(encodeBase62(36)).toBe("A")
	})

	it("pads short slugs to the minimum length", () => {
		expect(padSlug("1")).toBe("0001")
		expect(padSlug("z")).toBe("000z")
	})

	it("validates base62 slugs with the minimum length", () => {
		expect(isValidSlug("000a")).toBe(true)
		expect(isValidSlug("abc")).toBe(false)
		expect(isValidSlug("ab.c")).toBe(false)
	})

	it("derives generated slugs directly from the padded id encoding", () => {
		expect(slugFromId(1)).toBe("0001")
		expect(slugFromId(35)).toBe("000z")
		expect(slugFromId(36)).toBe("000A")
		expect(slugFromId(150947331)).toBe("admin")
	})
})
