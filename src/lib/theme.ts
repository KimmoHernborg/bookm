import { useSyncExternalStore } from "react";

import {
	parseThemeMode,
	resolveTheme,
	THEME_STORAGE_KEY,
	type ThemeMode,
} from "#/lib/shared/theme.ts";

const listeners = new Set<() => void>();

function readMode(): ThemeMode {
	if (typeof window === "undefined") {
		return "system";
	}
	try {
		return parseThemeMode(localStorage.getItem(THEME_STORAGE_KEY));
	} catch {
		return "system";
	}
}

function systemPrefersDark(): boolean {
	return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function applyMode(mode: ThemeMode) {
	const dark = resolveTheme(mode, systemPrefersDark()) === "dark";
	document.documentElement.classList.toggle("dark", dark);
}

function notify() {
	for (const listener of listeners) {
		listener();
	}
}

export function setThemeMode(mode: ThemeMode) {
	try {
		// "system" is the absence of a choice: keep localStorage empty so the
		// no-FOUC script's media-query fallback stays the single default.
		if (mode === "system") {
			localStorage.removeItem(THEME_STORAGE_KEY);
		} else {
			localStorage.setItem(THEME_STORAGE_KEY, mode);
		}
	} catch {
		// Storage unavailable (private mode); still theme this page.
	}
	applyMode(mode);
	notify();
}

function onSystemChange() {
	if (readMode() === "system") {
		applyMode("system");
	}
}

function onStorage(event: StorageEvent) {
	// Another tab changed the theme; mirror it here.
	if (event.key === null || event.key === THEME_STORAGE_KEY) {
		applyMode(readMode());
		notify();
	}
}

// Attached once per page, not per subscriber: the switcher only mounts while
// the menu is open, but OS-preference flips must re-theme the page anytime.
if (typeof window !== "undefined") {
	const media = window.matchMedia("(prefers-color-scheme: dark)");
	media.addEventListener("change", onSystemChange);
	window.addEventListener("storage", onStorage);
	// Vite HMR re-evaluates this module; drop the old handlers so they
	// don't stack up during dev.
	import.meta.hot?.dispose(() => {
		media.removeEventListener("change", onSystemChange);
		window.removeEventListener("storage", onStorage);
	});
}

function subscribe(callback: () => void) {
	listeners.add(callback);
	return () => {
		listeners.delete(callback);
	};
}

function serverSnapshot(): ThemeMode {
	return "system";
}

export function useThemeMode(): [ThemeMode, (mode: ThemeMode) => void] {
	const mode = useSyncExternalStore(subscribe, readMode, serverSnapshot);
	return [mode, setThemeMode];
}
