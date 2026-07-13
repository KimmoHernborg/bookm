// Showcase tokens are sqids-encoded crypto-random numbers (alphanumeric,
// 8+ chars). The `-` and `_` stay accepted so pre-sqids base64url tokens
// keep working until regenerated; the range rejects garbage before any
// database lookup.
export const SHOWCASE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

export function isShowcaseToken(value: string): boolean {
	return SHOWCASE_TOKEN_PATTERN.test(value);
}
