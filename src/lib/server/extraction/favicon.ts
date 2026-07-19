import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

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
const MAX_ICON_REDIRECTS = 3;

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

function ipv4IsPrivate(ip: string): boolean {
	const [a, b] = ip.split(".").map(Number);
	return (
		a === 0 || // "this network"
		a === 10 ||
		a === 127 || // loopback
		(a === 100 && b >= 64 && b <= 127) || // CGNAT
		(a === 169 && b === 254) || // link-local, cloud metadata
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && (b === 0 || b === 168)) ||
		(a === 198 && (b === 18 || b === 19)) || // benchmarking
		a >= 224 // multicast + reserved + broadcast
	);
}

function ipv6IsPrivate(ip: string): boolean {
	const norm = ip.toLowerCase();
	if (norm === "::" || norm === "::1") return true;
	// v4-mapped: dotted (::ffff:192.168.0.1) or, after URL parsing
	// normalizes the literal, hex groups (::ffff:c0a8:1).
	const mapped = /^::ffff:(.+)$/.exec(norm);
	if (mapped) {
		if (mapped[1].includes(".")) return ipv4IsPrivate(mapped[1]);
		const groups = mapped[1].split(":").map((g) => Number.parseInt(g, 16));
		if (groups.length === 1) return true; // high bits 0 -> 0.0.x.x
		const [hi, lo] = groups;
		return ipv4IsPrivate(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
	}
	// fc00::/7 (unique local) and fe80::/10 (link-local)
	return /^f[cd]/.test(norm) || /^fe[89ab]/.test(norm);
}

const BLOCKED_HOST_SUFFIXES = [
	".localhost",
	".local",
	".internal",
	".home.arpa",
];

// Icon candidate hrefs are authored by the bookmarked page, i.e. by a
// third party — reject anything that points at loopback, LAN, or cloud
// metadata so a malicious page can't aim the server at internal
// endpoints. The DNS pre-check is advisory (fetch re-resolves, so a
// rebinding window remains), but it blocks the straightforward probes.
export async function isPublicIconUrl(raw: string): Promise<boolean> {
	let url: URL;
	try {
		url = new URL(raw);
	} catch {
		return false;
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") return false;
	const host = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
	if (
		host === "localhost" ||
		BLOCKED_HOST_SUFFIXES.some((s) => host.endsWith(s))
	) {
		return false;
	}
	const kind = isIP(host);
	if (kind === 4) return !ipv4IsPrivate(host);
	if (kind === 6) return !ipv6IsPrivate(host);
	try {
		const addrs = await lookup(host, { all: true, verbatim: true });
		return addrs.every((a) =>
			a.family === 4 ? !ipv4IsPrivate(a.address) : !ipv6IsPrivate(a.address),
		);
	} catch {
		return false; // unresolvable — nothing to fetch anyway
	}
}

// Fetch an icon candidate with manual redirects so every hop gets the
// same public-host validation; returns null when a hop is blocked or
// the redirect chain runs too deep.
async function fetchIconResponse(href: string): Promise<Response | null> {
	let current = href;
	for (let hop = 0; hop <= MAX_ICON_REDIRECTS; hop++) {
		if (!(await isPublicIconUrl(current))) return null;
		const res = await politeFetch(current, {
			redirect: "manual",
			headers: { accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
		});
		if (res.status >= 300 && res.status < 400) {
			const location = res.headers.get("location");
			if (!location) return null;
			current = new URL(location, current).toString();
			continue;
		}
		return res;
	}
	return null;
}

// Read at most MAX_ICON_BYTES from the body; returns null once the cap
// is exceeded instead of buffering an unbounded response in memory.
async function readBodyCapped(res: Response): Promise<Buffer | null> {
	const declared = Number(res.headers.get("content-length"));
	if (Number.isFinite(declared) && declared > MAX_ICON_BYTES) return null;
	if (!res.body) return null;
	const reader = res.body.getReader();
	const chunks: Array<Uint8Array> = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > MAX_ICON_BYTES) {
			await reader.cancel();
			return null;
		}
		chunks.push(value);
	}
	return Buffer.concat(chunks);
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
			const iconRes = await fetchIconResponse(href);
			if (!iconRes?.ok) continue;
			const buf = await readBodyCapped(iconRes);
			if (!buf || buf.length === 0) continue;
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
