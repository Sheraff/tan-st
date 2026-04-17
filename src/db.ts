import { drizzle } from "drizzle-orm/d1"

import * as schema from "./schema.ts"

function createDb(database: Env["D1_DATABASE"]) {
	return drizzle(database, { schema })
}

const dbCache = new WeakMap<Env["D1_DATABASE"], ReturnType<typeof createDb>>()

export function getDb(env: Env) {
	const existing = dbCache.get(env.D1_DATABASE)

	if (existing !== undefined) {
		return existing
	}

	const db = createDb(env.D1_DATABASE)
	dbCache.set(env.D1_DATABASE, db)
	return db
}
