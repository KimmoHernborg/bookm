import { describe, expect, it } from "vitest";

import { normalizeTag, normalizeTags } from "./tag-normalize.ts";

describe("normalizeTag", () => {
	it("lowercases and kebab-cases", () => {
		expect(normalizeTag("JavaScript")).toBe("javascript");
		expect(normalizeTag("Machine Learning")).toBe("machine-learning");
		expect(normalizeTag("  Self Hosting  ")).toBe("self-hosting");
	});

	it("ASCII-folds diacritics", () => {
		expect(normalizeTag("café")).toBe("cafe");
		expect(normalizeTag("Århus Guide")).toBe("arhus-guide");
	});

	it("singularizes the last word", () => {
		expect(normalizeTag("bookmarks")).toBe("bookmark");
		expect(normalizeTag("code snippets")).toBe("code-snippet");
		expect(normalizeTag("libraries")).toBe("library");
	});

	it("does not mangle non-plural words ending in s", () => {
		expect(normalizeTag("css")).toBe("css");
		expect(normalizeTag("kubernetes")).toBe("kubernetes");
		expect(normalizeTag("news")).toBe("news");
		expect(normalizeTag("devops")).toBe("devops");
		expect(normalizeTag("ios")).toBe("ios");
	});

	it("strips symbols and collapses dashes", () => {
		expect(normalizeTag("C++")).toBe("c");
		expect(normalizeTag("node.js")).toBe("node-js");
		expect(normalizeTag("--weird---input--")).toBe("weird-input");
	});

	it("returns empty string for unusable input", () => {
		expect(normalizeTag("!!!")).toBe("");
		expect(normalizeTag("")).toBe("");
	});
});

describe("normalizeTags", () => {
	it("dedupes after normalization", () => {
		expect(normalizeTags(["JS Tools", "js-tools", "js tool"])).toEqual([
			"js-tool",
		]);
	});

	it("drops empty results", () => {
		expect(normalizeTags(["###", "react"])).toEqual(["react"]);
	});
});
