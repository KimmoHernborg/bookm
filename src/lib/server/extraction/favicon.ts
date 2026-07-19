import decodeIco from "decode-ico";
import { parseHTML } from "linkedom";
import sharp, { type Sharp } from "sharp";

import { log } from "#/lib/server/log.ts";
import { politeFetch } from "./fetcher.ts";

const SIZE = 16;
const MAX_ICON_BYTES = 1024 * 1024;
// Bounds worst-case job duration: same-host candidates are serialized at
// 1 RPS by politeFetch.
const MAX_CANDIDATES = 4;

// Parse <link rel> icon candidates from HTML, resolved against baseUrl
// (the final response URL, so relative hrefs survive redirects). Ordered
// best-first: smallest declared size >= 16, then sizes="any" (SVG),
// then unsized, then sub-16px, with apple-touch-icon (180px, often
// padded) as trailing fallback.
export function iconCandidatesFromHtml(
	html: string,
	baseUrl: string,
): Array<string> {
	const { document } = parseHTML(html);
	const cands: Array<{ href: string; score: number }> = [];
	for (const link of document.querySelectorAll("link[rel][href]")) {
		const relTokens = (link.getAttribute("rel") ?? "")
			.toLowerCase()
			.split(/\s+/);
		// "icon" covers "shortcut icon" and "alternate icon"; mask-icon is
		// a monochrome Safari pinned-tab glyph — wrong colors for a favicon.
		const isIcon = relTokens.includes("icon");
		const isApple = relTokens.some((t) => t.startsWith("apple-touch-icon"));
		if ((!isIcon && !isApple) || relTokens.includes("mask-icon")) continue;
		const href = link.getAttribute("href");
		if (!href) continue;
		let abs: string;
		try {
			abs = new URL(href, baseUrl).toString();
		} catch {
			continue;
		}
		if (!abs.startsWith("http")) continue;
		const sizes = (link.getAttribute("sizes") ?? "").toLowerCase();
		let score: number;
		if (sizes === "any") {
			score = 50;
		} else {
			const declared = sizes
				.split(/\s+/)
				.map((s) => Number.parseInt(s, 10))
				.filter((n) => Number.isFinite(n) && n > 0);
			const best = declared.filter((n) => n >= SIZE).sort((a, b) => a - b)[0];
			score = best ? best - SIZE : declared.length > 0 ? 500 : 100;
		}
		if (isApple && !isIcon) score += 1000;
		cands.push({ href: abs, score });
	}
	cands.sort((a, b) => a.score - b.score);
	return [...new Set(cands.map((c) => c.href))];
}

function isIco(buf: Buffer, contentType: string): boolean {
	return (
		contentType.includes("icon") ||
		(buf.length >= 4 &&
			buf[0] === 0 &&
			buf[1] === 0 &&
			buf[2] === 1 &&
			buf[3] === 0)
	);
}

// Icon bytes in any supported format -> 16x16 PNG data URL. Throws on
// undecodable input (e.g. an HTML error page served with 200).
export async function toPngDataUrl(
	buf: Buffer,
	contentType: string,
): Promise<string> {
	let input: Sharp;
	if (isIco(buf, contentType)) {
		const frames = [...decodeIco(buf)].sort((a, b) => a.width - b.width);
		const frame = frames.find((f) => f.width >= SIZE) ?? frames.at(-1);
		if (!frame) throw new Error("empty ico");
		input =
			frame.type === "png"
				? sharp(Buffer.from(frame.data))
				: sharp(Buffer.from(frame.data), {
						raw: { width: frame.width, height: frame.height, channels: 4 },
					});
	} else {
		input = sharp(buf);
	}
	const png = await input.resize(SIZE, SIZE, { fit: "cover" }).png().toBuffer();
	return `data:image/png;base64,${png.toString("base64")}`;
}

export type FaviconResult = { kind: "ok"; dataUrl: string } | { kind: "none" };

// Fetch pageUrl's HTML, walk icon candidates, fall back to /favicon.ico
// on the final host. Returns "none" when no candidate yields a decodable
// image (durable — the caller records it and stops). Throws only on
// page-level network errors (transient — the worker retries).
export async function fetchFaviconForPage(
	pageUrl: string,
): Promise<FaviconResult> {
	const candidates: Array<string> = [];
	const res = await politeFetch(pageUrl);
	// res.url keeps the real host after redirects (e.g. domain -> www.)
	const finalUrl = res.url || pageUrl;
	if (res.ok && (res.headers.get("content-type") ?? "").includes("html")) {
		candidates.push(...iconCandidatesFromHtml(await res.text(), finalUrl));
	}
	candidates.push(new URL("/favicon.ico", finalUrl).toString());

	for (const href of [...new Set(candidates)].slice(0, MAX_CANDIDATES)) {
		try {
			const iconRes = await politeFetch(href, {
				headers: { accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
			});
			if (!iconRes.ok) continue;
			const buf = Buffer.from(await iconRes.arrayBuffer());
			if (buf.length === 0 || buf.length > MAX_ICON_BYTES) continue;
			return {
				kind: "ok",
				dataUrl: await toPngDataUrl(
					buf,
					iconRes.headers.get("content-type") ?? "",
				),
			};
		} catch (error) {
			log.warn("favicon_candidate_failed", { href, error: String(error) });
		}
	}
	return { kind: "none" };
}
