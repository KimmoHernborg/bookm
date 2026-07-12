// Showcase tokens are 16 random bytes as base64url (22 chars, 128 bits).
// The range accepts future longer tokens but rejects garbage before any
// database lookup.
export const SHOWCASE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;

export function isShowcaseToken(value: string): boolean {
	return SHOWCASE_TOKEN_PATTERN.test(value);
}
