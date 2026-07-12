import { describe, expect, it } from "vitest";

import {
	type GroupableBookmark,
	groupBookmarksByCategory,
} from "./bookmark-grouping.ts";

let nextId = 0;
function bookmark(
	overrides: Partial<GroupableBookmark> = {},
): GroupableBookmark & { id: number } {
	nextId += 1;
	return {
		id: nextId,
		categoryId: null,
		category: null,
		starred: false,
		createdAt: 0,
		...overrides,
	};
}

describe("groupBookmarksByCategory", () => {
	it("returns an empty list for no bookmarks", () => {
		expect(groupBookmarksByCategory([])).toEqual([]);
	});

	it("sorts groups alphabetically, case-insensitively", () => {
		const groups = groupBookmarksByCategory([
			bookmark({ categoryId: 1, category: "zebra" }),
			bookmark({ categoryId: 2, category: "Apple" }),
			bookmark({ categoryId: 3, category: "mango" }),
		]);
		expect(groups.map((g) => g.category)).toEqual(["Apple", "mango", "zebra"]);
	});

	it("puts the Uncategorized group last even though it sorts first", () => {
		const groups = groupBookmarksByCategory([
			bookmark({ categoryId: null }),
			bookmark({ categoryId: 1, category: "Work" }),
		]);
		expect(groups.map((g) => g.categoryId)).toEqual([1, null]);
		expect(groups[1]?.category).toBeNull();
	});

	it("omits the Uncategorized group when every bookmark has a category", () => {
		const groups = groupBookmarksByCategory([
			bookmark({ categoryId: 1, category: "Work" }),
		]);
		expect(groups).toHaveLength(1);
	});

	it("floats starred bookmarks to the top within a group", () => {
		const older = bookmark({ categoryId: 1, category: "Work", createdAt: 1 });
		const starred = bookmark({
			categoryId: 1,
			category: "Work",
			starred: true,
			createdAt: 2,
		});
		const newest = bookmark({ categoryId: 1, category: "Work", createdAt: 3 });
		const groups = groupBookmarksByCategory([older, newest, starred]);
		expect(groups[0]?.bookmarks).toEqual([starred, newest, older]);
	});

	it("breaks starred ties by date added, newest first", () => {
		const a = bookmark({ starred: true, createdAt: 1 });
		const b = bookmark({ starred: true, createdAt: 2 });
		const groups = groupBookmarksByCategory([a, b]);
		expect(groups[0]?.bookmarks).toEqual([b, a]);
	});

	it("places each bookmark exactly once, under its own category", () => {
		const items = [
			bookmark({ categoryId: 1, category: "Work" }),
			bookmark({ categoryId: 1, category: "Work" }),
			bookmark({ categoryId: 2, category: "Reading" }),
			bookmark({ categoryId: null }),
		];
		const groups = groupBookmarksByCategory(items);
		const placed = groups.flatMap((g) => g.bookmarks);
		expect(placed).toHaveLength(items.length);
		expect(new Set(placed.map((b) => b.id)).size).toBe(items.length);
		for (const group of groups) {
			for (const item of group.bookmarks) {
				expect(item.categoryId).toBe(group.categoryId);
			}
		}
	});
});
