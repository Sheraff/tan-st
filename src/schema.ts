import { sql } from "drizzle-orm"
import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"

export const links = sqliteTable(
	"links",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		slug: text("slug").unique(),
		destinationUrl: text("destination_url").notNull().unique(),
		active: integer("active", { mode: "boolean" }).notNull().default(true),
		createdAt: text("created_at")
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
		updatedAt: text("updated_at")
			.notNull()
			.default(sql`CURRENT_TIMESTAMP`),
	},
	(table) => [
		check("links_active_check", sql`${table.active} in (0, 1)`),
		index("idx_links_slug_active").on(table.slug, table.active),
	],
)
