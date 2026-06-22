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
			className="flex min-w-0 flex-1 items-center gap-2"
		>
			<input
				value={url}
				onChange={(e) => {
					setUrl(e.target.value);
					setNotice(null);
				}}
				placeholder="Paste a URL to save it"
				aria-label="Add bookmark by URL"
				className="w-full max-w-md border border-hairline bg-paper px-3 py-1.5 text-[13px] outline-none placeholder:text-ink-muted focus:border-accent"
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
				<div className="mx-auto flex max-w-6xl items-center gap-6 px-6 py-3">
					<Link
						to="/"
						className="text-[15px] font-semibold tracking-tight logo"
					>
						<img src="/bookm.svg" alt="Bookm logo" className="inline h-5 w-5" />
						Bookm
					</Link>
					<AddBookmarkForm />
					<nav className="flex items-center gap-4 text-[13px] text-ink-secondary">
						<Link
							to="/archived"
							className="hover:text-ink"
							activeProps={{ className: "text-ink" }}
						>
							Archived
						</Link>
						<Link
							to="/import"
							className="hover:text-ink"
							activeProps={{ className: "text-ink" }}
						>
							Import
						</Link>
						<Link
							to="/settings"
							className="hover:text-ink"
							activeProps={{ className: "text-ink" }}
						>
							Settings
						</Link>
						{user.isAdmin ? (
							<Link
								to="/admin"
								className="hover:text-ink"
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
							className="text-ink-muted hover:text-ink"
						>
							Sign out
						</button>
					</nav>
				</div>
			</header>
			<Outlet />
		</div>
	);
}
