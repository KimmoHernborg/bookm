import { describe, expect, it } from "vitest";

import { gravatarUrl, initialsFor, normalizeGravatarEmail } from "./avatar.ts";

describe("normalizeGravatarEmail", () => {
	it("trims and lowercases", () => {
		expect(normalizeGravatarEmail("  Foo@BAR.com ")).toBe("foo@bar.com");
	});

	it("leaves an already-normal email unchanged", () => {
		expect(normalizeGravatarEmail("a@b.c")).toBe("a@b.c");
	});
});

describe("gravatarUrl", () => {
	it("builds a gravatar URL with size and 404 fallback", () => {
		expect(gravatarUrl("abc123", 64)).toBe(
			"https://www.gravatar.com/avatar/abc123?s=64&d=404",
		);
	});
});

describe("initialsFor", () => {
	it("uses first and last word of a two-word name", () => {
		expect(initialsFor("Kimmo Hernborg", "k@example.com")).toBe("KH");
	});

	it("uses first and last word of a longer name", () => {
		expect(initialsFor("Anna Maria von Berg", "a@example.com")).toBe("AB");
	});

	it("uses a single letter for a one-word name", () => {
		expect(initialsFor("Kimmo", "k@example.com")).toBe("K");
	});

	it("uppercases and ignores surrounding whitespace", () => {
		expect(initialsFor("  kimmo   hernborg  ", "k@example.com")).toBe("KH");
	});

	it("falls back to the email's first letter when the name is empty", () => {
		expect(initialsFor("", "kimmo@example.com")).toBe("K");
	});

	it("falls back to ? when both are empty", () => {
		expect(initialsFor("", "  ")).toBe("?");
	});
});
