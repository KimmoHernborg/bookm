import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { iconCandidatesFromHtml, toPngDataUrl } from "./favicon.ts";

const BASE = "https://example.com/blog/post";

describe("iconCandidatesFromHtml", () => {
	it("returns empty when there are no icon links", () => {
		expect(iconCandidatesFromHtml("<html><head></head></html>", BASE)).toEqual(
			[],
		);
	});

	it("resolves relative hrefs against the base url", () => {
		const html = `<link rel="icon" href="/fav.png">`;
		expect(iconCandidatesFromHtml(html, BASE)).toEqual([
			"https://example.com/fav.png",
		]);
	});

	it("prefers the sized icon closest to 16px", () => {
		const html = `
			<link rel="icon" href="/fav-64.png" sizes="64x64">
			<link rel="icon" href="/fav-16.png" sizes="16x16">
			<link rel="icon" href="/fav-32.png" sizes="32x32">
		`;
		expect(iconCandidatesFromHtml(html, BASE)).toEqual([
			"https://example.com/fav-16.png",
			"https://example.com/fav-32.png",
			"https://example.com/fav-64.png",
		]);
	});

	it('ranks sizes="any" (svg) above unsized and below exact 16px', () => {
		const html = `
			<link rel="icon" href="/unsized.ico">
			<link rel="icon" href="/fav.svg" sizes="any">
			<link rel="icon" href="/fav-16.png" sizes="16x16">
		`;
		expect(iconCandidatesFromHtml(html, BASE)).toEqual([
			"https://example.com/fav-16.png",
			"https://example.com/fav.svg",
			"https://example.com/unsized.ico",
		]);
	});

	it("accepts shortcut icon and puts apple-touch-icon last", () => {
		const html = `
			<link rel="apple-touch-icon" href="/apple.png" sizes="180x180">
			<link rel="shortcut icon" href="/fav.ico">
		`;
		expect(iconCandidatesFromHtml(html, BASE)).toEqual([
			"https://example.com/fav.ico",
			"https://example.com/apple.png",
		]);
	});

	it("skips mask-icon, data: hrefs, and unrelated links", () => {
		const html = `
			<link rel="mask-icon" href="/mask.svg">
			<link rel="icon" href="data:image/png;base64,AAAA">
			<link rel="stylesheet" href="/style.css">
			<link rel="icon" href="/fav.png">
		`;
		expect(iconCandidatesFromHtml(html, BASE)).toEqual([
			"https://example.com/fav.png",
		]);
	});

	it("dedupes repeated hrefs", () => {
		const html = `
			<link rel="icon" href="/fav.png">
			<link rel="shortcut icon" href="/fav.png">
		`;
		expect(iconCandidatesFromHtml(html, BASE)).toEqual([
			"https://example.com/fav.png",
		]);
	});
});

function redSquarePng(size: number): Promise<Buffer> {
	return sharp({
		create: {
			width: size,
			height: size,
			channels: 4,
			background: { r: 220, g: 40, b: 40, alpha: 1 },
		},
	})
		.png()
		.toBuffer();
}

// Minimal single-frame ICO wrapping a PNG payload (PNG-in-ICO is valid
// since Vista and what most sites ship for 32x32+ frames).
function icoWrappingPng(png: Buffer, size: number): Buffer {
	const header = Buffer.alloc(6 + 16);
	header.writeUInt16LE(0, 0); // reserved
	header.writeUInt16LE(1, 2); // type: icon
	header.writeUInt16LE(1, 4); // image count
	header.writeUInt8(size === 256 ? 0 : size, 6); // width
	header.writeUInt8(size === 256 ? 0 : size, 7); // height
	header.writeUInt32LE(png.length, 6 + 8); // payload size
	header.writeUInt32LE(6 + 16, 6 + 12); // payload offset
	return Buffer.concat([header, png]);
}

async function expectPng16(dataUrl: string) {
	expect(dataUrl.startsWith("data:image/png;base64,")).toBe(true);
	const decoded = Buffer.from(
		dataUrl.slice("data:image/png;base64,".length),
		"base64",
	);
	const meta = await sharp(decoded).metadata();
	expect(meta.format).toBe("png");
	expect(meta.width).toBe(16);
	expect(meta.height).toBe(16);
}

describe("toPngDataUrl", () => {
	it("resizes a png to a 16x16 png data url", async () => {
		await expectPng16(await toPngDataUrl(await redSquarePng(64), "image/png"));
	});

	it("decodes an ico (png frame) via content-type", async () => {
		const ico = icoWrappingPng(await redSquarePng(32), 32);
		await expectPng16(await toPngDataUrl(ico, "image/x-icon"));
	});

	it("detects ico by magic bytes when content-type is generic", async () => {
		const ico = icoWrappingPng(await redSquarePng(32), 32);
		await expectPng16(await toPngDataUrl(ico, "application/octet-stream"));
	});

	it("rasterizes svg", async () => {
		const svg = Buffer.from(
			`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" fill="red"/></svg>`,
		);
		await expectPng16(await toPngDataUrl(svg, "image/svg+xml"));
	});

	it("throws on undecodable input (html error page served as icon)", async () => {
		await expect(
			toPngDataUrl(Buffer.from("<html>not found</html>"), "text/html"),
		).rejects.toThrow();
	});
});
