import { useState } from "react";

const cell = "py-1.5 pr-4 text-[13px] align-top";

// Inline-editable name list used for a user's categories (Settings) and the
// admin default-categories template. Callers refresh their queries in the
// callbacks; errors thrown there surface below the list.
export function CategoryList({
	items,
	onCreate,
	onRename,
	onDelete,
	deleteConfirm,
	addLabel,
}: {
	items: Array<{ id: number; name: string; detail?: string }>;
	onCreate: (name: string) => Promise<void>;
	onRename: (id: number, name: string) => Promise<void>;
	onDelete: (id: number) => Promise<void>;
	deleteConfirm: (name: string) => string;
	addLabel: string;
}) {
	const [newName, setNewName] = useState("");
	const [renamingId, setRenamingId] = useState<number | null>(null);
	const [renameValue, setRenameValue] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);

	async function run(action: () => Promise<void>) {
		if (busy) return;
		setBusy(true);
		setError(null);
		try {
			await action();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setBusy(false);
		}
	}

	return (
		<div>
			<div className="border-t border-hairline">
				{items.length === 0 ? (
					<p className="pt-2 text-[13px] text-ink-muted">No categories yet.</p>
				) : (
					<table className="w-full">
						<tbody>
							{items.map((item) => (
								<tr
									key={item.id}
									className="border-t border-hairline first:border-t-0"
								>
									<td className={`${cell} w-full`}>
										{renamingId === item.id ? (
											<form
												onSubmit={(e) => {
													e.preventDefault();
													void run(async () => {
														await onRename(item.id, renameValue);
														setRenamingId(null);
													});
												}}
												className="flex items-center gap-2"
											>
												<input
													// biome-ignore lint/a11y/noAutofocus: focus follows the explicit Rename click
													autoFocus
													value={renameValue}
													onChange={(e) => setRenameValue(e.target.value)}
													className="border border-hairline bg-paper px-2 py-1 text-[16px] outline-none focus:border-accent min-[960px]:text-[13px]"
												/>
												<button
													type="submit"
													disabled={busy}
													className="text-[13px] font-medium text-accent hover:text-accent-hover disabled:opacity-60"
												>
													Save
												</button>
												<button
													type="button"
													onClick={() => setRenamingId(null)}
													className="text-[13px] text-ink-secondary hover:text-ink"
												>
													Cancel
												</button>
											</form>
										) : (
											item.name
										)}
									</td>
									<td className={`${cell} whitespace-nowrap text-ink-muted`}>
										{item.detail ?? ""}
									</td>
									<td className={`${cell} whitespace-nowrap`}>
										{renamingId === item.id ? null : (
											<>
												<button
													type="button"
													disabled={busy}
													onClick={() => {
														setRenamingId(item.id);
														setRenameValue(item.name);
													}}
													className="text-accent hover:text-accent-hover disabled:opacity-60"
												>
													Rename
												</button>
												<button
													type="button"
													disabled={busy}
													onClick={() => {
														if (!window.confirm(deleteConfirm(item.name)))
															return;
														void run(() => onDelete(item.id));
													}}
													className="ml-3 text-ink-secondary hover:text-ink disabled:opacity-60"
												>
													Delete
												</button>
											</>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					if (!newName.trim()) return;
					void run(async () => {
						await onCreate(newName);
						setNewName("");
					});
				}}
				className="mt-3 flex items-center gap-2"
			>
				<input
					value={newName}
					onChange={(e) => setNewName(e.target.value)}
					placeholder="New category"
					aria-label={addLabel}
					className="border border-hairline bg-paper px-2 py-1.5 text-[16px] outline-none placeholder:text-ink-muted focus:border-accent min-[960px]:text-[13px]"
				/>
				<button
					type="submit"
					disabled={busy}
					className="px-3 py-1.5 text-[13px] font-medium text-accent hover:text-accent-hover disabled:opacity-60"
				>
					{addLabel}
				</button>
			</form>
			{error ? (
				<p role="alert" className="mt-2 text-[13px] text-ink-muted">
					{error}
				</p>
			) : null}
		</div>
	);
}
