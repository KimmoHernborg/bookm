import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { BookmarkGroups } from "#/components/bookmark-groups.tsx";
import { CONTENT_TYPES, type ContentType } from "#/db/schema.ts";
import {
	getBookmarksPage,
	getUserTags,
} from "#/lib/server/functions/bookmarks.ts";

export const Route = createFileRoute("/_app/")({ component: MainView });

type DateFilter = "today" | "week" | "month";

function MainView() {
	const [q, setQ] = useState("");
	const [tag, setTag] = useState<string | undefined>();
	const [contentType, setContentType] = useState<ContentType | undefined>();
	const [date, setDate] = useState<DateFilter | undefined>();

	const params = {
		view: "active" as const,
		q: q || undefined,
		tag,
		contentType,
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

	const hasAnything = (data?.total ?? 0) > 0 || q || tag || contentType || date;

	return (
		<div className="mx-auto flex max-w-6xl gap-10 px-4 py-6 max-[959px]:flex-col max-[959px]:gap-6 sm:px-6">
			<aside className="min-[960px]:sticky min-[960px]:top-6 min-[960px]:max-h-[calc(100vh-3rem)] min-[960px]:w-[180px] min-[960px]:shrink-0 min-[960px]:overflow-y-auto">
				<nav
					aria-label="Tags"
					className="flex gap-1 max-[959px]:overflow-x-auto max-[959px]:[mask-image:linear-gradient(to_right,#000_calc(100%-1.5rem),transparent)] min-[960px]:flex-col"
				>
					<RailItem
						label="All bookmarks"
						active={tag === undefined}
						onClick={() => setTag(undefined)}
					/>
					{(data?.railTags ?? []).map((railTag) => (
						<RailItem
							key={railTag.name}
							label={railTag.name}
							count={railTag.count}
							active={tag === railTag.name}
							onClick={() => setTag(railTag.name)}
						/>
					))}
					{data && data.untaggedCount > 0 ? (
						<span className="px-2 py-1.5 text-[13px] text-ink-muted">
							Untagged ({data.untaggedCount})
						</span>
					) : null}
				</nav>
			</aside>

			<main className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-3">
					<input
						type="search"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						placeholder={tag ? `Search in ${tag}` : "Search"}
						aria-label="Search bookmarks"
						className="w-full max-w-xs border border-hairline bg-paper px-3 py-1.5 text-[16px] outline-none placeholder:text-ink-muted focus:border-accent min-[960px]:text-[13px]"
					/>
					<select
						value={contentType ?? ""}
						onChange={(e) =>
							setContentType(
								(e.target.value || undefined) as ContentType | undefined,
							)
						}
						aria-label="Filter by content type"
						className="border border-hairline bg-paper px-2 py-1.5 text-[16px] text-ink-secondary outline-none focus:border-accent max-[959px]:flex-1 min-[960px]:text-[13px]"
					>
						<option value="">All types</option>
						{CONTENT_TYPES.map((type) => (
							<option key={type} value={type}>
								{type}
							</option>
						))}
					</select>
					<select
						value={date ?? ""}
						onChange={(e) =>
							setDate((e.target.value || undefined) as DateFilter | undefined)
						}
						aria-label="Filter by date added"
						className="border border-hairline bg-paper px-2 py-1.5 text-[16px] text-ink-secondary outline-none focus:border-accent max-[959px]:flex-1 min-[960px]:text-[13px]"
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
			className={`flex items-baseline justify-between gap-2 whitespace-nowrap px-2 py-1.5 text-left text-[13px] [@media(hover:none)]:py-2 ${
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
