import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";

import {
	adminCreateUser,
	adminRetryJob,
	adminSetAdmin,
	getAdminOverview,
} from "#/lib/server/functions/admin.ts";
import { getAuthState } from "#/lib/server/functions/auth-meta.ts";

export const Route = createFileRoute("/_app/admin")({
	beforeLoad: async () => {
		const state = await getAuthState();
		if (!state.user?.isAdmin) throw redirect({ to: "/" });
	},
	component: AdminView,
});

function formatDate(ms: number): string {
	return new Date(ms).toLocaleString(undefined, {
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function SectionHeading({ children }: { children: React.ReactNode }) {
	return (
		<h2 className="mt-10 text-[11px] font-semibold tracking-[0.10em] uppercase text-ink-secondary">
			{children}
		</h2>
	);
}

const cell = "py-1.5 pr-4 text-[13px] align-top";
const headCell = "py-1.5 pr-4 text-left text-xs font-medium text-ink-secondary";

function AdminView() {
	const queryClient = useQueryClient();
	const { data } = useQuery({
		queryKey: ["admin-overview"],
		queryFn: () => getAdminOverview(),
		refetchInterval: 5000,
	});

	function refresh() {
		void queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
	}

	const [email, setEmail] = useState("");
	const [name, setName] = useState("");
	const [password, setPassword] = useState("");
	const [createError, setCreateError] = useState<string | null>(null);

	async function onCreateUser(event: React.FormEvent) {
		event.preventDefault();
		setCreateError(null);
		try {
			await adminCreateUser({ data: { email, name, password } });
			setEmail("");
			setName("");
			setPassword("");
			refresh();
		} catch (error) {
			setCreateError(error instanceof Error ? error.message : "Failed");
		}
	}

	if (!data) {
		return (
			<main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
				<p className="text-[13px] text-ink-muted">Loading…</p>
			</main>
		);
	}

	return (
		<main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
			<h1 className="text-[15px] font-semibold">Admin</h1>

			<SectionHeading>Stats</SectionHeading>
			<div className="mt-2 border-t border-hairline pt-2 text-[13px]">
				{data.jobStats.length === 0 ? (
					<p className="text-ink-muted">No jobs yet.</p>
				) : (
					<p className="text-ink-secondary">
						Jobs:{" "}
						{data.jobStats
							.map((stat) => `${stat.value} ${stat.status}`)
							.join(" · ")}
					</p>
				)}
			</div>

			<SectionHeading>Jobs</SectionHeading>
			<div className="mt-2 overflow-x-auto border-t border-hairline">
				{data.jobs.length === 0 ? (
					<p className="pt-2 text-[13px] text-ink-muted">
						No pending, running, or failed jobs.
					</p>
				) : (
					<table className="w-full">
						<thead>
							<tr>
								<th className={headCell}>Kind</th>
								<th className={headCell}>Status</th>
								<th className={headCell}>URL</th>
								<th className={headCell}>User</th>
								<th className={headCell}>Attempts</th>
								<th className={headCell}>Last error</th>
								<th className={headCell} />
							</tr>
						</thead>
						<tbody>
							{data.jobs.map((job) => (
								<tr key={job.id} className="border-t border-hairline">
									<td className={cell}>{job.kind}</td>
									<td className={cell}>{job.status}</td>
									<td className={`${cell} max-w-64 truncate`}>
										{job.bookmarkUrl ?? "—"}
									</td>
									<td className={cell}>{job.userEmail ?? "—"}</td>
									<td className={cell}>{job.attempts}</td>
									<td className={`${cell} max-w-72 truncate text-ink-muted`}>
										{job.lastError ?? ""}
									</td>
									<td className={cell}>
										{job.status === "failed" ? (
											<button
												type="button"
												onClick={() => {
													void adminRetryJob({ data: { id: job.id } }).then(
														refresh,
													);
												}}
												className="text-accent hover:text-accent-hover"
											>
												Retry
											</button>
										) : null}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>

			<SectionHeading>Users</SectionHeading>
			<div className="mt-2 overflow-x-auto border-t border-hairline">
				<table className="w-full">
					<thead>
						<tr>
							<th className={headCell}>Email</th>
							<th className={headCell}>Bookmarks</th>
							<th className={headCell}>Joined</th>
							<th className={headCell}>Admin</th>
							<th className={headCell} />
						</tr>
					</thead>
					<tbody>
						{data.users.map((u) => (
							<tr key={u.id} className="border-t border-hairline">
								<td className={cell}>{u.email}</td>
								<td className={cell}>{u.bookmarkCount}</td>
								<td className={cell}>{formatDate(u.createdAt)}</td>
								<td className={cell}>{u.isAdmin ? "yes" : "no"}</td>
								<td className={cell}>
									<button
										type="button"
										onClick={() => {
											void adminSetAdmin({
												data: { userId: u.id, isAdmin: !u.isAdmin },
											})
												.then(refresh)
												.catch((error) => window.alert(String(error)));
										}}
										className="text-accent hover:text-accent-hover"
									>
										{u.isAdmin ? "Demote" : "Promote"}
									</button>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<form
				onSubmit={onCreateUser}
				className="mt-4 flex flex-wrap items-end gap-2 max-[959px]:flex-col max-[959px]:items-stretch"
			>
				<label className="flex flex-col gap-1">
					<span className="text-xs text-ink-secondary">Email</span>
					<input
						type="email"
						required
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className="w-full border border-hairline bg-paper px-2 py-1.5 text-[16px] outline-none focus:border-accent min-[960px]:w-auto min-[960px]:text-[13px]"
					/>
				</label>
				<label className="flex flex-col gap-1">
					<span className="text-xs text-ink-secondary">Name</span>
					<input
						required
						value={name}
						onChange={(e) => setName(e.target.value)}
						className="w-full border border-hairline bg-paper px-2 py-1.5 text-[16px] outline-none focus:border-accent min-[960px]:w-auto min-[960px]:text-[13px]"
					/>
				</label>
				<label className="flex flex-col gap-1">
					<span className="text-xs text-ink-secondary">Password</span>
					<input
						type="password"
						required
						minLength={8}
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						className="w-full border border-hairline bg-paper px-2 py-1.5 text-[16px] outline-none focus:border-accent min-[960px]:w-auto min-[960px]:text-[13px]"
					/>
				</label>
				<button
					type="submit"
					className="bg-accent px-3 py-1.5 text-[13px] font-medium text-paper hover:bg-accent-hover"
				>
					Create user
				</button>
				{createError ? (
					<span className="text-xs text-ink-muted">{createError}</span>
				) : null}
			</form>

			<SectionHeading>Broken links</SectionHeading>
			<div className="mt-2 overflow-x-auto border-t border-hairline">
				{data.broken.length === 0 ? (
					<p className="pt-2 text-[13px] text-ink-muted">No broken links.</p>
				) : (
					<table className="w-full">
						<thead>
							<tr>
								<th className={headCell}>URL</th>
								<th className={headCell}>User</th>
								<th className={headCell}>First seen broken</th>
							</tr>
						</thead>
						<tbody>
							{data.broken.map((b) => (
								<tr key={b.id} className="border-t border-hairline">
									<td className={`${cell} max-w-96 truncate`}>{b.url}</td>
									<td className={cell}>{b.userEmail}</td>
									<td className={cell}>{formatDate(b.updatedAt)}</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		</main>
	);
}
