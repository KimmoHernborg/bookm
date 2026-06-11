import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

import type { ContentType } from "#/db/schema.ts";
import { log } from "#/lib/server/log.ts";
import { politeFetch } from "./fetcher.ts";

// Below this many characters of extracted text the page is considered
// thin (paywall, login wall, JS-only SPA) and tagging falls back to
// URL + title with extraction_quality = "low".
const THIN_CONTENT_CHARS = 200;

export type Extraction = {
	title: string | null;
	content: string | null;
	quality: "full" | "low";
	contentTypeHint: ContentType | null;
};

export type ExtractResult =
	| { kind: "ok"; extraction: Extraction }
	| { kind: "broken"; httpStatus: number };

type SiteExtractor = (
	url: URL,
	maxChars: number,
) => Promise<ExtractResult | null>;

// URL pattern routing. arXiv and Reddit are wired but fall back to
// Readability until implemented post-MVP.
function routeExtractor(url: URL): SiteExtractor | null {
	const host = url.hostname.replace(/^www\./, "");
	if (
		host === "youtube.com" ||
		host === "youtu.be" ||
		host === "m.youtube.com"
	) {
		return extractYoutube;
	}
	if (host === "github.com") {
		return extractGithub;
	}
	if (
		host === "arxiv.org" ||
		host === "reddit.com" ||
		host === "old.reddit.com"
	) {
		return null; // post-MVP: fall through to Readability
	}
	return null;
}

export async function extractFromUrl(
	rawUrl: string,
	maxChars: number,
): Promise<ExtractResult> {
	const url = new URL(rawUrl);
	const extractor = routeExtractor(url);
	if (extractor) {
		const result = await extractor(url, maxChars).catch((error) => {
			log.warn("site_extractor_failed", { url: rawUrl, error: String(error) });
			return null;
		});
		if (result) return result;
	}
	return extractWithReadability(rawUrl, maxChars);
}

async function extractYoutube(
	url: URL,
	maxChars: number,
): Promise<ExtractResult | null> {
	const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(url.toString())}&format=json`;
	const res = await politeFetch(oembedUrl);
	if (res.status === 404 || res.status === 400) {
		return { kind: "broken", httpStatus: res.status };
	}
	if (!res.ok) return null; // transient; let Readability try
	const data = (await res.json()) as { title?: string; author_name?: string };
	if (!data.title) return null;
	const content = `${data.title}${data.author_name ? ` — a video by ${data.author_name}` : ""}`;
	return {
		kind: "ok",
		extraction: {
			title: data.title,
			content: content.slice(0, maxChars),
			quality: "full",
			contentTypeHint: "video",
		},
	};
}

async function extractGithub(
	url: URL,
	maxChars: number,
): Promise<ExtractResult | null> {
	const [owner, repo] = url.pathname.split("/").filter(Boolean);
	if (!owner || !repo) return null; // not a repo URL; Readability handles it
	const readmeUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/README.md`;
	const res = await politeFetch(readmeUrl);
	if (!res.ok) return null; // no README or private repo; Readability handles it
	const readme = await res.text();
	return {
		kind: "ok",
		extraction: {
			title: `${owner}/${repo}`,
			content: readme.slice(0, maxChars),
			quality: "full",
			contentTypeHint: "repo",
		},
	};
}

async function extractWithReadability(
	rawUrl: string,
	maxChars: number,
): Promise<ExtractResult> {
	const res = await politeFetch(rawUrl);
	if (!res.ok) {
		return { kind: "broken", httpStatus: res.status };
	}

	const contentType = res.headers.get("content-type") ?? "";
	if (!contentType.includes("html")) {
		return {
			kind: "ok",
			extraction: {
				title: null,
				content: null,
				quality: "low",
				contentTypeHint: null,
			},
		};
	}

	const html = await res.text();
	const { document } = parseHTML(html);
	const fallbackTitle =
		document.querySelector("title")?.textContent?.trim() || null;

	let article: { title?: string | null; textContent?: string | null } | null =
		null;
	try {
		article = new Readability(document as unknown as Document).parse();
	} catch (error) {
		log.warn("readability_failed", { url: rawUrl, error: String(error) });
	}

	const text = article?.textContent?.replace(/\s+/g, " ").trim() ?? "";
	if (text.length < THIN_CONTENT_CHARS) {
		return {
			kind: "ok",
			extraction: {
				title: article?.title?.trim() || fallbackTitle,
				content: text || null,
				quality: "low",
				contentTypeHint: null,
			},
		};
	}

	return {
		kind: "ok",
		extraction: {
			title: article?.title?.trim() || fallbackTitle,
			content: text.slice(0, maxChars),
			quality: "full",
			contentTypeHint: null,
		},
	};
}
