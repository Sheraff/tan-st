import { applyD1Migrations } from "cloudflare:test"
import { env } from "cloudflare:workers"

await applyD1Migrations(env.D1_DATABASE, env.TEST_MIGRATIONS)
