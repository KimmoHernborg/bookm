import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { BookmarkGroups } from "#/components/bookmark-groups.tsx";
import {
	getBookmarksPage,
	getUserTags,
} from "#/lib/server/functions/bookmarks.ts";
import { getUserCategories } from "#/lib/server/functions/categories.ts";

export const Route = createFileRoute("/_app/")({ component: MainView });

type DateFilter = "today" | "week" | "month";

function MainView() {
	const [q, setQ] = useState("");
	// One rail filter at a time: picking a category clears the tag and
	// vice versa; "All bookmarks" clears both.
	const [category, setCategory] = useState<number | "none" | undefined>();
	const [tag, setTag] = useState<string | undefined>();
	const [date, setDate] = useState<DateFilter | undefined>();

	function pickCategory(next: number | "none" | undefined) {
		setCategory(next);
		setTag(undefined);
	}
	function pickTag(next: string) {
		setTag(next);
		setCategory(undefined);
	}

	const params = {
		view: "active" as const,
		q: q || undefined,
		category,
		tag,
		date,
	};
	const { data, isPending } = useQuery({
		queryKey: ["bookmarks", params],
		queryFn: () => getBookmarksPage({ data: params }),
		// Live-update rows while the pipeline works through pending bookmarks.
		refetchInterval: (query) =>
			query.state.data?.groups.some((g) =>
				g.bookmarks.some((b) => b.status === "pending"),
			)
				? 2500
				: false,
	});
	const { data: userTags } = useQuery({
		queryKey: ["user-tags"],
		queryFn: () => getUserTags(),
	});
	const { data: userCategories } = useQuery({
		queryKey: ["user-categories"],
		queryFn: () => getUserCategories(),
	});

	const hasAnything =
		(data?.total ?? 0) > 0 ||
		q ||
		category !== undefined ||
		tag !== undefined ||
		date;
	const activeFilterName =
		typeof category === "number"
			? data?.railCategories.find((c) => c.id === category)?.name
			: category === "none"
				? "Uncategorized"
				: tag;

	return (
		<div className="mx-auto flex max-w-6xl gap-10 px-4 py-6 max-[959px]:flex-col max-[959px]:gap-6 sm:px-6">
			<aside className="min-[960px]:sticky min-[960px]:top-6 min-[960px]:max-h-[calc(100vh-3rem)] min-[960px]:w-[180px] min-[960px]:shrink-0 min-[960px]:overflow-y-auto">
				<nav
					aria-label="Categories and tags"
					className="flex gap-1 max-[959px]:overflow-x-auto max-[959px]:[mask-image:linear-gradient(to_right,#000_calc(100%-1.5rem),transparent)] min-[960px]:flex-col"
				>
					<RailItem
						label="All bookmarks"
						active={category === undefined && tag === undefined}
						onClick={() => pickCategory(undefined)}
					/>
					<RailSectionLabel>Categories</RailSectionLabel>
					{(data?.railCategories ?? []).map((railCategory) => (
						<RailItem
							key={railCategory.id}
							label={railCategory.name}
							count={railCategory.count}
							active={category === railCategory.id}
							onClick={() => pickCategory(railCategory.id)}
						/>
					))}
					{data && data.uncategorizedCount > 0 ? (
						<RailItem
							label="Uncategorized"
							count={data.uncategorizedCount}
							active={category === "none"}
							onClick={() => pickCategory("none")}
						/>
					) : null}
					{data && data.railTags.length > 0 ? (
						<>
							<RailSectionLabel>Tags</RailSectionLabel>
							{data.railTags.map((railTag) => (
								<RailItem
									key={railTag.name}
									label={railTag.name}
									count={railTag.count}
									active={tag === railTag.name}
									onClick={() => pickTag(railTag.name)}
								/>
							))}
						</>
					) : null}
				</nav>
			</aside>

			<main className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-3 min-[960px]:flex-nowrap">
					<input
						id="search"
						type="search"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder={
							activeFilterName ? `Search in ${activeFilterName}` : "Search"
						}
						aria-label="Search bookmarks"
						className="w-full border border-hairline bg-paper px-3 py-1.5 text-[16px] outline-none placeholder:text-ink-muted focus:border-accent min-[960px]:w-auto min-[960px]:flex-1 min-[960px]:text-[13px]"
					/>
					<select
						id="date-filter"
						value={date ?? ""}
						onChange={(e) =>
							setDate((e.target.value || undefined) as DateFilter | undefined)
						}
						aria-label="Filter by date added"
						className="border border-hairline bg-paper px-2 py-1.5 text-[16px] text-ink-secondary outline-none focus:border-accent max-[959px]:flex-1 min-[960px]:shrink-0 min-[960px]:text-[13px]"
					>
						<option value="">Any time</option>
						<option value="today">Today</option>
						<option value="week">This week</option>
						<option value="month">This month</option>
					</select>
				</div>

				<div className="mt-8">
					{!data && isPending ? (
						<p className="text-[13px] text-ink-muted">Loading…</p>
					) : data && data.groups.length > 0 ? (
						<BookmarkGroups
							groups={data.groups}
							view="active"
							tagSuggestions={userTags ?? []}
							categories={userCategories ?? []}
						/>
					) : hasAnything ? (
						<p className="text-[13px] text-ink-muted">No bookmarks match.</p>
					) : (
						<div className="mt-16 text-center">
							<p className="text-[15px] font-medium">Nothing saved yet.</p>
							<p className="mt-1 text-[13px] text-ink-secondary">
								Paste a URL above to save your first bookmark.
							</p>
						</div>
					)}
				</div>
			</main>
		</div>
	);
}

function RailSectionLabel({ children }: { children: React.ReactNode }) {
	// Non-interactive divider between the rail's category and tag sections.
	// Inline in the horizontal scroll strip below 960px, so it needs the
	// self-centering rather than top margin there.
	return (
		<span className="px-2 text-[11px] font-semibold tracking-widest uppercase text-ink-muted max-[959px]:self-center min-[960px]:mt-4 min-[960px]:mb-1">
			{children}
		</span>
	);
}

function RailItem({
	label,
	count,
	active,
	onClick,
}: {
	label: string;
	count?: number;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex items-baseline justify-between gap-2 whitespace-nowrap px-2 py-1.5 text-left text-[13px] pointer-coarse:py-2 ${
				active
					? "bg-surface font-medium text-ink"
					: "text-ink-secondary hover:text-ink"
			}`}
		>
			<span className="truncate">{label}</span>
			{count !== undefined ? (
				<span className="text-xs text-ink-muted">{count}</span>
			) : null}
		</button>
	);
}
