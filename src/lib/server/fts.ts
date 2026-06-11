import { eq, sql } from "drizzle-orm";

import { db } from "#/db/index.ts";
import { bookmarks, bookmarkTags, tags } from "#/db/schema.ts";
import { buildFtsQuery } from "#/lib/shared/fts-query.ts";

// bookmarks_fts is maintained from application code (not triggers) because
// the `tags` column is a join. Call after any write that changes a
// bookmark's title/summary/description, its tags, or its visibility.
export function syncBookmarkFts(bookmarkId: number) {
	db.run(sql`DELETE FROM bookmarks_fts WHERE rowid = ${bookmarkId}`);

	const [bookmark] = db
		.select()
		.from(bookmarks)
		.where(eq(bookmarks.id, bookmarkId))
		.all();
	if (!bookmark || bookmark.deletedAt !== null || bookmark.archived) return;

	const tagNames = db
		.select({ name: tags.name })
		.from(bookmarkTags)
		.innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
		.where(eq(bookmarkTags.bookmarkId, bookmarkId))
		.all()
		.map((row) => row.name)
		.join(" ");

	db.run(
		sql`INSERT INTO bookmarks_fts (rowid, title, summary, description, tags)
			VALUES (${bookmarkId}, ${bookmark.title ?? ""}, ${bookmark.summary ?? ""}, ${bookmark.description ?? ""}, ${tagNames})`,
	);
}

export function searchBookmarkIds(userId: string, query: string): Set<number> {
	const match = buildFtsQuery(query);
	if (!match) return new Set();
	const rows = db.all<{ id: number }>(
		sql`SELECT b.id AS id
			FROM bookmarks_fts f
			JOIN bookmarks b ON b.id = f.rowid
			WHERE bookmarks_fts MATCH ${match} AND b.user_id = ${userId}`,
	);
	return new Set(rows.map((row) => row.id));
}
