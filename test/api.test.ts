import { env, exports } from "cloudflare:workers"
import { beforeEach, describe, expect, it } from "vitest"

import { clearState, deactivate, readJson, shorten, type ShortenResponseBody } from "./helpers.ts"

beforeEach(async () => {
	await clearState()
})

describe("api routes", () => {
	it("returns health without authentication", async () => {
		const response = await exports.default.fetch("https://tan.st/api/health")

		expect(response.status).toBe(200)
		expect(await readJson<{ ok: boolean }>(response)).toEqual({ ok: true })
	})

	it("rejects unauthorized shorten requests", async () => {
		const response = await exports.default.fetch("https://tan.st/api/shorten", {
			method: "POST",
			headers: {
				"content-type": "application/json",
			},
			body: JSON.stringify({ url: "tanstack.com" }),
		})

		expect(response.status).toBe(401)
		expect(await readJson<{ error: string }>(response)).toEqual({ error: "unauthorized" })
	})

	it("rejects unauthorized deactivate requests", async () => {
		const response = await deactivate("000a", "wrong-token")

		expect(response.status).toBe(401)
		expect(await readJson<{ error: string }>(response)).toEqual({ error: "unauthorized" })
	})

	it("returns invalid_request when the shorten body fails validation", async () => {
		const response = await exports.default.fetch("https://tan.st/api/shorten", {
			method: "POST",
			headers: {
				authorization: `Bearer ${env.SHORTENER_API_TOKEN}`,
				"content-type": "application/json",
			},
			body: JSON.stringify({}),
		})

		expect(response.status).toBe(400)
		expect(await readJson<{ error: string }>(response)).toEqual({ error: "invalid_request" })
	})

	it("returns invalid_request for malformed JSON request bodies", async () => {
		const response = await exports.default.fetch("https://tan.st/api/shorten", {
			method: "POST",
			headers: {
				authorization: `Bearer ${env.SHORTENER_API_TOKEN}`,
				"content-type": "application/json",
			},
			body: '{"url":',
		})

		expect(response.status).toBe(400)
		expect(await readJson<{ error: string }>(response)).toEqual({ error: "invalid_request" })
	})

	it("returns not_found when deactivate slug params fail validation", async () => {
		const response = await exports.default.fetch("https://tan.st/api/links/abc/deactivate", {
			method: "POST",
			headers: {
				authorization: `Bearer ${env.SHORTENER_API_TOKEN}`,
			},
		})

		expect(response.status).toBe(404)
		expect(await readJson<{ error: string }>(response)).toEqual({ error: "not_found" })
	})

	it("normalizes destinations and reuses the same slug for canonical matches", async () => {
		const createdResponse = await shorten("tanstack.com?b=2&a=1")
		const createdBody = await readJson<ShortenResponseBody>(createdResponse)

		expect(createdResponse.status).toBe(201)
		expect(createdBody).toMatchObject({
			destinationUrl: "https://tanstack.com/?a=1&b=2",
			shortUrl: `https://tan.st/${createdBody.slug}`,
			created: true,
			reactivated: false,
		})

		const existingResponse = await shorten("https://tanstack.com/?a=1&b=2")
		const existingBody = await readJson<ShortenResponseBody>(existingResponse)

		expect(existingResponse.status).toBe(200)
		expect(existingBody).toMatchObject({
			slug: createdBody.slug,
			destinationUrl: "https://tanstack.com/?a=1&b=2",
			created: false,
			reactivated: false,
		})
	})

	it("accepts tanstack destinations with or without an origin", async () => {
		const createdResponse = await shorten("/docs/start?b=2&a=1")
		const createdBody = await readJson<ShortenResponseBody>(createdResponse)

		expect(createdResponse.status).toBe(201)
		expect(createdBody).toMatchObject({
			destinationUrl: "https://tanstack.com/docs/start?a=1&b=2",
			shortUrl: `https://tan.st/${createdBody.slug}`,
			created: true,
			reactivated: false,
		})

		for (const input of [
			"docs/start?a=1&b=2",
			"tanstack.com/docs/start?a=1&b=2",
			"https://tanstack.com/docs/start?a=1&b=2",
		]) {
			const response = await shorten(input)
			const body = await readJson<ShortenResponseBody>(response)

			expect(response.status).toBe(200)
			expect(body).toMatchObject({
				slug: createdBody.slug,
				destinationUrl: "https://tanstack.com/docs/start?a=1&b=2",
				created: false,
				reactivated: false,
			})
		}
	})

	it("reactivates inactive links with the same slug", async () => {
		const createdResponse = await shorten("tanstack.com/docs?foo=1")
		const createdBody = await readJson<ShortenResponseBody>(createdResponse)

		expect((await deactivate(createdBody.slug)).status).toBe(204)

		const reactivatedResponse = await shorten("https://tanstack.com/docs?foo=1")
		const reactivatedBody = await readJson<ShortenResponseBody>(reactivatedResponse)

		expect(reactivatedResponse.status).toBe(200)
		expect(reactivatedBody).toMatchObject({
			slug: createdBody.slug,
			created: false,
			reactivated: true,
		})
	})
})
