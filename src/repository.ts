const SELECT_COLUMNS = `
  id,
  slug,
  destination_url,
  active,
  created_at,
  updated_at
`;

interface LinkRow {
  id: number;
  slug: string | null;
  destination_url: string;
  active: number;
  created_at: string;
  updated_at: string;
}

export interface LinkRecord {
  id: number;
  slug: string | null;
  destinationUrl: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLinkResult {
  created: boolean;
  link: LinkRecord;
}

function toLinkRecord(row: LinkRow | null): LinkRecord | null {
  if (row === null) {
    return null;
  }

  return {
    id: row.id,
    slug: row.slug,
    destinationUrl: row.destination_url,
    active: row.active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getLinkById(env: Env, id: number): Promise<LinkRecord | null> {
  const row = await env.D1_DATABASE.prepare(`SELECT ${SELECT_COLUMNS} FROM links WHERE id = ? LIMIT 1`)
    .bind(id)
    .first<LinkRow>();

  return toLinkRecord(row ?? null);
}

export async function getLinkBySlug(env: Env, slug: string): Promise<LinkRecord | null> {
  const row = await env.D1_DATABASE.prepare(`SELECT ${SELECT_COLUMNS} FROM links WHERE slug = ? LIMIT 1`)
    .bind(slug)
    .first<LinkRow>();

  return toLinkRecord(row ?? null);
}

export async function getLinkByDestinationUrl(env: Env, destinationUrl: string): Promise<LinkRecord | null> {
  const row = await env.D1_DATABASE.prepare(`SELECT ${SELECT_COLUMNS} FROM links WHERE destination_url = ? LIMIT 1`)
    .bind(destinationUrl)
    .first<LinkRow>();

  return toLinkRecord(row ?? null);
}

export async function createLink(env: Env, destinationUrl: string): Promise<CreateLinkResult> {
  // Let the unique destination_url constraint decide races, then re-read the winner on conflict.
  const insertedRow = await env.D1_DATABASE.prepare(
    `
      INSERT INTO links (slug, destination_url)
      VALUES (NULL, ?)
      ON CONFLICT(destination_url) DO NOTHING
      RETURNING ${SELECT_COLUMNS}
    `,
  )
    .bind(destinationUrl)
    .first<LinkRow>();

  if (insertedRow !== null) {
    return {
      created: true,
      link: toLinkRecord(insertedRow)!,
    };
  }

  const existingLink = await getLinkByDestinationUrl(env, destinationUrl);

  if (existingLink === null) {
    throw new Error("Expected link to exist after destination_url insert conflict.");
  }

  return {
    created: false,
    link: existingLink,
  };
}

export async function assignSlug(env: Env, id: number, slug: string): Promise<LinkRecord | null> {
  const row = await env.D1_DATABASE.prepare(
    `
      UPDATE links
      SET slug = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND slug IS NULL
      RETURNING ${SELECT_COLUMNS}
    `,
  )
    .bind(slug, id)
    .first<LinkRow>();

  if (row !== null) {
    return toLinkRecord(row);
  }

  return getLinkById(env, id);
}

export async function reactivateLink(env: Env, slug: string): Promise<LinkRecord | null> {
  const row = await env.D1_DATABASE.prepare(
    `
      UPDATE links
      SET active = 1, updated_at = CURRENT_TIMESTAMP
      WHERE slug = ?
      RETURNING ${SELECT_COLUMNS}
    `,
  )
    .bind(slug)
    .first<LinkRow>();

  return toLinkRecord(row ?? null);
}

export async function deactivateLink(env: Env, slug: string): Promise<LinkRecord | null> {
  const row = await env.D1_DATABASE.prepare(
    `
      UPDATE links
      SET active = 0, updated_at = CURRENT_TIMESTAMP
      WHERE slug = ?
      RETURNING ${SELECT_COLUMNS}
    `,
  )
    .bind(slug)
    .first<LinkRow>();

  return toLinkRecord(row ?? null);
}
