import { X } from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";

import { normalizeTag } from "#/lib/shared/tag-normalize.ts";

// Combobox with autocomplete from the user's existing tags. Typing
// filters; Enter on a non-matching value creates a new tag (normalized to
// lowercase kebab-case).
export function TagCombobox({
	value,
	onChange,
	suggestions,
}: {
	value: Array<string>;
	onChange: (tags: Array<string>) => void;
	suggestions: Array<string>;
}) {
	const [input, setInput] = useState("");
	const [open, setOpen] = useState(false);
	const [highlighted, setHighlighted] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const listId = useId();

	const filtered = useMemo(() => {
		const needle = input.trim().toLowerCase();
		return suggestions
			.filter((s) => !value.includes(s))
			.filter((s) => !needle || s.includes(needle))
			.slice(0, 8);
	}, [input, suggestions, value]);

	function add(raw: string) {
		const tag = normalizeTag(raw);
		if (tag && !value.includes(tag)) {
			onChange([...value, tag]);
		}
		setInput("");
		setHighlighted(0);
		inputRef.current?.focus();
	}

	function remove(tag: string) {
		onChange(value.filter((t) => t !== tag));
	}

	function onKeyDown(event: React.KeyboardEvent) {
		if (event.key === "Enter") {
			event.preventDefault();
			if (open && filtered[highlighted] && input.trim()) {
				// Exact-prefix navigation picks the highlighted suggestion;
				// otherwise the typed value becomes a new tag.
				if (filtered[highlighted].startsWith(input.trim().toLowerCase())) {
					add(filtered[highlighted]);
					return;
				}
			}
			if (input.trim()) add(input);
		} else if (event.key === "ArrowDown") {
			event.preventDefault();
			setOpen(true);
			setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			setHighlighted((h) => Math.max(h - 1, 0));
		} else if (event.key === "Escape") {
			setOpen(false);
		} else if (event.key === "Backspace" && !input && value.length > 0) {
			remove(value[value.length - 1]);
		}
	}

	return (
		<div className="relative">
			<div className="flex flex-wrap items-center gap-1 border border-hairline bg-paper px-2 py-1.5 focus-within:border-accent">
				{value.map((tag) => (
					<span
						key={tag}
						className="inline-flex items-center gap-1 bg-surface px-1.5 py-0.5 text-xs"
					>
						{tag}
						<button
							type="button"
							onClick={() => remove(tag)}
							aria-label={`Remove tag ${tag}`}
							className="text-ink-muted hover:text-ink"
						>
							<X className="h-3 w-3" />
						</button>
					</span>
				))}
				<input
					ref={inputRef}
					role="combobox"
					aria-expanded={open}
					aria-controls={listId}
					aria-label="Add tag"
					value={input}
					onChange={(e) => {
						setInput(e.target.value);
						setOpen(true);
						setHighlighted(0);
					}}
					onFocus={() => setOpen(true)}
					onBlur={() => setTimeout(() => setOpen(false), 150)}
					onKeyDown={onKeyDown}
					placeholder={value.length === 0 ? "Add tags…" : ""}
					className="min-w-24 flex-1 bg-transparent text-[13px] outline-none placeholder:text-ink-muted"
				/>
			</div>
			{open && filtered.length > 0 ? (
				<ul
					id={listId}
					className="absolute z-10 mt-1 w-full border border-hairline bg-paper py-1 shadow-sm"
				>
					{filtered.map((tag, index) => (
						<li key={tag}>
							<button
								type="button"
								onMouseDown={(e) => {
									e.preventDefault();
									add(tag);
								}}
								className={`block w-full px-2 py-1 text-left text-[13px] ${
									index === highlighted ? "bg-surface" : ""
								}`}
							>
								{tag}
							</button>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
