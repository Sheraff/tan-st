import { methodNotAllowed, notFound } from "./http.ts";
import { handleDeactivate, handleShorten } from "./handlers/api.ts";
import { handleHealth } from "./handlers/health.ts";
import { handleRedirect } from "./handlers/redirect.ts";

const SINGLE_SEGMENT_PATH = /^\/([^/]+)$/;
const DEACTIVATE_PATH = /^\/api\/links\/([^/]+)\/deactivate$/;

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/health") {
      return request.method === "GET" ? handleHealth() : methodNotAllowed();
    }

    if (pathname === "/api/shorten") {
      return request.method === "POST" ? handleShorten(request, env) : methodNotAllowed();
    }

    const deactivateMatch = DEACTIVATE_PATH.exec(pathname);

    if (deactivateMatch !== null) {
      const slug = deactivateMatch[1]!;

      return request.method === "POST"
        ? handleDeactivate(request, env, slug)
        : methodNotAllowed();
    }

    if (pathname === "/") {
      return notFound();
    }

    const redirectMatch = SINGLE_SEGMENT_PATH.exec(pathname);

    if (redirectMatch !== null) {
      const slug = redirectMatch[1]!;

      return request.method === "GET"
        ? handleRedirect(request, env, slug)
        : methodNotAllowed();
    }

    return notFound();
  },
} satisfies ExportedHandler<Env>;
