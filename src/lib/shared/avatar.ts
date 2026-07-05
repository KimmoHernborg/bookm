// Gravatar avatar helpers. Gravatar accepts SHA-256 hashes of the
// trimmed, lowercased email; hashing itself happens server-side
// (see lib/server/session.ts) so this module stays client-safe.

export function normalizeGravatarEmail(email: string): string {
	return email.trim().toLowerCase();
}

// d=404 makes Gravatar fail the image request when no avatar exists,
// which lets the UI fall back to initials instead of a generic image.
export function gravatarUrl(hash: string, size: number): string {
	return `https://www.gravatar.com/avatar/${hash}?s=${size}&d=404`;
}

export function initialsFor(name: string, email: string): string {
	const words = name.trim().split(/\s+/).filter(Boolean);
	if (words.length >= 2) {
		return (words[0][0] + words[words.length - 1][0]).toUpperCase();
	}
	if (words.length === 1) return words[0][0].toUpperCase();
	const trimmedEmail = email.trim();
	return trimmedEmail ? trimmedEmail[0].toUpperCase() : "?";
}
