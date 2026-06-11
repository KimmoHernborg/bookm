// Tag normalization per PLAN.md: lowercase, kebab-case, singular,
// ASCII-fold. Collapses `JavaScript`, `javascript`, and `JS Language`
// style drift before tags ever hit the database.

// Words that look plural but aren't (or whose singular form is wrong).
const SINGULAR_EXCEPTIONS = new Set([
	"news",
	"devops",
	"kubernetes",
	"ios",
	"macos",
	"css",
	"sass",
	"aws",
	"analytics",
	"graphics",
	"physics",
	"mathematics",
	"economics",
	"politics",
	"ethics",
	"robotics",
	"statistics",
	"linguistics",
	"genomics",
	"serverless",
	"headless",
	"http",
	"https",
	"cors",
	"redis",
	"postgres",
	"rails",
]);

function singularize(word: string): string {
	if (SINGULAR_EXCEPTIONS.has(word)) return word;
	if (word.endsWith("ss")) return word;
	if (word.endsWith("ies") && word.length > 4) {
		return `${word.slice(0, -3)}y`;
	}
	if (word.endsWith("s") && word.length > 3) {
		return word.slice(0, -1);
	}
	return word;
}

export function normalizeTag(raw: string): string {
	const folded = raw.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
	const kebab = folded
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
	if (!kebab) return "";
	const words = kebab.split("-");
	words[words.length - 1] = singularize(words[words.length - 1]);
	return words.join("-");
}

export function normalizeTags(raw: Array<string>): Array<string> {
	const seen = new Set<string>();
	for (const tag of raw) {
		const normalized = normalizeTag(tag);
		if (normalized) seen.add(normalized);
	}
	return [...seen];
}
