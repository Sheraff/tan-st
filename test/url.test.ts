import { describe, expect, it } from "vitest"

import { InvalidUrlError, mergeRedirectQuery, normalizeDestinationUrl } from "../src/url.ts"

describe("url helpers", () => {
	it("normalizes tanstack destinations across absolute and relative input forms", () => {
		expect(normalizeDestinationUrl("https://tanstack.com/docs/start?b=2&a=1")).toBe(
			"https://tanstack.com/docs/start?a=1&b=2",
		)
		expect(normalizeDestinationUrl("tanstack.com/docs/start?b=2&a=1")).toBe(
			"https://tanstack.com/docs/start?a=1&b=2",
		)
		expect(normalizeDestinationUrl("/docs/start?b=2&a=1")).toBe(
			"https://tanstack.com/docs/start?a=1&b=2",
		)
		expect(normalizeDestinationUrl("docs/start?b=2&a=1")).toBe(
			"https://tanstack.com/docs/start?a=1&b=2",
		)
	})

	it("collapses duplicate query params to the last value and strips port 443", () => {
		expect(normalizeDestinationUrl("https://tanstack.com:443/docs?foo=1&foo=2#hash")).toBe(
			"https://tanstack.com/docs?foo=2#hash",
		)
	})

	it("rejects invalid destinations", () => {
		expect(() => normalizeDestinationUrl("http://tanstack.com")).toThrow(InvalidUrlError)
		expect(() => normalizeDestinationUrl("https://www.tanstack.com")).toThrow(InvalidUrlError)
		expect(() => normalizeDestinationUrl("https://user:pass@tanstack.com")).toThrow(InvalidUrlError)
		expect(() => normalizeDestinationUrl("https://tanstack.com:444/docs")).toThrow(InvalidUrlError)
	})

	it("merges redirect query params with incoming values taking precedence", () => {
		const merged = mergeRedirectQuery(
			"https://tanstack.com/?bar=2&foo=1#section",
			new URL("https://tan.st/000a?bar=9&baz=3&baz=4"),
		)

		expect(merged).toBe("https://tanstack.com/?bar=9&foo=1&baz=4#section")
	})
})
