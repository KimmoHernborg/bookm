import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

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
		<main className="mx-auto max-w-2xl px-6 py-6">
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
						className="border border-hairline bg-paper px-3 py-2 text-[13px] outline-none placeholder:text-ink-muted focus:border-accent"
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
		</main>
	);
}
