import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { CategoryList } from "#/components/category-list.tsx";
import { ThemeModeSwitcher } from "#/components/theme-mode-switcher.tsx";
import { authClient } from "#/lib/auth-client.ts";
import {
	backfillCategories,
	createCategory,
	deleteCategory,
	getUserCategories,
	renameCategory,
} from "#/lib/server/functions/categories.ts";
import {
	getSettings,
	updateSettings,
} from "#/lib/server/functions/settings.ts";
import {
	disableShowcase,
	generateShowcaseToken,
	getShowcaseStatus,
} from "#/lib/server/functions/showcase.ts";

export const Route = createFileRoute("/_app/settings")({
	component: SettingsView,
});

function SettingsView() {
	const queryClient = useQueryClient();
	const { data } = useQuery({
		queryKey: ["settings"],
		queryFn: () => getSettings(),
	});
	const [model, setModel] = useState("");
	const [saved, setSaved] = useState(false);
	const [busy, setBusy] = useState(false);
	const initialized = useRef(false);

	useEffect(() => {
		if (data && !initialized.current) {
			initialized.current = true;
			setModel(data.openrouterModel);
		}
	}, [data]);

	async function onSubmit(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		try {
			await updateSettings({
				data: { openrouterModel: model },
			});
			setSaved(true);
			setTimeout(() => setSaved(false), 2000);
			void queryClient.invalidateQueries({ queryKey: ["settings"] });
		} finally {
			setBusy(false);
		}
	}

	return (
		<main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
			<h1 className="text-[15px] font-semibold">Settings</h1>
			{data ? (
				<p className="mt-1 text-[13px] text-ink-secondary">
					Signed in as {data.email}
				</p>
			) : null}
			<form onSubmit={onSubmit} className="mt-8 flex max-w-md flex-col gap-4">
				<label className="flex flex-col gap-1">
					<span className="text-xs text-ink-secondary">OpenRouter model</span>
					<input
						value={model}
						onChange={(e) => setModel(e.target.value)}
						placeholder={
							data ? `Server default: ${data.serverDefaultModel}` : ""
						}
						className="border border-hairline bg-paper px-3 py-2 text-[16px] outline-none placeholder:text-ink-muted focus:border-accent min-[960px]:text-[13px]"
					/>
					<span className="text-xs text-ink-muted">
						Any model slug, e.g. anthropic/claude-haiku-4.5. Leave empty for the
						server default.
					</span>
				</label>
				<div className="flex items-center gap-3">
					<button
						type="submit"
						disabled={busy}
						className="w-fit bg-accent px-3 py-1.5 text-[13px] font-medium text-paper hover:bg-accent-hover disabled:opacity-60"
					>
						Save
					</button>
					{saved ? (
						<span className="text-xs text-ink-muted">Saved.</span>
					) : null}
				</div>
			</form>

			<AppearanceSection />

			<AccountSection />

			<CategoriesSection />

			<ShowcaseSection />
		</main>
	);
}

function AppearanceSection() {
	return (
		<section className="mt-12 max-w-md">
			<h2 className="text-[11px] font-semibold tracking-widest uppercase text-ink-secondary">
				Appearance
			</h2>
			<div className="mt-4 flex flex-col gap-1">
				<ThemeModeSwitcher />
				<span className="text-xs text-ink-muted">
					System follows your device setting. Stored in this browser.
				</span>
			</div>
		</section>
	);
}

function AccountSection() {
	return (
		<section className="mt-12 max-w-md">
			<h2 className="text-[11px] font-semibold tracking-widest uppercase text-ink-secondary">
				Account
			</h2>
			<ProfileForm />
			<PasswordForm />
		</section>
	);
}

function ProfileForm() {
	const queryClient = useQueryClient();
	const router = useRouter();
	const { data } = useQuery({
		queryKey: ["settings"],
		queryFn: () => getSettings(),
	});
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const [busy, setBusy] = useState(false);
	const initialized = useRef(false);

	useEffect(() => {
		if (data && !initialized.current) {
			initialized.current = true;
			setName(data.name);
			setEmail(data.email);
		}
	}, [data]);

	async function onSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (!data) return;
		setBusy(true);
		setError(null);
		try {
			const newName = name.trim();
			const newEmail = email.trim().toLowerCase();
			if (newName === "") {
				setError("Name is required");
				return;
			}
			if (newName !== data.name) {
				const result = await authClient.updateUser({ name: newName });
				if (result.error) {
					setError(result.error.message ?? "Could not update name");
					return;
				}
			}
			if (newEmail !== data.email) {
				const result = await authClient.changeEmail({ newEmail });
				if (result.error) {
					setError(result.error.message ?? "Could not update email");
					return;
				}
				// changeEmail reports success without changing anything when the
				// address belongs to another user (enumeration protection), so
				// confirm the change actually landed.
				const session = await authClient.getSession({
					query: { disableCookieCache: true },
				});
				if (session.data?.user.email !== newEmail) {
					setError("That email is already in use.");
					return;
				}
			}
			setSaved(true);
			setTimeout(() => setSaved(false), 2000);
		} finally {
			setBusy(false);
			void queryClient.invalidateQueries({ queryKey: ["settings"] });
			void router.invalidate();
		}
	}

	return (
		<form onSubmit={onSubmit} className="mt-4 flex flex-col gap-4">
			<label className="flex flex-col gap-1">
				<span className="text-xs text-ink-secondary">Name</span>
				<input
					required
					maxLength={100}
					autoComplete="name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					className="border border-hairline bg-paper px-3 py-2 text-[16px] outline-none focus:border-accent min-[960px]:text-[13px]"
				/>
			</label>
			<label className="flex flex-col gap-1">
				<span className="text-xs text-ink-secondary">Email</span>
				<input
					type="email"
					required
					autoComplete="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					className="border border-hairline bg-paper px-3 py-2 text-[16px] outline-none focus:border-accent min-[960px]:text-[13px]"
				/>
			</label>
			{error ? (
				<p role="alert" className="text-xs text-ink-muted">
					{error}
				</p>
			) : null}
			<div className="flex items-center gap-3">
				<button
					type="submit"
					disabled={busy}
					className="w-fit bg-accent px-3 py-1.5 text-[13px] font-medium text-paper hover:bg-accent-hover disabled:opacity-60"
				>
					Save
				</button>
				{saved ? <span className="text-xs text-ink-muted">Saved.</span> : null}
			</div>
		</form>
	);
}

function PasswordForm() {
	const [currentPassword, setCurrentPassword] = useState("");
	const [newPassword, setNewPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);
	const [busy, setBusy] = useState(false);

	async function onSubmit(event: React.FormEvent) {
		event.preventDefault();
		if (newPassword !== confirmPassword) {
			setError("Passwords do not match");
			return;
		}
		setBusy(true);
		setError(null);
		try {
			const result = await authClient.changePassword({
				currentPassword,
				newPassword,
				// Sign out any other devices; this browser gets a fresh session.
				revokeOtherSessions: true,
			});
			if (result.error) {
				setError(result.error.message ?? "Could not change password");
				return;
			}
			setCurrentPassword("");
			setNewPassword("");
			setConfirmPassword("");
			setSaved(true);
			setTimeout(() => setSaved(false), 2000);
		} finally {
			setBusy(false);
		}
	}

	return (
		<form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
			<label className="flex flex-col gap-1">
				<span className="text-xs text-ink-secondary">Current password</span>
				<input
					type="password"
					required
					autoComplete="current-password"
					value={currentPassword}
					onChange={(e) => setCurrentPassword(e.target.value)}
					className="border border-hairline bg-paper px-3 py-2 text-[16px] outline-none focus:border-accent min-[960px]:text-[13px]"
				/>
			</label>
			<label className="flex flex-col gap-1">
				<span className="text-xs text-ink-secondary">New password</span>
				<input
					type="password"
					required
					minLength={8}
					maxLength={128}
					autoComplete="new-password"
					value={newPassword}
					onChange={(e) => setNewPassword(e.target.value)}
					className="border border-hairline bg-paper px-3 py-2 text-[16px] outline-none focus:border-accent min-[960px]:text-[13px]"
				/>
			</label>
			<label className="flex flex-col gap-1">
				<span className="text-xs text-ink-secondary">Confirm new password</span>
				<input
					type="password"
					required
					minLength={8}
					maxLength={128}
					autoComplete="new-password"
					value={confirmPassword}
					onChange={(e) => setConfirmPassword(e.target.value)}
					className="border border-hairline bg-paper px-3 py-2 text-[16px] outline-none focus:border-accent min-[960px]:text-[13px]"
				/>
			</label>
			{error ? (
				<p role="alert" className="text-xs text-ink-muted">
					{error}
				</p>
			) : null}
			<div className="flex items-center gap-3">
				<button
					type="submit"
					disabled={busy}
					className="w-fit bg-accent px-3 py-1.5 text-[13px] font-medium text-paper hover:bg-accent-hover disabled:opacity-60"
				>
					Change password
				</button>
				{saved ? <span className="text-xs text-ink-muted">Saved.</span> : null}
			</div>
		</form>
	);
}

function CategoriesSection() {
	const queryClient = useQueryClient();
	const { data: categories } = useQuery({
		queryKey: ["user-categories"],
		queryFn: () => getUserCategories(),
	});
	const [backfillResult, setBackfillResult] = useState<number | null>(null);
	const [backfillError, setBackfillError] = useState<string | null>(null);
	const [backfillBusy, setBackfillBusy] = useState(false);

	function refresh() {
		void queryClient.invalidateQueries({ queryKey: ["user-categories"] });
		// Renames and deletes change rail labels, groups, and counts.
		void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
	}

	async function onBackfill() {
		setBackfillBusy(true);
		setBackfillError(null);
		try {
			const result = await backfillCategories();
			setBackfillResult(result.enqueued);
		} catch (err) {
			setBackfillResult(null);
			setBackfillError(
				err instanceof Error ? err.message : "Something went wrong",
			);
		} finally {
			setBackfillBusy(false);
		}
	}

	return (
		<section className="mt-12 max-w-md">
			<h2 className="text-[11px] font-semibold tracking-widest uppercase text-ink-secondary">
				Categories
			</h2>
			<p className="mt-1 mb-2 text-xs text-ink-muted">
				The AI files each new bookmark into one of these.
			</p>
			<CategoryList
				items={(categories ?? []).map((c) => ({
					id: c.id,
					name: c.name,
					detail:
						c.bookmarkCount === 1
							? "1 bookmark"
							: `${c.bookmarkCount} bookmarks`,
				}))}
				onCreate={async (name) => {
					await createCategory({ data: { name } });
					refresh();
				}}
				onRename={async (id, name) => {
					await renameCategory({ data: { id, name } });
					refresh();
				}}
				onDelete={async (id) => {
					await deleteCategory({ data: { id } });
					refresh();
				}}
				deleteConfirm={(name) =>
					`Delete "${name}"? Its bookmarks become Uncategorized.`
				}
				addLabel="Add category"
			/>
			<div className="mt-6 flex items-center gap-3">
				<button
					type="button"
					disabled={backfillBusy}
					onClick={() => void onBackfill()}
					className="w-fit border border-hairline px-3 py-1.5 text-[13px] text-ink-secondary hover:text-ink disabled:opacity-60"
				>
					Categorize existing bookmarks with AI
				</button>
				{backfillError !== null ? (
					<span role="alert" className="text-xs text-ink-muted">
						{backfillError}
					</span>
				) : backfillResult !== null ? (
					<span className="text-xs text-ink-muted">
						{backfillResult === 0
							? "Nothing to categorize."
							: `Enqueued ${backfillResult} bookmark${backfillResult === 1 ? "" : "s"}.`}
					</span>
				) : null}
			</div>
		</section>
	);
}

function ShowcaseSection() {
	const queryClient = useQueryClient();
	const { data } = useQuery({
		queryKey: ["showcase"],
		queryFn: () => getShowcaseStatus(),
	});
	const [copied, setCopied] = useState(false);
	const [busy, setBusy] = useState(false);

	function refresh() {
		void queryClient.invalidateQueries({ queryKey: ["showcase"] });
	}

	async function onGenerate() {
		setBusy(true);
		try {
			await generateShowcaseToken();
			refresh();
		} finally {
			setBusy(false);
		}
	}

	async function onDisable() {
		setBusy(true);
		try {
			await disableShowcase();
			refresh();
		} finally {
			setBusy(false);
		}
	}

	const shareUrl =
		data?.token != null ? `${window.location.origin}/s/${data.token}` : null;

	return (
		<section className="mt-12 max-w-md">
			<h2 className="text-[11px] font-semibold tracking-widest uppercase text-ink-secondary">
				Public showcase
			</h2>
			<p className="mt-1 mb-2 text-xs text-ink-muted">
				Share a public, read-only page of your starred bookmarks. Anyone with
				the link can view it — no account needed.
			</p>
			{data == null ? null : shareUrl == null ? (
				<button
					type="button"
					disabled={busy}
					onClick={() => void onGenerate()}
					className="mt-2 w-fit bg-accent px-3 py-1.5 text-[13px] font-medium text-paper hover:bg-accent-hover disabled:opacity-60"
				>
					Enable public showcase
				</button>
			) : (
				<div className="mt-2 flex flex-col gap-3">
					<input
						readOnly
						value={shareUrl}
						onFocus={(e) => e.target.select()}
						className="border border-hairline bg-paper px-3 py-2 text-[16px] outline-none focus:border-accent min-[960px]:text-[13px]"
					/>
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={() => {
								void navigator.clipboard.writeText(shareUrl);
								setCopied(true);
								setTimeout(() => setCopied(false), 2000);
							}}
							className="w-fit bg-accent px-3 py-1.5 text-[13px] font-medium text-paper hover:bg-accent-hover"
						>
							Copy link
						</button>
						<button
							type="button"
							disabled={busy}
							onClick={() => {
								if (
									window.confirm(
										"Generate a new link? The current link stops working.",
									)
								) {
									void onGenerate();
								}
							}}
							className="w-fit border border-hairline px-3 py-1.5 text-[13px] text-ink-secondary hover:text-ink disabled:opacity-60"
						>
							Regenerate
						</button>
						<button
							type="button"
							disabled={busy}
							onClick={() => {
								if (
									window.confirm(
										"Disable the public showcase? The link stops working.",
									)
								) {
									void onDisable();
								}
							}}
							className="w-fit border border-hairline px-3 py-1.5 text-[13px] text-ink-secondary hover:text-ink disabled:opacity-60"
						>
							Disable
						</button>
						{copied ? (
							<span className="text-xs text-ink-muted">Copied.</span>
						) : null}
					</div>
				</div>
			)}
		</section>
	);
}
