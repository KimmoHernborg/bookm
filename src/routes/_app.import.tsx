import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import {
	getImportStatus,
	type ImportSummary,
	importNetscape,
} from "#/lib/server/functions/import.ts";

export const Route = createFileRoute("/_app/import")({ component: ImportView });

function ImportView() {
	const [summary, setSummary] = useState<ImportSummary | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// After an import, poll so "N broken links detected" fills in as the
	// background fetch jobs work through the queue.
	const { data: status } = useQuery({
		queryKey: ["import-status"],
		queryFn: () => getImportStatus(),
		enabled: summary !== null,
		refetchInterval: (query) =>
			(query.state.data?.pending ?? 0) > 0 ? 2500 : false,
	});

	async function runImport(html: string) {
		setBusy(true);
		setError(null);
		try {
			setSummary(await importNetscape({ data: { html } }));
		} catch {
			setError("Import failed. Is this a bookmarks HTML export?");
		} finally {
			setBusy(false);
		}
	}

	async function onFile(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		if (!file) return;
		await runImport(await file.text());
		event.target.value = "";
	}

	return (
		<main className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
			<h1 className="text-[15px] font-semibold">Import bookmarks</h1>
			<p className="mt-1 text-[13px] text-ink-secondary">
				Upload a Netscape bookmark HTML file — the export format of Chrome,
				Firefox, and Safari. Folder names become tags. Duplicates are skipped.
			</p>

			<label
				htmlFor="import-file"
				className="mt-6 block w-fit cursor-pointer border border-hairline px-3 py-2 text-[13px] hover:bg-surface focus-within:outline focus-within:outline-2 focus-within:outline-offset-2"
			>
				{busy ? "Importing…" : "Choose bookmarks file"}
				<input
					id="import-file"
					type="file"
					accept=".html,.htm,text/html"
					onChange={(e) => void onFile(e)}
					disabled={busy}
					className="sr-only"
				/>
			</label>

			{error ? (
				<p className="mt-4 text-[13px] text-ink-muted">{error}</p>
			) : null}

			{summary ? (
				<div className="mt-6 border-t border-hairline pt-4 text-[13px]">
					<p>
						Imported {summary.imported}, skipped {summary.skippedDuplicates}{" "}
						duplicate{summary.skippedDuplicates === 1 ? "" : "s"}
						{summary.invalid > 0 ? `, ${summary.invalid} invalid` : ""}.
					</p>
					{status ? (
						<p className="mt-1 text-ink-secondary">
							{status.pending > 0
								? `${status.pending} still processing… `
								: "Processing complete. "}
							{status.broken > 0
								? `${status.broken} broken link${status.broken === 1 ? "" : "s"} detected.`
								: ""}
						</p>
					) : null}
				</div>
			) : null}
		</main>
	);
}
