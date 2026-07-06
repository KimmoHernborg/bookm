export type ThemeMode = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

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
