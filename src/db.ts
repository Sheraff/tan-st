import { drizzle } from "drizzle-orm/d1";

import * as schema from "./schema.ts";

export function getDb(env: Env) {
  return drizzle(env.D1_DATABASE, { schema });
}
