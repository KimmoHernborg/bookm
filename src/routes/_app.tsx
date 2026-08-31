import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import { useState } from "react";

import { TagCombobox } from "#/components/tag-combobox.tsx";
import { UserMenu } from "#/components/user-menu.tsx";
import { getAuthState } from "#/lib/server/functions/auth-meta.ts";
import { addBookmark, getUserTags } from "#/lib/server/functions/bookmarks.ts";
import { getUserCategories } from "#/lib/server/functions/categories.ts";

export const Route = createFileRoute("/_app")({
	beforeLoad: async () => {
		const state = await getAuthState();
		if (!state.user) throw redirect({ to: "/login" });
		return { user: state.user };
	},
	component: AppShell,
});

function AddBookmarkForm() {
	const queryClient = useQueryClient();
	const [url, setUrl] = useState("");
	const [notice, setNotice] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [skipAi, setSkipAi] = useState(false);
	const [title, setTitle] = useState("");
	const [tags, setTags] = useState<Array<string>>([]);
	const [categoryId, setCategoryId] = useState<number | null>(null);

	const { data: userTags } = useQuery({
		queryKey: ["user-tags"],
		queryFn: () => getUserTags(),
		enabled: skipAi,
	});
	const { data: userCategories } = useQuery({
		queryKey: ["user-categories"],
		queryFn: () => getUserCategories(),
		enabled: skipAi,
	});

	async function onSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!url.trim()) return;
		setBusy(true);
		setNotice(null);
		try {
			const result = await addBookmark({
				data: skipAi ? { url, skipAi: true, title, tags, categoryId } : { url },
			});
			if (result.result === "duplicate") {
				setNotice("already saved");
			} else if (result.result === "invalid") {
				setNotice("not a valid URL");
			} else {
				setUrl("");
				setTitle("");
				setTags([]);
				setCategoryId(null);
				void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
				if (skipAi) {
					void queryClient.invalidateQueries({ queryKey: ["user-tags"] });
					void queryClient.invalidateQueries({
						queryKey: ["user-categories"],
					});
				}
			}
		} catch {
			setNotice("could not save");
		} finally {
			setBusy(false);
		}
	}

	return (
		// display:contents lets the URL row and the details panel participate
		// directly in the header's wrapping flex row.
		<form onSubmit={onSubmit} className="contents">
			<div className="flex w-full min-w-0 items-center gap-2 sm:order-2 sm:w-auto sm:flex-1">
				<input
					value={url}
					onChange={(e) => {
						setUrl(e.target.value);
						setNotice(null);
					}}
					placeholder="Paste a URL to save it"
					aria-label="Add bookmark by URL"
					className="w-full border border-hairline bg-paper px-3 py-1.5 text-[16px] outline-none placeholder:text-ink-muted focus:border-accent sm:max-w-md min-[960px]:text-[13px]"
				/>
				<label className="flex shrink-0 items-center gap-1.5 text-[13px] text-ink-secondary">
					<input
						type="checkbox"
						checked={skipAi}
						onChange={(e) => setSkipAi(e.target.checked)}
						className="accent-accent"
					/>
					Skip AI
				</label>
				<button
					type="submit"
					disabled={busy || !url.trim()}
					className="px-3 py-1.5 text-[13px] font-medium text-accent hover:text-accent-hover disabled:opacity-50"
				>
					Save
				</button>
				{notice ? (
					<span className="text-xs text-ink-muted">{notice}</span>
				) : null}
			</div>
			{skipAi ? (
				<div className="order-last flex w-full min-w-0 flex-col gap-2 bg-paper sm:flex-row sm:items-center">
					<label className="flex min-w-0 items-center gap-2 sm:flex-1">
						<span className="shrink-0 text-xs text-ink-secondary">Title</span>
						<input
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="optional"
							className="w-full min-w-0 border border-hairline bg-paper px-2 py-1.5 text-[16px] outline-none placeholder:text-ink-muted focus:border-accent min-[960px]:text-[13px]"
						/>
					</label>
					<div className="flex min-w-0 items-center gap-2 sm:flex-1">
						<span className="shrink-0 text-xs text-ink-secondary">Tags</span>
						<div className="w-full min-w-0">
							<TagCombobox
								value={tags}
								onChange={setTags}
								suggestions={userTags ?? []}
							/>
						</div>
					</div>
					<label className="flex min-w-0 items-center gap-2">
						<span className="shrink-0 text-xs text-ink-secondary">
							Category
						</span>
						<select
							value={categoryId === null ? "" : String(categoryId)}
							onChange={(e) =>
								setCategoryId(
									e.target.value === "" ? null : Number(e.target.value),
								)
							}
							className="w-full min-w-0 border border-hairline bg-paper px-2 py-1.5 text-[16px] outline-none focus:border-accent sm:w-auto min-[960px]:text-[13px]"
						>
							<option value="">Uncategorized</option>
							{(userCategories ?? []).map((c) => (
								<option key={c.id} value={c.id}>
									{c.name}
								</option>
							))}
						</select>
					</label>
				</div>
			) : null}
		</form>
	);
}

function AppShell() {
	const { user } = Route.useRouteContext();

	return (
		<div className="min-h-screen">
			<header className="border-b border-hairline">
				<div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-3 sm:px-6">
					<div className="flex items-center justify-between gap-4 sm:contents">
						<Link
							to="/"
							className="text-[15px] font-semibold tracking-tight logo sm:order-1"
						>
							<img
								src="/bookm.svg"
								alt="Bookm logo"
								className="inline h-5 w-5"
							/>
							Bookm
						</Link>
						<div className="flex items-center gap-4 sm:order-3">
							<nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-secondary">
								<Link
									to="/"
									className="-my-1 py-1 hover:text-ink"
									activeProps={{ className: "text-ink" }}
								>
									Bookmarks
								</Link>
								<Link
									to="/archived"
									className="-my-1 py-1 hover:text-ink"
									activeProps={{ className: "text-ink" }}
								>
									Archived
								</Link>
								<Link
									to="/import"
									className="-my-1 py-1 hover:text-ink"
									activeProps={{ className: "text-ink" }}
								>
									Import
								</Link>
							</nav>
							<UserMenu user={user} />
						</div>
					</div>
					<AddBookmarkForm />
				</div>
			</header>
			<Outlet />
		</div>
	);
}
