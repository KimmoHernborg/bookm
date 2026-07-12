import { randomBytes } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "#/db/index.ts";
import { bookmarks, categories, user } from "#/db/schema.ts";
import { ensureInit } from "#/lib/server/init.ts";
import { requireUser } from "#/lib/server/session.ts";
import { groupBookmarksByCategory } from "#/lib/shared/bookmark-grouping.ts";
import { isShowcaseToken } from "#/lib/shared/showcase-token.ts";
import { domainOf } from "#/lib/shared/url.ts";

export type ShowcaseBookmark = {
	id: number;
	url: string;
	title: string | null;
	description: string | null;
	domain: string;
	starred: boolean;
	createdAt: number;
};

export type ShowcaseGroup = {
	category: string | null;
	bookmarks: Array<ShowcaseBookmark>;
};

export type ShowcaseData = {
	ownerName: string;
	groups: Array<ShowcaseGroup>;
};

// Public: no session required. Resolves a share token to its owner's
// starred bookmarks; null means "no such showcase" for any reason so the
// route can 404 uniformly. Only the owner's display name and the listed
// bookmark fields ever leave the server.
export const getShowcase = createServerFn({ method: "GET" })
	// Lenient on purpose: a malformed token should 404, not throw a 500.
	.inputValidator((data: { token: string }) =>
		z.object({ token: z.string().max(128) }).parse(data),
	)
	.handler(async ({ data }): Promise<ShowcaseData | null> => {
		await ensureInit();
		if (!isShowcaseToken(data.token)) return null;

		const [owner] = db
			.select({ id: user.id, name: user.name })
			.from(user)
			.where(eq(user.showcaseToken, data.token))
			.all();
		if (!owner) return null;

		const rows = db
			.select({ bookmark: bookmarks, categoryName: categories.name })
			.from(bookmarks)
			.leftJoin(categories, eq(bookmarks.categoryId, categories.id))
			.where(
				and(
					eq(bookmarks.userId, owner.id),
					eq(bookmarks.starred, true),
					eq(bookmarks.archived, false),
					isNull(bookmarks.deletedAt),
				),
			)
			.all();

		const items = rows.map((r) => ({
			id: r.bookmark.id,
			url: r.bookmark.url,
			title: r.bookmark.title,
			description: r.bookmark.description,
			domain: domainOf(r.bookmark.url),
			starred: r.bookmark.starred,
			createdAt: r.bookmark.createdAt.getTime(),
			categoryId: r.bookmark.categoryId,
			category: r.categoryName,
		}));

		const groups: Array<ShowcaseGroup> = groupBookmarksByCategory(items).map(
			(group) => ({
				category: group.category,
				bookmarks: group.bookmarks.map(
					({ categoryId: _categoryId, category: _category, ...bookmark }) =>
						bookmark,
				),
			}),
		);

		return { ownerName: owner.name, groups };
	});

export const getShowcaseStatus = createServerFn({ method: "GET" }).handler(
	async () => {
		const sessionUser = await requireUser();
		const [row] = db
			.select({ token: user.showcaseToken })
			.from(user)
			.where(eq(user.id, sessionUser.id))
			.all();
		// null = showcase disabled.
		return { token: row?.token ?? null };
	},
);

// Serves both Enable and Regenerate: overwriting revokes the old link.
export const generateShowcaseToken = createServerFn({ method: "POST" }).handler(
	async () => {
		const sessionUser = await requireUser();
		const token = randomBytes(16).toString("base64url");
		db.update(user)
			.set({ showcaseToken: token, updatedAt: new Date() })
			.where(eq(user.id, sessionUser.id))
			.run();
		return { token };
	},
);

export const disableShowcase = createServerFn({ method: "POST" }).handler(
	async () => {
		const sessionUser = await requireUser();
		db.update(user)
			.set({ showcaseToken: null, updatedAt: new Date() })
			.where(eq(user.id, sessionUser.id))
			.run();
	},
);
