import { describe, expect, it } from "vitest";

import { matchCategory } from "./category-match.ts";

const CATEGORIES = [
	{ id: 1, name: "Programming" },
	{ id: 2, name: "AI & Machine Learning" },
	{ id: 3, name: "News & Culture" },
];

describe("matchCategory", () => {
	it("matches exact names", () => {
		expect(matchCategory("Programming", CATEGORIES)?.id).toBe(1);
	});

	it("matches case-insensitively", () => {
		expect(matchCategory("ai & machine learning", CATEGORIES)?.id).toBe(2);
		expect(matchCategory("PROGRAMMING", CATEGORIES)?.id).toBe(1);
	});

	it("ignores surrounding and collapsed whitespace", () => {
		expect(matchCategory("  News &  Culture ", CATEGORIES)?.id).toBe(3);
	});

	it("returns null for unknown names", () => {
		expect(matchCategory("Cooking", CATEGORIES)).toBeNull();
	});

	it("returns null for null, undefined, and blank input", () => {
		expect(matchCategory(null, CATEGORIES)).toBeNull();
		expect(matchCategory(undefined, CATEGORIES)).toBeNull();
		expect(matchCategory("   ", CATEGORIES)).toBeNull();
	});
});
