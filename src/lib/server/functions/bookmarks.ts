import { createServerFn } from "@tanstack/react-start";
import { and, count, desc, eq, inArray, isNull, notExists } from "drizzle-orm";
import { z } from "zod";

import { db } from "#/db/index.ts";
import {
	type BookmarkStatus,
	bookmarks,
	bookmarkTags,
	CONTENT_TYPES,
	type ContentType,
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
};

export type BookmarkGroup = {
	tag: string | null; // null = the Untagged group
	bookmarks: Array<BookmarkListItem>;
};

export type RailTag = { name: string; count: number };

export type BookmarksPage = {
	groups: Array<BookmarkGroup>;
	railTags: Array<RailTag>;
	untaggedCount: number;
	total: number;
};

const listInputSchema = z.object({
	view: z.enum(["active", "archived"]).default("active"),
	q: z.string().optional(),
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
			.select()
			.from(bookmarks)
			.where(
				and(
					eq(bookmarks.userId, user.id),
					isNull(bookmarks.deletedAt),
					eq(bookmarks.archived, data.view === "archived"),
					data.contentType
						? eq(bookmarks.contentType, data.contentType)
						: undefined,
				),
			)
			.orderBy(desc(bookmarks.createdAt))
			.all();

		let filtered = rows;
		if (data.date) {
			const cutoff = dateCutoff(data.date).getTime();
			filtered = filtered.filter((b) => b.createdAt.getTime() >= cutoff);
		}
		if (data.q?.trim()) {
			const matches = searchBookmarkIds(user.id, data.q);
			filtered = filtered.filter((b) => matches.has(b.id));
		}

		const ids = filtered.map((b) => b.id);
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

		const items: Array<BookmarkListItem> = filtered.map((b) => ({
			id: b.id,
			url: b.url,
			title: b.title,
			summary: b.summary,
			description: b.description,
			contentType: b.contentType,
			status: b.status,
			starred: b.starred,
			domain: domainOf(b.url),
			createdAt: b.createdAt.getTime(),
			tags: (tagsByBookmark.get(b.id) ?? []).sort(),
		}));

		// A bookmark with multiple tags appears under each of its tag groups.
		const byTag = new Map<string, Array<BookmarkListItem>>();
		const untagged: Array<BookmarkListItem> = [];
		for (const item of items) {
			if (item.tags.length === 0) {
				untagged.push(item);
			} else {
				for (const tag of item.tags) {
					const list = byTag.get(tag) ?? [];
					list.push(item);
					byTag.set(tag, list);
				}
			}
		}

		let groups: Array<BookmarkGroup> = [...byTag.entries()]
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([tag, list]) => ({ tag, bookmarks: list }));
		if (data.tag) {
			groups = groups.filter((g) => g.tag === data.tag);
		}
		for (const group of groups) sortGroup(group.bookmarks);
		sortGroup(untagged);
		// The Untagged group sits at the bottom; hidden when a tag filter is active.
		if (!data.tag && untagged.length > 0) {
			groups.push({ tag: null, bookmarks: untagged });
		}

		// Rail counts always reflect the unfiltered active view.
		const railRows = db
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
			.orderBy(tags.name)
			.all();

		const [untaggedActive] = db
			.select({ value: count() })
			.from(bookmarks)
			.where(
				and(
					eq(bookmarks.userId, user.id),
					isNull(bookmarks.deletedAt),
					eq(bookmarks.archived, false),
					notExists(
						db
							.select({ id: bookmarkTags.bookmarkId })
							.from(bookmarkTags)
							.where(eq(bookmarkTags.bookmarkId, bookmarks.id)),
					),
				),
			)
			.all();

		return {
			groups,
			railTags: railRows.map((r) => ({ name: r.name, count: r.value })),
			untaggedCount: untaggedActive?.value ?? 0,
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
	.inputValidator((data: { id: number; title: string; tags: Array<string> }) =>
		z
			.object({
				id: z.number().int(),
				title: z.string().trim().max(500),
				tags: z.array(z.string()).max(30),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const user = await requireUser();
		await ownedBookmark(user.id, data.id);
		const tagIds = resolveTagIds(user.id, data.tags);
		db.transaction((tx) => {
			tx.delete(bookmarkTags).where(eq(bookmarkTags.bookmarkId, data.id)).run();
			if (tagIds.length > 0) {
				tx.insert(bookmarkTags)
					.values(tagIds.map((tagId) => ({ bookmarkId: data.id, tagId })))
					.run();
			}
			tx.update(bookmarks)
				.set({ title: data.title || null, updatedAt: new Date() })
				.where(eq(bookmarks.id, data.id))
				.run();
		});
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
