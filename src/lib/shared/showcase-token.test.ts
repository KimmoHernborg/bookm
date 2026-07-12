import { describe, expect, it } from "vitest";

import { isShowcaseToken } from "./showcase-token.ts";

describe("isShowcaseToken", () => {
	it("accepts a 22-char base64url token", () => {
		expect(isShowcaseToken("Ab3_x-9QwErTyUiOpAsD12")).toBe(true);
	});

	it("rejects tokens outside the length range", () => {
		expect(isShowcaseToken("")).toBe(false);
		expect(isShowcaseToken("a".repeat(19))).toBe(false);
		expect(isShowcaseToken("a".repeat(65))).toBe(false);
	});

	it("accepts the length boundaries", () => {
		expect(isShowcaseToken("a".repeat(20))).toBe(true);
		expect(isShowcaseToken("a".repeat(64))).toBe(true);
	});

	it("rejects characters outside the base64url alphabet", () => {
		expect(isShowcaseToken("Ab3_x-9QwErTyUiOpAsD1/")).toBe(false);
		expect(isShowcaseToken("Ab3_x-9QwErTyUiOpAsD1+")).toBe(false);
		expect(isShowcaseToken("Ab3_x-9QwErTyUiOpAsD1=")).toBe(false);
		expect(isShowcaseToken("Ab3_x-9QwErTyUiOpAsD1 ")).toBe(false);
		expect(isShowcaseToken("../../../etc/passwd12345")).toBe(false);
	});
});
