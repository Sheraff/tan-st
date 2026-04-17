export const BASE62_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
export const MIN_SLUG_LENGTH = 4
export const KV_KEY_PREFIX = "slug:"
export const SHORT_URL_ORIGIN = "https://tan.st"
export const AUTHORIZATION_SCHEME = "Bearer"

export const ERROR_CODES = {
	invalid_url: "invalid_url",
	invalid_request: "invalid_request",
	unauthorized: "unauthorized",
	not_found: "not_found",
	method_not_allowed: "method_not_allowed",
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]
