import { describe, expect, it } from "vitest";

import { isShowcaseToken } from "#/lib/shared/showcase-token.ts";
import { createShowcaseToken } from "./showcase-token.ts";

describe("createShowcaseToken", () => {
	it("produces tokens the shared pattern accepts", () => {
		for (let i = 0; i < 100; i++) {
			expect(isShowcaseToken(createShowcaseToken())).toBe(true);
		}
	});

	it("stays within the sqids alphabet", () => {
		for (let i = 0; i < 100; i++) {
			expect(createShowcaseToken()).toMatch(/^[A-Za-z0-9]{8,}$/);
		}
	});

	it("does not repeat", () => {
		const seen = new Set<string>();
		for (let i = 0; i < 1000; i++) {
			seen.add(createShowcaseToken());
		}
		expect(seen.size).toBe(1000);
	});
});
