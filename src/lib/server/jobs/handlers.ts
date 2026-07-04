import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";

import { db } from "#/db/index.ts";
import {
	type Bookmark,
	bookmarks,
	bookmarkTags,
	categories,
	tags,
	user,
} from "#/db/schema.ts";
import { env, extractionMaxCharsFor } from "#/lib/server/env.ts";
import { extractFromUrl } from "#/lib/server/extraction/extract.ts";
import { syncBookmarkFts } from "#/lib/server/fts.ts";
import {
	generateBookmarkMetadata,
	pickBookmarkCategory,
} from "#/lib/server/llm.ts";
import { log } from "#/lib/server/log.ts";
import { matchCategory } from "#/lib/shared/category-match.ts";
import { normalizeTags } from "#/lib/shared/tag-normalize.ts";
import { enqueueJob, type JobPayload } from "./queue.ts";

// All handlers are idempotent: a re-run produces the same result for the
// same input. Every handler exits early when the bookmark was soft-deleted
// — jobs for deleted bookmarks drain naturally, they are never cancelled.

function loadActiveBookmark(bookmarkId: number): Bookmark | null {
	const [bookmark] = db
		.select()
		.from(bookmarks)
		.where(eq(bookmarks.id, bookmarkId))
		.all();
	if (!bookmark || bookmark.deletedAt !== null) return null;
	return bookmark;
}

function userModel(userId: string): { model: string } {
	const [owner] = db.select().from(user).where(eq(user.id, userId)).all();
	return {
		model: owner?.openrouterModel || env.openrouterDefaultModel,
	};
}

async function fetchAndExtract(payload: { bookmarkId: number }) {
	const bookmark = loadActiveBookmark(payload.bookmarkId);
	if (!bookmark) return;

	const { model } = userModel(bookmark.userId);
	const result = await extractFromUrl(
		bookmark.url,
		extractionMaxCharsFor(model),
	);

	if (result.kind === "broken") {
		db.update(bookmarks)
			.set({ status: "broken", updatedAt: new Date() })
			.where(eq(bookmarks.id, bookmark.id))
			.run();
		log.info("bookmark_broken", {
			bookmarkId: bookmark.id,
			url: bookmark.url,
			httpStatus: result.httpStatus,
		});
		return;
	}

	const { extraction } = result;
	db.update(bookmarks)
		.set({
			title: bookmark.title ?? extraction.title,
			content: extraction.content,
			contentType: extraction.contentTypeHint ?? bookmark.contentType,
			extractionQuality: extraction.quality,
			updatedAt: new Date(),
		})
		.where(eq(bookmarks.id, bookmark.id))
		.run();
	// Title is now known — make the bookmark searchable before tagging lands.
	syncBookmarkFts(bookmark.id);

	enqueueJob({ kind: "tag_bookmark", bookmarkId: bookmark.id });
}

export function userCategoriesFor(
	userId: string,
): Array<{ id: number; name: string }> {
	return db
		.select({ id: categories.id, name: categories.name })
		.from(categories)
		.where(eq(categories.userId, userId))
		.orderBy(categories.sortOrder, categories.name)
		.all();
}

function topTagsFor(userId: string, limit = 50): Array<string> {
	return db
		.select({ name: tags.name, uses: count(bookmarkTags.bookmarkId) })
		.from(tags)
		.leftJoin(bookmarkTags, eq(bookmarkTags.tagId, tags.id))
		.where(eq(tags.userId, userId))
		.groupBy(tags.id)
		.orderBy(desc(count(bookmarkTags.bookmarkId)))
		.limit(limit)
		.all()
		.map((row) => row.name);
}

// Normalize, then INSERT OR IGNORE and resolve to canonical rows — this
// collapses `JavaScript` / `javascript` / `JS` regardless of which job
// writes first.
export function resolveTagIds(
	userId: string,
	names: Array<string>,
): Array<number> {
	const normalized = normalizeTags(names);
	if (normalized.length === 0) return [];
	db.insert(tags)
		.values(normalized.map((name) => ({ userId, name })))
		.onConflictDoNothing()
		.run();
	return db
		.select({ id: tags.id })
		.from(tags)
		.where(and(eq(tags.userId, userId), inArray(tags.name, normalized)))
		.all()
		.map((row) => row.id);
}

async function tagBookmark(payload: { bookmarkId: number }) {
	const bookmark = loadActiveBookmark(payload.bookmarkId);
	if (!bookmark) return;

	const { model } = userModel(bookmark.userId);
	const userCategories = userCategoriesFor(bookmark.userId);
	const output = await generateBookmarkMetadata({
		url: bookmark.url,
		title: bookmark.title,
		content: bookmark.content,
		extractionQuality: bookmark.extractionQuality ?? "low",
		contentTypeHint: bookmark.contentType,
		existingTags: topTagsFor(bookmark.userId),
		existingCategories: userCategories.map((c) => c.name),
		model,
	});

	// Only fill an empty category — a re-run (admin Retry) must never
	// clobber a manual assignment. The write below re-checks with an
	// isNull guard: this read predates the LLM call, and the user may have
	// assigned a category manually in the meantime.
	const matched =
		bookmark.categoryId === null
			? matchCategory(output.category, userCategories)
			: null;

	// Union with existing tags (folder tags from import, manual edits)
	// rather than replacing them — also keeps re-runs idempotent.
	const tagIds = resolveTagIds(bookmark.userId, output.tags);
	db.transaction((tx) => {
		if (tagIds.length > 0) {
			tx.insert(bookmarkTags)
				.values(
					tagIds.map((tagId) => ({
						bookmarkId: bookmark.id,
						tagId,
						userId: bookmark.userId,
					})),
				)
				.onConflictDoNothing()
				.run();
		}
		tx.update(bookmarks)
			.set({
				title: output.title || bookmark.title,
				summary: output.summary,
				description: output.description,
				contentType: output.content_type,
				language: output.language,
				readingTimeMinutes: output.reading_time_minutes,
				status: "processed",
				processedAt: new Date(),
				updatedAt: new Date(),
			})
			.where(eq(bookmarks.id, bookmark.id))
			.run();
		if (matched) {
			tx.update(bookmarks)
				.set({ categoryId: matched.id })
				.where(and(eq(bookmarks.id, bookmark.id), isNull(bookmarks.categoryId)))
				.run();
		}
	});
	syncBookmarkFts(bookmark.id);
	log.info("bookmark_processed", { bookmarkId: bookmark.id, model });
}

// Backfill-only: assigns a category to a processed bookmark that has none.
// Never touches status/processedAt, so an exhausted retry cannot flip a
// processed bookmark to failed (onJobExhausted skips processed ones).
async function categorizeBookmark(payload: { bookmarkId: number }) {
	const bookmark = loadActiveBookmark(payload.bookmarkId);
	if (!bookmark) return;
	// Idempotent, and respects a manual assignment made after enqueueing.
	if (bookmark.categoryId !== null) return;

	const userCategories = userCategoriesFor(bookmark.userId);
	if (userCategories.length === 0) return;

	const { model } = userModel(bookmark.userId);
	const tagNames = db
		.select({ name: tags.name })
		.from(bookmarkTags)
		.innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
		.where(eq(bookmarkTags.bookmarkId, bookmark.id))
		.all()
		.map((row) => row.name);

	const picked = await pickBookmarkCategory({
		url: bookmark.url,
		title: bookmark.title,
		summary: bookmark.summary,
		description: bookmark.description,
		tags: tagNames,
		categories: userCategories.map((c) => c.name),
		model,
	});
	const matched = matchCategory(picked, userCategories);
	if (!matched) return;

	// isNull guard: the categoryId check above predates the LLM call, and
	// the user may have assigned a category manually in the meantime.
	db.update(bookmarks)
		.set({ categoryId: matched.id, updatedAt: new Date() })
		.where(and(eq(bookmarks.id, bookmark.id), isNull(bookmarks.categoryId)))
		.run();
	log.info("bookmark_categorized", {
		bookmarkId: bookmark.id,
		category: matched.name,
		model,
	});
}

export const handlers: {
	[K in JobPayload["kind"]]: (
		payload: Extract<JobPayload, { kind: K }>,
	) => Promise<void>;
} = {
	fetch_and_extract: fetchAndExtract,
	tag_bookmark: tagBookmark,
	categorize_bookmark: categorizeBookmark,
};

// Called by the worker when a job has exhausted its retries: surface the
// failure on the bookmark itself so the UI can show it inline.
export function onJobExhausted(payload: JobPayload) {
	const bookmark = loadActiveBookmark(payload.bookmarkId);
	// Never clobber a final state: "broken" (URL unreachable) and "processed"
	// (succeeded) must survive a later/stale job exhausting its retries.
	if (
		!bookmark ||
		bookmark.status === "broken" ||
		bookmark.status === "processed"
	)
		return;
	db.update(bookmarks)
		.set({ status: "failed", updatedAt: new Date() })
		.where(eq(bookmarks.id, payload.bookmarkId))
		.run();
}
