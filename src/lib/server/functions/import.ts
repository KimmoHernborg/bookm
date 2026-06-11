import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
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

		const existing = new Set(
			db
				.select({ urlCanonical: bookmarks.urlCanonical })
				.from(bookmarks)
				.where(eq(bookmarks.userId, user.id))
				.all()
				.map((row) => row.urlCanonical),
		);

		let imported = 0;
		let skippedDuplicates = 0;
		let invalid = 0;

		for (const entry of parsed) {
			let urlCanonical: string;
			try {
				urlCanonical = canonicalizeUrl(entry.url);
			} catch {
				invalid++;
				continue;
			}
			// Duplicates against the library and within the file itself.
			if (existing.has(urlCanonical)) {
				skippedDuplicates++;
				continue;
			}
			existing.add(urlCanonical);

			const [created] = db
				.insert(bookmarks)
				.values({
					userId: user.id,
					url: entry.url,
					urlCanonical,
					title: entry.title || null,
				})
				.returning({ id: bookmarks.id })
				.all();

			// Folder names become tags right away; the LLM adds more later.
			const tagIds = resolveTagIds(user.id, entry.folders);
			if (tagIds.length > 0) {
				db.insert(bookmarkTags)
					.values(tagIds.map((tagId) => ({ bookmarkId: created.id, tagId })))
					.onConflictDoNothing()
					.run();
			}
			syncBookmarkFts(created.id);
			enqueueJob({ kind: "fetch_and_extract", bookmarkId: created.id });
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
		const pending = db
			.select({ id: bookmarks.id })
			.from(bookmarks)
			.where(
				and(eq(bookmarks.userId, user.id), eq(bookmarks.status, "pending")),
			)
			.all().length;
		const broken = db
			.select({ id: bookmarks.id })
			.from(bookmarks)
			.where(and(eq(bookmarks.userId, user.id), eq(bookmarks.status, "broken")))
			.all().length;
		return { pending, broken };
	},
);
