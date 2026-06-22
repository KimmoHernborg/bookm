// Quote every token so user input can never break FTS5 query syntax;
// trailing * gives prefix matching ("reac" finds "react").
export function buildFtsQuery(input: string): string {
	return input
		.split(/\s+/)
		.map((token) => token.replaceAll('"', ""))
		.filter((token) => token.length > 0)
		.map((token) => `"${token}"*`)
		.join(" ");
}
