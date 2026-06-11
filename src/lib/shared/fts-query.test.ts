import { describe, expect, it } from "vitest";

import { buildFtsQuery } from "./fts-query.ts";

describe("buildFtsQuery", () => {
	it("quotes tokens with prefix matching", () => {
		expect(buildFtsQuery("react hooks")).toBe('"react"* "hooks"*');
	});

	it("neutralizes FTS5 syntax in user input", () => {
		expect(buildFtsQuery("NOT (evil)")).toBe('"NOT"* "(evil)"*');
		expect(buildFtsQuery('"; DROP')).toBe('";"* "DROP"*');
	});

	it("returns empty string for whitespace-only input", () => {
		expect(buildFtsQuery("   ")).toBe("");
	});
});
