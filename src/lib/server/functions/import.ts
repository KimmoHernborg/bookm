import { createServerFn } from "@tanstack/react-start";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "#/db/index.ts";
import { bookmarks, bookmarkTags } from "#/db/schema.ts";
import { syncBookmarkFts } from "#/lib/server/fts.ts";
import { parseNetscapeBookmarks } from "#/lib/server/import/netscape.ts";
import { resolveTagIds } from "#/lib/server/jobs/handlers.ts";
import { enqueueJob } from "#/lib/server/jobs/queue.ts";
import { log } from "#/lib/server/log.ts";
import { requireUser } from "#/lib/server/session.ts";
import { canonicalizeUrl } from "#/lib/shared/url.ts";

export type ImportSummary = {
	imported: number;
	skippedDuplicates: number;
	invalid: number;
};

export const importNetscape = createServerFn({ method: "POST" })
	.inputValidator((data: { html: string }) =>
		z.object({ html: z.string().min(1).max(20_000_000) }).parse(data),
	)
	.handler(async ({ data }): Promise<ImportSummary> => {
		const user = await requireUser();
		const parsed = parseNetscapeBookmarks(data.html);

		// Track existing rows by canonical URL along with their soft-delete
		// state: only active rows are true duplicates; a soft-deleted row is
		// restored on re-import (mirroring addBookmark), not skipped.
		const existing = new Map<string, { id: number; deletedAt: Date | null }>();
		for (const row of db
			.select({
				id: bookmarks.id,
				urlCanonical: bookmarks.urlCanonical,
				deletedAt: bookmarks.deletedAt,
			})
			.from(bookmarks)
			.where(eq(bookmarks.userId, user.id))
			.all()) {
			existing.set(row.urlCanonical, { id: row.id, deletedAt: row.deletedAt });
		}

		let imported = 0;
		let skippedDuplicates = 0;
		let invalid = 0;

		// Folder names become tags right away; the LLM adds more later.
		type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
		function linkFolderTags(
			tx: Tx,
			bookmarkId: number,
			folders: Array<string>,
		) {
			const tagIds = resolveTagIds(user.id, folders);
			if (tagIds.length > 0) {
				tx.insert(bookmarkTags)
					.values(
						tagIds.map((tagId) => ({
							bookmarkId,
							tagId,
							userId: user.id,
						})),
					)
					.onConflictDoNothing()
					.run();
			}
		}

		for (const entry of parsed) {
			let urlCanonical: string;
			try {
				urlCanonical = canonicalizeUrl(entry.url);
			} catch {
				invalid++;
				continue;
			}

			const prior = existing.get(urlCanonical);
			// An active row (in the library or already handled earlier in this
			// file) is a genuine duplicate; skip it.
			if (prior && prior.deletedAt === null) {
				skippedDuplicates++;
				continue;
			}

			// Each branch runs in a transaction so the bookmark, its tags, the
			// FTS row, and the fetch job commit or roll back together. All calls
			// share the single bun:sqlite connection, so the helpers below
			// participate in the transaction too.
			if (prior) {
				// Soft-deleted row: restore it instead of skipping.
				db.transaction((tx) => {
					tx.update(bookmarks)
						.set({ deletedAt: null, archived: false, updatedAt: new Date() })
						.where(eq(bookmarks.id, prior.id))
						.run();
					linkFolderTags(tx, prior.id, entry.folders);
					syncBookmarkFts(prior.id);
					enqueueJob({ kind: "fetch_and_extract", bookmarkId: prior.id });
				});
				existing.set(urlCanonical, { id: prior.id, deletedAt: null });
				imported++;
				continue;
			}

			const newId = db.transaction((tx) => {
				const [created] = tx
					.insert(bookmarks)
					.values({
						userId: user.id,
						url: entry.url,
						urlCanonical,
						title: entry.title || null,
					})
					.returning({ id: bookmarks.id })
					.all();
				linkFolderTags(tx, created.id, entry.folders);
				syncBookmarkFts(created.id);
				enqueueJob({ kind: "fetch_and_extract", bookmarkId: created.id });
				return created.id;
			});
			existing.set(urlCanonical, { id: newId, deletedAt: null });
			imported++;
		}

		log.info("netscape_import", {
			userId: user.id,
			imported,
			skippedDuplicates,
			invalid,
		});
		return { imported, skippedDuplicates, invalid };
	});

// Live count of broken links detected among a user's bookmarks — the
// import page polls this to surface "N broken links detected" as the
// background fetch jobs work through the queue.
export const getImportStatus = createServerFn({ method: "GET" }).handler(
	async () => {
		const user = await requireUser();
		const [{ pending }] = db
			.select({ pending: count() })
			.from(bookmarks)
			.where(
				and(eq(bookmarks.userId, user.id), eq(bookmarks.status, "pending")),
			)
			.all();
		const [{ broken }] = db
			.select({ broken: count() })
			.from(bookmarks)
			.where(and(eq(bookmarks.userId, user.id), eq(bookmarks.status, "broken")))
			.all();
		return { pending, broken };
	},
);
