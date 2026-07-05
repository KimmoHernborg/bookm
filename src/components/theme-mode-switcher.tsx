import { useId } from "react";

import {
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
} from "#/components/ui/dropdown-menu.tsx";
import type { ThemeMode } from "#/lib/shared/theme.ts";
import { parseThemeMode } from "#/lib/shared/theme.ts";
import { useThemeMode } from "#/lib/theme.ts";
import { cn } from "#/lib/utils.ts";

const MODES: { value: ThemeMode; label: string }[] = [
	{ value: "system", label: "System" },
	{ value: "light", label: "Light" },
	{ value: "dark", label: "Dark" },
];

export function ThemeModeSwitcher({
	variant = "segmented",
}: {
	variant?: "segmented" | "menu";
}) {
	const [mode, setMode] = useThemeMode();

	if (variant === "menu") {
		return (
			<DropdownMenuRadioGroup
				value={mode}
				onValueChange={(value) => setMode(parseThemeMode(value))}
			>
				{MODES.map(({ value, label }) => (
					<DropdownMenuRadioItem
						key={value}
						value={value}
						// Keep the menu open so all three options stay comparable.
						onSelect={(event) => event.preventDefault()}
					>
						{label}
					</DropdownMenuRadioItem>
				))}
			</DropdownMenuRadioGroup>
		);
	}

	return <SegmentedControl mode={mode} onChange={setMode} />;
}

function SegmentedControl({
	mode,
	onChange,
}: {
	mode: ThemeMode;
	onChange: (mode: ThemeMode) => void;
}) {
	// Radios group by name document-wide; scope it per instance.
	const name = useId();

	return (
		<fieldset className="inline-flex border border-hairline">
			<legend className="sr-only">Theme</legend>
			{MODES.map(({ value, label }) => {
				const active = value === mode;
				return (
					<label
						key={value}
						className={cn(
							"px-3 py-1.5 text-[13px] has-focus-visible:ring-2 has-focus-visible:ring-accent",
							active
								? "bg-surface font-medium text-ink"
								: "text-ink-secondary hover:text-ink",
						)}
					>
						<input
							type="radio"
							name={name}
							value={value}
							checked={active}
							onChange={() => onChange(value)}
							className="sr-only"
						/>
						{label}
					</label>
				);
			})}
		</fieldset>
	);
}
