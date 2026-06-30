import { useQueryClient } from "@tanstack/react-query";
import {
	Archive,
	ArchiveRestore,
	Link as LinkIcon,
	Pencil,
	Star,
	Trash2,
} from "lucide-react";
import { useState } from "react";

import {
	type BookmarkListItem,
	deleteBookmark,
	setArchived,
	setStarred,
	updateBookmark,
} from "#/lib/server/functions/bookmarks.ts";
import { TagCombobox } from "./tag-combobox.tsx";

const STATUS_LABELS: Record<string, string> = {
	pending: "processing",
	failed: "extraction failed",
	broken: "broken link",
};

function ActionButton({
	label,
	onClick,
	children,
	alwaysVisible = false,
}: {
	label: string;
	onClick: () => void;
	children: React.ReactNode;
	alwaysVisible?: boolean;
}) {
	// Two responsive axes: [@media(hover:none)] reveals actions on touch devices
	// (which never fire :hover); min-[960px] restores the exact desktop p-1
	// geometry. Keep both — a width-only variant would re-hide every action on
	// touch, which is the bug this fixes.
	return (
		<button
			type="button"
			title={label}
			aria-label={label}
			onClick={onClick}
			className={`-m-1 p-2 text-ink-muted hover:text-ink focus-visible:opacity-100 focus-visible:outline-1 focus-visible:outline-accent min-[960px]:m-0 min-[960px]:p-1 ${
				alwaysVisible
					? ""
					: "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100"
			}`}
		>
			{children}
		</button>
	);
}

export function BookmarkRow({
	item,
	view,
	tagSuggestions,
}: {
	item: BookmarkListItem;
	view: "active" | "archived";
	tagSuggestions: Array<string>;
}) {
	const queryClient = useQueryClient();
	const [editing, setEditing] = useState(false);
	const [title, setTitle] = useState(item.title ?? "");
	const [tags, setTags] = useState(item.tags);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const statusLabel = STATUS_LABELS[item.status];
	const needsAttention = item.status === "failed" || item.status === "broken";

	function invalidate() {
		void queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
		void queryClient.invalidateQueries({ queryKey: ["user-tags"] });
	}

	function startEdit() {
		setTitle(item.title ?? "");
		setTags(item.tags);
		setError(null);
		setEditing(true);
	}

	function cancelEdit() {
		const dirty =
			title !== (item.title ?? "") || tags.join(",") !== item.tags.join(",");
		if (dirty && !window.confirm("Discard unsaved changes?")) return;
		setError(null);
		setEditing(false);
	}

	async function saveEdit(event: React.FormEvent) {
		event.preventDefault();
		setSaving(true);
		setError(null);
		try {
			await updateBookmark({ data: { id: item.id, title, tags } });
			setEditing(false);
			invalidate();
		} catch (err) {
			setError(
				err instanceof Error
					? err.message
					: "Failed to save. Please try again.",
			);
		} finally {
			setSaving(false);
		}
	}

	return (
		<li className="group -mx-2 px-2 py-1 hover:bg-surface">
			<div className="flex items-baseline gap-2 max-[959px]:items-center">
				<span className="relative min-w-0 flex-1 truncate">
					<a
						href={item.url}
						target="_blank"
						rel="noreferrer"
						title={item.description || undefined}
						className="peer text-[15px] font-[450] text-ink hover:text-accent focus-visible:text-accent focus-visible:outline-none"
					>
						{item.title || item.url}
					</a>
					{item.description ? (
						<span
							role="tooltip"
							className="pointer-events-none absolute top-full left-0 z-20 mt-1 hidden w-max max-w-[min(36rem,calc(100vw-3rem))] border border-hairline bg-paper px-3 py-2 text-[13px] leading-relaxed text-ink-secondary whitespace-normal shadow-sm peer-hover:block peer-focus-visible:block"
						>
							{item.description}
						</span>
					) : null}
				</span>
				<span className="hidden shrink-0 text-xs text-ink-secondary min-[480px]:inline">
					{item.domain}
				</span>
				{statusLabel ? (
					<span className="shrink-0 text-xs text-ink-muted">{statusLabel}</span>
				) : null}
				<span className="flex shrink-0 items-center">
					<ActionButton
						label={item.starred ? "Unstar" : "Star"}
						onClick={() => {
							void setStarred({
								data: { id: item.id, starred: !item.starred },
							}).then(invalidate);
						}}
						alwaysVisible={item.starred}
					>
						<Star
							className={`h-3.5 w-3.5 ${item.starred ? "fill-current text-ink" : ""}`}
						/>
					</ActionButton>
					{view === "active" ? (
						<ActionButton
							label="Archive"
							onClick={() => {
								void setArchived({
									data: { id: item.id, archived: true },
								}).then(invalidate);
							}}
						>
							<Archive className="h-3.5 w-3.5" />
						</ActionButton>
					) : (
						<ActionButton
							label="Unarchive"
							alwaysVisible
							onClick={() => {
								void setArchived({
									data: { id: item.id, archived: false },
								}).then(invalidate);
							}}
						>
							<ArchiveRestore className="h-3.5 w-3.5" />
						</ActionButton>
					)}
					<ActionButton
						label="Delete"
						onClick={() => {
							void deleteBookmark({ data: { id: item.id } }).then(invalidate);
						}}
					>
						<Trash2 className="h-3.5 w-3.5" />
					</ActionButton>
					<ActionButton
						label="Copy URL"
						onClick={() => {
							void navigator.clipboard.writeText(item.url);
						}}
					>
						<LinkIcon className="h-3.5 w-3.5" />
					</ActionButton>
					<ActionButton
						label="Edit"
						onClick={() => (editing ? cancelEdit() : startEdit())}
						alwaysVisible={needsAttention}
					>
						<Pencil className="h-3.5 w-3.5" />
					</ActionButton>
				</span>
			</div>
			{editing ? (
				<form
					onSubmit={saveEdit}
					className="mt-2 mb-1 flex flex-col gap-2 border border-hairline bg-paper p-3 shadow-sm"
				>
					<label className="flex flex-col gap-1">
						<span className="text-xs text-ink-secondary">Title</span>
						<input
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							className="border border-hairline bg-paper px-2 py-1.5 text-[16px] outline-none focus:border-accent min-[960px]:text-[13px]"
						/>
					</label>
					<div className="flex flex-col gap-1">
						<span className="text-xs text-ink-secondary">Tags</span>
						<TagCombobox
							value={tags}
							onChange={setTags}
							suggestions={tagSuggestions}
						/>
					</div>
					{error ? (
						<p role="alert" className="text-[13px] text-ink-muted">
							{error}
						</p>
					) : null}
					<div className="flex items-center gap-3">
						<button
							type="submit"
							disabled={saving}
							className="px-3 py-1 text-[13px] font-medium text-accent hover:text-accent-hover disabled:opacity-50"
						>
							{saving ? "Saving…" : "Save"}
						</button>
						<button
							type="button"
							onClick={cancelEdit}
							className="text-[13px] text-ink-secondary hover:text-ink"
						>
							Cancel
						</button>
					</div>
				</form>
			) : null}
		</li>
	);
}
