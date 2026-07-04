import { createServerFn } from "@tanstack/react-start";
import { and, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "#/db/index.ts";
import {
	type BookmarkStatus,
	bookmarks,
	bookmarkTags,
	CONTENT_TYPES,
	type ContentType,
	categories,
	tags,
} from "#/db/schema.ts";
import { searchBookmarkIds, syncBookmarkFts } from "#/lib/server/fts.ts";
import { resolveTagIds } from "#/lib/server/jobs/handlers.ts";
import { enqueueJob } from "#/lib/server/jobs/queue.ts";
import { requireUser } from "#/lib/server/session.ts";
import { canonicalizeUrl, domainOf, isHttpUrl } from "#/lib/shared/url.ts";

export type BookmarkListItem = {
	id: number;
	url: string;
	title: string | null;
	summary: string | null;
	description: string | null;
	contentType: ContentType | null;
	status: BookmarkStatus;
	starred: boolean;
	domain: string;
	createdAt: number;
	tags: Array<string>;
	categoryId: number | null;
	category: string | null;
};

export type BookmarkGroup = {
	categoryId: number | null; // null = the Uncategorized group
	category: string | null;
	bookmarks: Array<BookmarkListItem>;
};

export type RailCategory = { id: number; name: string; count: number };
export type RailTag = { name: string; count: number };

export type BookmarksPage = {
	groups: Array<BookmarkGroup>;
	railCategories: Array<RailCategory>;
	railTags: Array<RailTag>;
	uncategorizedCount: number;
	total: number;
};

const listInputSchema = z.object({
	view: z.enum(["active", "archived"]).default("active"),
	q: z.string().optional(),
	// number = a category id, "none" = only uncategorized
	category: z.union([z.number().int(), z.literal("none")]).optional(),
	tag: z.string().optional(),
	contentType: z.enum(CONTENT_TYPES).optional(),
	date: z.enum(["today", "week", "month"]).optional(),
});

function dateCutoff(date: "today" | "week" | "month"): Date {
	const now = new Date();
	if (date === "today") {
		now.setHours(0, 0, 0, 0);
		return now;
	}
	const days = date === "week" ? 7 : 30;
	return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

function sortGroup(items: Array<BookmarkListItem>) {
	// Starred float to the top; the rest by date added descending.
	items.sort((a, b) =>
		a.starred === b.starred ? b.createdAt - a.createdAt : a.starred ? -1 : 1,
	);
}

export const getBookmarksPage = createServerFn({ method: "GET" })
	.inputValidator((data: z.input<typeof listInputSchema>) =>
		listInputSchema.parse(data ?? {}),
	)
	.handler(async ({ data }): Promise<BookmarksPage> => {
		const user = await requireUser();

		const rows = db
			.select({
				bookmark: bookmarks,
				categoryName: categories.name,
			})
			.from(bookmarks)
			.leftJoin(categories, eq(bookmarks.categoryId, categories.id))
			.where(
				and(
					eq(bookmarks.userId, user.id),
					isNull(bookmarks.deletedAt),
					eq(bookmarks.archived, data.view === "archived"),
					data.contentType
						? eq(bookmarks.contentType, data.contentType)
						: undefined,
					data.category === "none"
						? isNull(bookmarks.categoryId)
						: typeof data.category === "number"
							? eq(bookmarks.categoryId, data.category)
							: undefined,
				),
			)
			.orderBy(desc(bookmarks.createdAt))
			.all();

		let filtered = rows;
		if (data.date) {
			const cutoff = dateCutoff(data.date).getTime();
			filtered = filtered.filter(
				(r) => r.bookmark.createdAt.getTime() >= cutoff,
			);
		}
		if (data.q?.trim()) {
			const matches = searchBookmarkIds(user.id, data.q);
			filtered = filtered.filter((r) => matches.has(r.bookmark.id));
		}
		if (data.tag) {
			const tagged = new Set(
				db
					.select({ bookmarkId: bookmarkTags.bookmarkId })
					.from(bookmarkTags)
					.innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
					.where(and(eq(tags.userId, user.id), eq(tags.name, data.tag)))
					.all()
					.map((row) => row.bookmarkId),
			);
			filtered = filtered.filter((r) => tagged.has(r.bookmark.id));
		}

		const ids = filtered.map((r) => r.bookmark.id);
		const tagRows =
			ids.length > 0
				? db
						.select({
							bookmarkId: bookmarkTags.bookmarkId,
							name: tags.name,
						})
						.from(bookmarkTags)
						.innerJoin(tags, eq(bookmarkTags.tagId, tags.id))
						.where(inArray(bookmarkTags.bookmarkId, ids))
						.all()
				: [];
		const tagsByBookmark = new Map<number, Array<string>>();
		for (const row of tagRows) {
			const list = tagsByBookmark.get(row.bookmarkId) ?? [];
			list.push(row.name);
			tagsByBookmark.set(row.bookmarkId, list);
		}

		const items: Array<BookmarkListItem> = filtered.map((r) => ({
			id: r.bookmark.id,
			url: r.bookmark.url,
			title: r.bookmark.title,
			summary: r.bookmark.summary,
			description: r.bookmark.description,
			contentType: r.bookmark.contentType,
			status: r.bookmark.status,
			starred: r.bookmark.starred,
			domain: domainOf(r.bookmark.url),
			createdAt: r.bookmark.createdAt.getTime(),
			tags: (tagsByBookmark.get(r.bookmark.id) ?? []).sort(),
			categoryId: r.bookmark.categoryId,
			category: r.categoryName,
		}));

		// Each bookmark appears exactly once, under its category group.
		const byCategory = new Map<number, BookmarkGroup>();
		const uncategorized: Array<BookmarkListItem> = [];
		for (const item of items) {
			if (item.categoryId === null) {
				uncategorized.push(item);
			} else {
				const group = byCategory.get(item.categoryId) ?? {
					categoryId: item.categoryId,
					category: item.category,
					bookmarks: [],
				};
				group.bookmarks.push(item);
				byCategory.set(item.categoryId, group);
			}
		}

		// Groups sort alphabetically, matching the rail's COLLATE NOCASE order.
		const groups: Array<BookmarkGroup> = [...byCategory.values()].sort((a, b) =>
			(a.category ?? "").localeCompare(b.category ?? "", undefined, {
				sensitivity: "base",
			}),
		);
		for (const group of groups) sortGroup(group.bookmarks);
		sortGroup(uncategorized);
		// The Uncategorized group sits at the bottom.
		if (uncategorized.length > 0) {
			groups.push({
				categoryId: null,
				category: null,
				bookmarks: uncategorized,
			});
		}

		// Rail counts always reflect the unfiltered active view. LEFT JOIN so
		// empty categories still show (curated list; the AI can pick them).
		// The archived view has no rail — skip both queries there.
		const railRows =
			data.view === "active"
				? db
						.select({
							id: categories.id,
							name: categories.name,
							value: count(bookmarks.id),
						})
						.from(categories)
						.leftJoin(
							bookmarks,
							and(
								eq(bookmarks.categoryId, categories.id),
								isNull(bookmarks.deletedAt),
								eq(bookmarks.archived, false),
							),
						)
						.where(eq(categories.userId, user.id))
						.groupBy(categories.id)
						.orderBy(sql`${categories.name} COLLATE NOCASE`)
						.all()
				: [];

		const railTagRows =
			data.view === "active"
				? db
						.select({ name: tags.name, value: count(bookmarkTags.bookmarkId) })
						.from(tags)
						.innerJoin(bookmarkTags, eq(bookmarkTags.tagId, tags.id))
						.innerJoin(bookmarks, eq(bookmarks.id, bookmarkTags.bookmarkId))
						.where(
							and(
								eq(tags.userId, user.id),
								isNull(bookmarks.deletedAt),
								eq(bookmarks.archived, false),
							),
						)
						.groupBy(tags.id)
						.orderBy(sql`${tags.name} COLLATE NOCASE`)
						.all()
				: [];

		const [uncategorizedActive] =
			data.view === "active"
				? db
						.select({ value: count() })
						.from(bookmarks)
						.where(
							and(
								eq(bookmarks.userId, user.id),
								isNull(bookmarks.deletedAt),
								eq(bookmarks.archived, false),
								isNull(bookmarks.categoryId),
							),
						)
						.all()
				: [];

		return {
			groups,
			railCategories: railRows.map((r) => ({
				id: r.id,
				name: r.name,
				count: r.value,
			})),
			railTags: railTagRows.map((r) => ({ name: r.name, count: r.value })),
			uncategorizedCount: uncategorizedActive?.value ?? 0,
			total: items.length,
		};
	});

export const addBookmark = createServerFn({ method: "POST" })
	.inputValidator((data: { url: string }) =>
		z.object({ url: z.string().trim() }).parse(data),
	)
	.handler(async ({ data }) => {
		const user = await requireUser();
		const rawUrl = /^https?:\/\//i.test(data.url)
			? data.url
			: `https://${data.url}`;
		if (!isHttpUrl(rawUrl)) {
			return { result: "invalid" as const };
		}
		const urlCanonical = canonicalizeUrl(rawUrl);

		const [existing] = db
			.select({
				id: bookmarks.id,
				deletedAt: bookmarks.deletedAt,
				status: bookmarks.status,
			})
			.from(bookmarks)
			.where(
				and(
					eq(bookmarks.userId, user.id),
					eq(bookmarks.urlCanonical, urlCanonical),
				),
			)
			.all();
		if (existing) {
			if (existing.deletedAt === null) {
				return { result: "duplicate" as const };
			}
			// Re-adding a previously deleted URL restores it.
			db.update(bookmarks)
				.set({ deletedAt: null, archived: false, updatedAt: new Date() })
				.where(eq(bookmarks.id, existing.id))
				.run();
			if (existing.status !== "processed") {
				enqueueJob({ kind: "fetch_and_extract", bookmarkId: existing.id });
			}
			syncBookmarkFts(existing.id);
			return { result: "created" as const, id: existing.id };
		}

		const [created] = db
			.insert(bookmarks)
			.values({ userId: user.id, url: rawUrl, urlCanonical })
			.returning({ id: bookmarks.id })
			.all();
		enqueueJob({ kind: "fetch_and_extract", bookmarkId: created.id });
		return { result: "created" as const, id: created.id };
	});

async function ownedBookmark(userId: string, bookmarkId: number) {
	const [bookmark] = db
		.select()
		.from(bookmarks)
		.where(and(eq(bookmarks.id, bookmarkId), eq(bookmarks.userId, userId)))
		.all();
	if (!bookmark) throw new Error("Bookmark not found");
	return bookmark;
}

export const setStarred = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; starred: boolean }) =>
		z.object({ id: z.number().int(), starred: z.boolean() }).parse(data),
	)
	.handler(async ({ data }) => {
		const user = await requireUser();
		await ownedBookmark(user.id, data.id);
		db.update(bookmarks)
			.set({ starred: data.starred, updatedAt: new Date() })
			.where(eq(bookmarks.id, data.id))
			.run();
	});

export const setArchived = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; archived: boolean }) =>
		z.object({ id: z.number().int(), archived: z.boolean() }).parse(data),
	)
	.handler(async ({ data }) => {
		const user = await requireUser();
		await ownedBookmark(user.id, data.id);
		db.update(bookmarks)
			.set({ archived: data.archived, updatedAt: new Date() })
			.where(eq(bookmarks.id, data.id))
			.run();
		syncBookmarkFts(data.id);
	});

export const deleteBookmark = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number }) =>
		z.object({ id: z.number().int() }).parse(data),
	)
	.handler(async ({ data }) => {
		const user = await requireUser();
		await ownedBookmark(user.id, data.id);
		db.update(bookmarks)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(eq(bookmarks.id, data.id))
			.run();
		syncBookmarkFts(data.id);
	});

export const updateBookmark = createServerFn({ method: "POST" })
	.inputValidator(
		(data: {
			id: number;
			url: string;
			title: string;
			tags: Array<string>;
			categoryId: number | null;
		}) =>
			z
				.object({
					id: z.number().int(),
					url: z.string().trim().min(1).max(2048),
					title: z.string().trim().max(500),
					tags: z.array(z.string()).max(30),
					categoryId: z.number().int().nullable(),
				})
				.parse(data),
	)
	.handler(async ({ data }) => {
		const user = await requireUser();
		const bookmark = await ownedBookmark(user.id, data.id);
		// App-level tenant guard: the category FK is single-column by design
		// (see schema.ts), so cross-user assignment must be rejected here.
		if (data.categoryId !== null) {
			const [owned] = db
				.select({ id: categories.id })
				.from(categories)
				.where(
					and(
						eq(categories.id, data.categoryId),
						eq(categories.userId, user.id),
					),
				)
				.all();
			if (!owned) throw new Error("Category not found");
		}

		// Same URL handling as addBookmark: default scheme, then canonicalize.
		const rawUrl = /^https?:\/\//i.test(data.url)
			? data.url
			: `https://${data.url}`;
		if (!isHttpUrl(rawUrl)) throw new Error("Invalid URL");
		const urlCanonical = canonicalizeUrl(rawUrl);
		const urlChanged = urlCanonical !== bookmark.urlCanonical;
		if (urlChanged) {
			// The (userId, urlCanonical) unique index also covers soft-deleted
			// rows — surface a friendly error instead of a constraint failure.
			const [conflict] = db
				.select({ id: bookmarks.id, deletedAt: bookmarks.deletedAt })
				.from(bookmarks)
				.where(
					and(
						eq(bookmarks.userId, user.id),
						eq(bookmarks.urlCanonical, urlCanonical),
					),
				)
				.all();
			if (conflict && conflict.id !== data.id) {
				throw new Error(
					conflict.deletedAt === null
						? "You already have a bookmark with this URL"
						: "A deleted bookmark still uses this URL — re-add it from the save form instead",
				);
			}
		}

		const tagIds = resolveTagIds(user.id, data.tags);
		db.transaction((tx) => {
			tx.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, data.id)).run();
			if (tagIds.length > 0) {
				tx.insert(bookmarkTags)
					.values(
						tagIds.map((tagId) => ({
							bookmarkId: data.id,
							tagId,
							userId: user.id,
						})),
					)
					.run();
			}
			tx.update(bookmarks)
				.set({
					url: rawUrl,
					urlCanonical,
					title: data.title || null,
					categoryId: data.categoryId,
					// The stored content/summary describe the old page — send the
					// bookmark back through the pipeline.
					...(urlChanged ? { status: "pending" as const, content: null } : {}),
					updatedAt: new Date(),
				})
				.where(eq(bookmarks.id, data.id))
				.run();
		});
		if (urlChanged) {
			enqueueJob({ kind: "fetch_and_extract", bookmarkId: data.id });
		}
		syncBookmarkFts(data.id);
	});

export const emptyArchive = createServerFn({ method: "POST" }).handler(
	async () => {
		const user = await requireUser();
		const archivedIds = db
			.select({ id: bookmarks.id })
			.from(bookmarks)
			.where(
				and(
					eq(bookmarks.userId, user.id),
					eq(bookmarks.archived, true),
					isNull(bookmarks.deletedAt),
				),
			)
			.all()
			.map((row) => row.id);
		if (archivedIds.length > 0) {
			db.update(bookmarks)
				.set({ deletedAt: new Date(), updatedAt: new Date() })
				.where(inArray(bookmarks.id, archivedIds))
				.run();
		}
		return { deleted: archivedIds.length };
	},
);

export const getUserTags = createServerFn({ method: "GET" }).handler(
	async () => {
		const user = await requireUser();
		return db
			.select({ name: tags.name })
			.from(tags)
			.where(eq(tags.userId, user.id))
			.orderBy(tags.name)
			.all()
			.map((row) => row.name);
	},
);
