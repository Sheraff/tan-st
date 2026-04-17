import { json } from "../http.ts";

export function handleHealth(): Response {
  return json({ ok: true });
}
