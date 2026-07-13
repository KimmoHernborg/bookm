import { randomInt } from "node:crypto";
import Sqids from "sqids";

// minLength keeps even a freak low-entropy draw above the shared
// SHOWCASE_TOKEN_PATTERN floor; the default blocklist keeps profanity
// out of share URLs.
const sqids = new Sqids({ minLength: 14 });

// Sqids only encodes — the unguessability comes from the two ~48-bit
// crypto-random numbers (~96 bits), not from the encoding.
export function createShowcaseToken(): string {
	return sqids.encode([randomInt(2 ** 48 - 1), randomInt(2 ** 48 - 1)]);
}
