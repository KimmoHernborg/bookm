export type GroupableBookmark = {
	categoryId: number | null;
	category: string | null;
	starred: boolean;
	createdAt: number;
};

export type CategoryGroup<T> = {
	categoryId: number | null; // null = the Uncategorized group
	category: string | null;
	bookmarks: Array<T>;
};

function sortGroup<T extends GroupableBookmark>(items: Array<T>) {
	// Starred float to the top; the rest by date added descending.
	items.sort((a, b) =>
		a.starred === b.starred ? b.createdAt - a.createdAt : a.starred ? -1 : 1,
	);
}

// Each bookmark appears exactly once, under its category group.
export function groupBookmarksByCategory<T extends GroupableBookmark>(
	items: Array<T>,
): Array<CategoryGroup<T>> {
	const byCategory = new Map<number, CategoryGroup<T>>();
	const uncategorized: Array<T> = [];
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
	const groups: Array<CategoryGroup<T>> = [...byCategory.values()].sort(
		(a, b) =>
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
	return groups;
}
