import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { CategoryList } from "#/components/category-list.tsx";
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

			<CategoriesSection />
		</main>
	);
}

function CategoriesSection() {
	const queryClient = useQueryClient();
	const { data: categories } = useQuery({
		queryKey: ["user-categories"],
		queryFn: () => getUserCategories(),
	});
	const [backfillResult, setBackfillResult] = useState<number | null>(null);
	const [backfillBusy, setBackfillBusy] = useState(false);

	function refresh() {
		void queryClient.invalidateQueries({ queryKey: ["user-categories"] });
		// Renames and deletes change rail labels, groups, and counts.
		void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
	}

	async function onBackfill() {
		setBackfillBusy(true);
		try {
			const result = await backfillCategories();
			setBackfillResult(result.enqueued);
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
				{backfillResult !== null ? (
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
