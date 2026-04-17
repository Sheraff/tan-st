import { and, eq, isNull, sql } from "drizzle-orm";

import { getDb } from "./db.ts";
import { links } from "./schema.ts";

export type LinkRecord = typeof links.$inferSelect;

export interface CreateLinkResult {
  created: boolean;
  link: LinkRecord;
}

function getLinkById(env: Env, id: number) {
  return getDb(env).select().from(links).where(eq(links.id, id)).limit(1).get();
}

export function getLinkBySlug(env: Env, slug: string) {
  return getDb(env).select().from(links).where(eq(links.slug, slug)).limit(1).get();
}

export function getLinkByDestinationUrl(env: Env, destinationUrl: string) {
  return getDb(env)
    .select()
    .from(links)
    .where(eq(links.destinationUrl, destinationUrl))
    .limit(1)
    .get();
}

export async function createLink(env: Env, destinationUrl: string): Promise<CreateLinkResult> {
  // Let the unique destination_url constraint decide races, then re-read the winner on conflict.
  const insertedLink = await getDb(env)
    .insert(links)
    .values({ destinationUrl })
    .onConflictDoNothing({ target: links.destinationUrl })
    .returning()
    .get();

  if (insertedLink !== undefined) {
    return {
      created: true,
      link: insertedLink,
    };
  }

  const existingLink = await getLinkByDestinationUrl(env, destinationUrl);

  if (existingLink === undefined) {
    throw new Error("Expected link to exist after destination_url insert conflict.");
  }

  return {
    created: false,
    link: existingLink,
  };
}

export async function assignSlug(env: Env, id: number, slug: string) {
  const updatedLink = await getDb(env)
    .update(links)
    .set({ slug, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(and(eq(links.id, id), isNull(links.slug)))
    .returning()
    .get();

  return updatedLink ?? getLinkById(env, id);
}

export function reactivateLink(env: Env, slug: string) {
  return getDb(env)
    .update(links)
    .set({ active: true, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(links.slug, slug))
    .returning()
    .get();
}

export function deactivateLink(env: Env, slug: string) {
  return getDb(env)
    .update(links)
    .set({ active: false, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(links.slug, slug))
    .returning()
    .get();
}
