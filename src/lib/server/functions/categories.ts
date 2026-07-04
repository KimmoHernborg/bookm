import { createServerFn } from "@tanstack/react-start";
import { and, count, eq, isNull, max, ne, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "#/db/index.ts";
import { bookmarks, categories, defaultCategories } from "#/db/schema.ts";
import { enqueueJob } from "#/lib/server/jobs/queue.ts";
import { requireAdmin, requireUser } from "#/lib/server/session.ts";

export type CategoryListItem = {
	id: number;
	name: string;
	sortOrder: number;
	bookmarkCount: number;
};

// Categories keep display casing ("Machine Learning"), unlike tags —
// only trim and collapse internal whitespace.
function cleanName(raw: string): string {
	return raw.trim().replace(/\s+/g, " ");
}

const nameSchema = z.string().trim().min(1).max(100);

function ownedCategory(userId: string, id: number) {
	const [row] = db
		.select({ id: categories.id })
		.from(categories)
		.where(and(eq(categories.id, id), eq(categories.userId, userId)))
		.all();
	if (!row) throw new Error("Category not found");
}

export const getUserCategories = createServerFn({ method: "GET" }).handler(
	async (): Promise<Array<CategoryListItem>> => {
		const user = await requireUser();
		return db
			.select({
				id: categories.id,
				name: categories.name,
				sortOrder: categories.sortOrder,
				bookmarkCount: count(bookmarks.id),
			})
			.from(categories)
			.leftJoin(
				bookmarks,
				and(
					eq(bookmarks.categoryId, categories.id),
					isNull(bookmarks.deletedAt),
				),
			)
			.where(eq(categories.userId, user.id))
			.groupBy(categories.id)
			.orderBy(categories.sortOrder, categories.name)
			.all();
	},
);

function duplicateName(userId: string, name: string, excludeId?: number) {
	const [row] = db
		.select({ id: categories.id })
		.from(categories)
		.where(
			and(
				eq(categories.userId, userId),
				eq(sql`lower(${categories.name})`, name.toLowerCase()),
				excludeId !== undefined ? ne(categories.id, excludeId) : undefined,
			),
		)
		.all();
	return row !== undefined;
}

export const createCategory = createServerFn({ method: "POST" })
	.inputValidator((data: { name: string }) =>
		z.object({ name: nameSchema }).parse(data),
	)
	.handler(async ({ data }) => {
		const user = await requireUser();
		const name = cleanName(data.name);
		if (!name) throw new Error("Category name is required");
		if (duplicateName(user.id, name)) {
			throw new Error("A category with this name already exists");
		}
		const [row] = db
			.select({ value: max(categories.sortOrder) })
			.from(categories)
			.where(eq(categories.userId, user.id))
			.all();
		db.insert(categories)
			.values({ userId: user.id, name, sortOrder: (row?.value ?? -1) + 1 })
			.run();
	});

export const renameCategory = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; name: string }) =>
		z.object({ id: z.number().int(), name: nameSchema }).parse(data),
	)
	.handler(async ({ data }) => {
		const user = await requireUser();
		const name = cleanName(data.name);
		if (!name) throw new Error("Category name is required");
		if (duplicateName(user.id, name, data.id)) {
			throw new Error("A category with this name already exists");
		}
		ownedCategory(user.id, data.id);
		db.update(categories)
			.set({ name })
			.where(and(eq(categories.id, data.id), eq(categories.userId, user.id)))
			.run();
	});

export const deleteCategory = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number }) =>
		z.object({ id: z.number().int() }).parse(data),
	)
	.handler(async ({ data }) => {
		const user = await requireUser();
		ownedCategory(user.id, data.id);
		// The single-column FK's ON DELETE SET NULL un-categorizes the
		// category's bookmarks at the DB level.
		db.delete(categories)
			.where(and(eq(categories.id, data.id), eq(categories.userId, user.id)))
			.run();
	});

// Enqueue a category-only AI pass for every processed, uncategorized
// bookmark. User-triggered (Settings) and re-runnable — e.g. after adding
// a new category.
export const backfillCategories = createServerFn({ method: "POST" }).handler(
	async () => {
		const user = await requireUser();
		const ids = db
			.select({ id: bookmarks.id })
			.from(bookmarks)
			.where(
				and(
					eq(bookmarks.userId, user.id),
					isNull(bookmarks.deletedAt),
					isNull(bookmarks.categoryId),
					// Pending bookmarks get a category via tag_bookmark instead.
					eq(bookmarks.status, "processed"),
				),
			)
			.all()
			.map((row) => row.id);
		for (const bookmarkId of ids) {
			enqueueJob({ kind: "categorize_bookmark", bookmarkId });
		}
		return { enqueued: ids.length };
	},
);

// ---------------------------------------------------------------------------
// Admin: the global template copied to new users at signup. Edits do not
// ripple to existing users' categories.
// ---------------------------------------------------------------------------

export const getDefaultCategories = createServerFn({ method: "GET" }).handler(
	async () => {
		await requireAdmin();
		return db
			.select({
				id: defaultCategories.id,
				name: defaultCategories.name,
				sortOrder: defaultCategories.sortOrder,
			})
			.from(defaultCategories)
			.orderBy(defaultCategories.sortOrder, defaultCategories.name)
			.all();
	},
);

function duplicateDefaultName(name: string, excludeId?: number) {
	const [row] = db
		.select({ id: defaultCategories.id })
		.from(defaultCategories)
		.where(
			and(
				eq(sql`lower(${defaultCategories.name})`, name.toLowerCase()),
				excludeId !== undefined
					? ne(defaultCategories.id, excludeId)
					: undefined,
			),
		)
		.all();
	return row !== undefined;
}

export const createDefaultCategory = createServerFn({ method: "POST" })
	.inputValidator((data: { name: string }) =>
		z.object({ name: nameSchema }).parse(data),
	)
	.handler(async ({ data }) => {
		await requireAdmin();
		const name = cleanName(data.name);
		if (!name) throw new Error("Category name is required");
		if (duplicateDefaultName(name)) {
			throw new Error("A default category with this name already exists");
		}
		const [row] = db
			.select({ value: max(defaultCategories.sortOrder) })
			.from(defaultCategories)
			.all();
		db.insert(defaultCategories)
			.values({ name, sortOrder: (row?.value ?? -1) + 1 })
			.run();
	});

export const renameDefaultCategory = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number; name: string }) =>
		z.object({ id: z.number().int(), name: nameSchema }).parse(data),
	)
	.handler(async ({ data }) => {
		await requireAdmin();
		const name = cleanName(data.name);
		if (!name) throw new Error("Category name is required");
		if (duplicateDefaultName(name, data.id)) {
			throw new Error("A default category with this name already exists");
		}
		db.update(defaultCategories)
			.set({ name })
			.where(eq(defaultCategories.id, data.id))
			.run();
	});

export const deleteDefaultCategory = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number }) =>
		z.object({ id: z.number().int() }).parse(data),
	)
	.handler(async ({ data }) => {
		await requireAdmin();
		db.delete(defaultCategories).where(eq(defaultCategories.id, data.id)).run();
	});
