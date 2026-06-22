import { describe, expect, it } from "vitest";

import { canonicalizeUrl, domainOf, isHttpUrl } from "./url.ts";

describe("canonicalizeUrl", () => {
	it("lowercases the host", () => {
		expect(canonicalizeUrl("https://Example.COM/Path")).toBe(
			"https://example.com/Path",
		);
	});

	it("strips www.", () => {
		expect(canonicalizeUrl("https://www.example.com/a")).toBe(
			"https://example.com/a",
		);
	});

	it("drops the fragment but keeps the query", () => {
		expect(canonicalizeUrl("https://example.com/a?b=1#section")).toBe(
			"https://example.com/a?b=1",
		);
	});

	it("does not strip tracking params (out of scope)", () => {
		expect(canonicalizeUrl("https://example.com/?utm_source=x")).toBe(
			"https://example.com/?utm_source=x",
		);
	});

	it("throws on invalid URLs", () => {
		expect(() => canonicalizeUrl("not a url")).toThrow();
	});
});

describe("isHttpUrl", () => {
	it("accepts http and https only", () => {
		expect(isHttpUrl("https://example.com")).toBe(true);
		expect(isHttpUrl("http://example.com")).toBe(true);
		expect(isHttpUrl("ftp://example.com")).toBe(false);
		expect(isHttpUrl("javascript:alert(1)")).toBe(false);
		expect(isHttpUrl("nonsense")).toBe(false);
	});
});

describe("domainOf", () => {
	it("returns the host without www.", () => {
		expect(domainOf("https://www.example.com/path")).toBe("example.com");
		expect(domainOf("https://news.ycombinator.com/item?id=1")).toBe(
			"news.ycombinator.com",
		);
	});
});
