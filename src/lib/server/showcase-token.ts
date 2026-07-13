import { randomInt } from "node:crypto";
import Sqids from "sqids";

// minLength keeps even a freak low-entropy draw above the shared
// SHOWCASE_TOKEN_PATTERN floor; the default blocklist keeps profanity
// out of share URLs.
const sqids = new Sqids({ minLength: 8 });

// Sqids only encodes — the unguessability comes from the ~48-bit
// crypto-random number, not from the encoding. Deliberately short:
// enough to make guessing a valid link impractical at this app's scale,
// while keeping share URLs compact.
export function createShowcaseToken(): string {
	return sqids.encode([randomInt(2 ** 48 - 1)]);
}
