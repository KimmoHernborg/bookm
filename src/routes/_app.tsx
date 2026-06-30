import { useQueryClient } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
	useNavigate,
} from "@tanstack/react-router";
import { useState } from "react";

import { authClient } from "#/lib/auth-client.ts";
import { getAuthState } from "#/lib/server/functions/auth-meta.ts";
import { addBookmark } from "#/lib/server/functions/bookmarks.ts";

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

	async function onSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!url.trim()) return;
		setBusy(true);
		setNotice(null);
		try {
			const result = await addBookmark({ data: { url } });
			if (result.result === "duplicate") {
				setNotice("already saved");
			} else if (result.result === "invalid") {
				setNotice("not a valid URL");
			} else {
				setUrl("");
				void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
			}
		} catch {
			setNotice("could not save");
		} finally {
			setBusy(false);
		}
	}

	return (
		<form
			onSubmit={onSubmit}
			className="flex w-full min-w-0 items-center gap-2 sm:order-2 sm:w-auto sm:flex-1"
		>
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
			<button
				type="submit"
				disabled={busy || !url.trim()}
				className="px-3 py-1.5 text-[13px] font-medium text-accent hover:text-accent-hover disabled:opacity-50"
			>
				Save
			</button>
			{notice ? <span className="text-xs text-ink-muted">{notice}</span> : null}
		</form>
	);
}

function AppShell() {
	const { user } = Route.useRouteContext();
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	return (
		<div className="min-h-screen">
			<header className="border-b border-hairline">
				<div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6 sm:px-6">
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
						<nav className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-ink-secondary sm:order-3">
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
							<Link
								to="/settings"
								className="-my-1 py-1 hover:text-ink"
								activeProps={{ className: "text-ink" }}
							>
								Settings
							</Link>
							{user.isAdmin ? (
								<Link
									to="/admin"
									className="-my-1 py-1 hover:text-ink"
									activeProps={{ className: "text-ink" }}
								>
									Admin
								</Link>
							) : null}
							<button
								type="button"
								onClick={async () => {
									await authClient.signOut();
									queryClient.clear();
									await navigate({ to: "/login" });
								}}
								className="-my-1 py-1 text-ink-muted hover:text-ink"
							>
								Sign out
							</button>
						</nav>
					</div>
					<AddBookmarkForm />
				</div>
			</header>
			<Outlet />
		</div>
	);
}
