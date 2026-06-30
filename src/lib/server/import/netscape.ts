// Token-based parser for the Netscape bookmark HTML export format
// (Chrome / Firefox / Safari). The format is famously malformed HTML
// (unclosed <DT>/<p> tags), so scanning tokens with a folder stack is more
// robust than a DOM parse.

export type ParsedBookmark = {
	url: string;
	title: string;
	folders: Array<string>;
};

// Browser-supplied root folders that say nothing about the content.
const IGNORED_FOLDERS = new Set([
	"bookmarks bar",
	"bookmarks menu",
	"bookmarks toolbar",
	"bokmärkesfältet",
	"other bookmarks",
	"mobile bookmarks",
	"imported",
	"favorites",
]);

const TOKEN_RE =
	/<h3[^>]*>([\s\S]*?)<\/h3>|<\/dl>|<a\s+[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;

function decodeEntities(text: string): string {
	return text
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'")
		.replaceAll("&nbsp;", " ")
		.replaceAll("&amp;", "&");
}

export function parseNetscapeBookmarks(html: string): Array<ParsedBookmark> {
	const results: Array<ParsedBookmark> = [];
	const folderStack: Array<string> = [];

	for (const match of html.matchAll(TOKEN_RE)) {
		const [token, folderName, href, linkText] = match;
		if (folderName !== undefined) {
			folderStack.push(decodeEntities(folderName.trim()));
		} else if (token.toLowerCase() === "</dl>") {
			folderStack.pop();
		} else if (href !== undefined) {
			if (!/^https?:\/\//i.test(href)) continue;
			results.push({
				url: decodeEntities(href),
				title: decodeEntities(linkText.replace(/<[^>]*>/g, "").trim()),
				folders: folderStack.filter(
					(folder) => folder && !IGNORED_FOLDERS.has(folder.toLowerCase()),
				),
			});
		}
	}
	return results;
}
