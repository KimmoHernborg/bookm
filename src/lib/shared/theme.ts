export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

// Also hardcoded in the no-FOUC inline script in src/routes/__root.tsx,
// which must stay dependency-free — keep the two in sync.
export const THEME_STORAGE_KEY = "bookm-theme";

export function parseThemeMode(value: string | null): ThemeMode {
	return value === "light" || value === "dark" ? value : "system";
}

export function resolveTheme(
	mode: ThemeMode,
	systemPrefersDark: boolean,
): ResolvedTheme {
	if (mode === "system") {
		return systemPrefersDark ? "dark" : "light";
	}
	return mode;
}
