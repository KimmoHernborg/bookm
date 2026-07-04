import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";

import { BookmarkGroups } from "#/components/bookmark-groups.tsx";
import {
	emptyArchive,
	getBookmarksPage,
	getUserTags,
} from "#/lib/server/functions/bookmarks.ts";
import { getUserCategories } from "#/lib/server/functions/categories.ts";

export const Route = createFileRoute("/_app/archived")({
	component: ArchivedView,
});

function ArchivedView() {
	const queryClient = useQueryClient();
	const params = { view: "archived" as const };
	const { data } = useQuery({
		queryKey: ["bookmarks", params],
		queryFn: () => getBookmarksPage({ data: params }),
	});
	const { data: userTags } = useQuery({
		queryKey: ["user-tags"],
		queryFn: () => getUserTags(),
	});
	const { data: userCategories } = useQuery({
		queryKey: ["user-categories"],
		queryFn: () => getUserCategories(),
	});

	async function onEmptyArchive() {
		if (!window.confirm("Soft-delete all archived bookmarks?")) return;
		await emptyArchive();
		void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
	}

	return (
		<main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
			<div className="flex items-center justify-between">
				<h1 className="text-[15px] font-semibold">Archived</h1>
				{data && data.total > 0 ? (
					<button
						type="button"
						onClick={() => void onEmptyArchive()}
						className="text-[13px] text-ink-secondary hover:text-ink"
					>
						Empty archive
					</button>
				) : null}
			</div>
			<div className="mt-6">
				{data && data.groups.length > 0 ? (
					<BookmarkGroups
						groups={data.groups}
						view="archived"
						tagSuggestions={userTags ?? []}
						categories={userCategories ?? []}
					/>
				) : (
					<p className="text-[13px] text-ink-muted">Nothing archived.</p>
				)}
			</div>
		</main>
	);
}
