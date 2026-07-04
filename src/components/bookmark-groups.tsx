import type { BookmarkGroup } from "#/lib/server/functions/bookmarks.ts";
import { BookmarkRow } from "./bookmark-row.tsx";

export function BookmarkGroups({
	groups,
	view,
	tagSuggestions,
}: {
	groups: Array<BookmarkGroup>;
	view: "active" | "archived";
	tagSuggestions: Array<string>;
}) {
	return (
		<div className="flex flex-col gap-8">
			{groups.map((group) => (
				<section key={group.categoryId ?? "__uncategorized__"}>
					<h2 className="text-[11px] font-semibold tracking-widest uppercase text-ink-secondary">
						{group.category ?? "Uncategorized"}
					</h2>
					<div className="mt-1 mb-2 border-t border-hairline" />
					<ul>
						{group.bookmarks.map((item) => (
							<BookmarkRow
								key={item.id}
								item={item}
								view={view}
								tagSuggestions={tagSuggestions}
							/>
						))}
					</ul>
				</section>
			))}
		</div>
	);
}
