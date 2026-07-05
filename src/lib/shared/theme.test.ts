import { describe, expect, it } from "vitest";

import { parseThemeMode, resolveTheme } from "./theme.ts";

describe("parseThemeMode", () => {
	it("returns system when nothing is stored", () => {
		expect(parseThemeMode(null)).toBe("system");
	});

	it("returns valid stored modes", () => {
		expect(parseThemeMode("light")).toBe("light");
		expect(parseThemeMode("dark")).toBe("dark");
		expect(parseThemeMode("system")).toBe("system");
	});

	it("falls back to system on garbage", () => {
		expect(parseThemeMode("")).toBe("system");
		expect(parseThemeMode("DARK")).toBe("system");
		expect(parseThemeMode("solarized")).toBe("system");
	});
});

describe("resolveTheme", () => {
	it("follows the OS preference in system mode", () => {
		expect(resolveTheme("system", true)).toBe("dark");
		expect(resolveTheme("system", false)).toBe("light");
	});

	it("ignores the OS preference for explicit modes", () => {
		expect(resolveTheme("light", true)).toBe("light");
		expect(resolveTheme("light", false)).toBe("light");
		expect(resolveTheme("dark", true)).toBe("dark");
		expect(resolveTheme("dark", false)).toBe("dark");
	});
});
