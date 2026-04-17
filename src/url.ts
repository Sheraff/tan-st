function getLastQueryValues(searchParams: URLSearchParams): Map<string, string> {
  const values = new Map<string, string>();

  for (const [key, value] of searchParams) {
    values.set(key, value);
  }

  return values;
}

export class InvalidUrlError extends Error {
  constructor() {
    super("Invalid destination URL.");
  }
}

export function normalizeDestinationUrl(input: string): string {
  const trimmed = input.trim();

  if (trimmed.length === 0) {
    throw new InvalidUrlError();
  }

  const candidate = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;

  let url: URL;

  try {
    url = new URL(candidate);
  } catch {
    throw new InvalidUrlError();
  }

  if (url.protocol !== "https:" || url.hostname !== "tanstack.com" || url.username !== "" || url.password !== "") {
    throw new InvalidUrlError();
  }

  if (url.port !== "" && url.port !== "443") {
    throw new InvalidUrlError();
  }

  url.port = "";

  const normalizedParams = new URLSearchParams();
  const entries = [...getLastQueryValues(url.searchParams).entries()].sort(([left], [right]) => left.localeCompare(right));

  for (const [key, value] of entries) {
    normalizedParams.set(key, value);
  }

  url.search = normalizedParams.toString();

  return url.toString();
}

export function mergeRedirectQuery(destinationUrl: string, requestUrl: URL): string {
  const destination = new URL(destinationUrl);

  for (const [key, value] of getLastQueryValues(requestUrl.searchParams)) {
    destination.searchParams.set(key, value);
  }

  return destination.toString();
}
