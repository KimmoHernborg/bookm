// Resolve an LLM-returned category name against the user's curated list.
// Categories are never auto-created (unlike tags), so anything that does not
// match — extra whitespace and casing aside — resolves to null.
export function matchCategory<T extends { id: number; name: string }>(
	raw: string | null | undefined,
	categories: Array<T>,
): T | null {
	if (!raw) return null;
	const wanted = raw.trim().replace(/\s+/g, " ").toLowerCase();
	if (!wanted) return null;
	return (
		categories.find(
			(c) => c.name.trim().replace(/\s+/g, " ").toLowerCase() === wanted,
		) ?? null
	);
}
