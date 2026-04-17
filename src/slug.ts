import { BASE62_ALPHABET, MIN_SLUG_LENGTH } from "./constants.ts";

const SLUG_PATTERN = /^[0-9A-Za-z]+$/;

export function encodeBase62(value: number): string {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error("Base62 encoding requires a non-negative integer.");
  }

  if (value === 0) {
    return BASE62_ALPHABET[0]!;
  }

  let current = value;
  let encoded = "";

  while (current > 0) {
    const remainder = current % BASE62_ALPHABET.length;
    encoded = BASE62_ALPHABET[remainder]! + encoded;
    current = Math.floor(current / BASE62_ALPHABET.length);
  }

  return encoded;
}

export function padSlug(slug: string): string {
  return slug.padStart(MIN_SLUG_LENGTH, BASE62_ALPHABET[0]);
}

export function isValidSlug(slug: string): boolean {
  return slug.length >= MIN_SLUG_LENGTH && SLUG_PATTERN.test(slug);
}

export function slugFromId(id: number): string {
  return padSlug(encodeBase62(id));
}
