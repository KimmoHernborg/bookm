import { describe, expect, it } from "vitest";

import { parseNetscapeBookmarks } from "./netscape.ts";

const CHROME_EXPORT = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<!-- This is an automatically generated file. -->
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
    <DT><H3 ADD_DATE="1700000000" PERSONAL_TOOLBAR_FOLDER="true">Bookmarks bar</H3>
    <DL><p>
        <DT><A HREF="https://example.com/" ADD_DATE="1700000001">Example</A>
        <DT><H3 ADD_DATE="1700000002">Dev Tools</H3>
        <DL><p>
            <DT><A HREF="https://github.com/foo/bar" ADD_DATE="1700000003">foo/bar repo</A>
            <DT><A HREF="https://news.ycombinator.com/item?id=1" ADD_DATE="1700000004">HN &amp; friends</A>
        </DL><p>
        <DT><A HREF="https://after-nested.example/" ADD_DATE="1700000005">After nested</A>
    </DL><p>
</DL><p>`;

describe("parseNetscapeBookmarks", () => {
	it("parses bookmarks with folder stacks as tags", () => {
		const parsed = parseNetscapeBookmarks(CHROME_EXPORT);
		expect(parsed).toHaveLength(4);

		expect(parsed[0]).toEqual({
			url: "https://example.com/",
			title: "Example",
			folders: [],
		});
		expect(parsed[1]).toEqual({
			url: "https://github.com/foo/bar",
			title: "foo/bar repo",
			folders: ["Dev Tools"],
		});
		expect(parsed[2].title).toBe("HN & friends");
		// Folder closed again after the nested DL.
		expect(parsed[3].folders).toEqual([]);
	});

	it("ignores browser root folder names", () => {
		const parsed = parseNetscapeBookmarks(CHROME_EXPORT);
		for (const entry of parsed) {
			expect(entry.folders).not.toContain("Bookmarks bar");
		}
	});

	it("skips non-http(s) URLs", () => {
		const html = `<DL><DT><A HREF="javascript:void(0)">js</A>
			<DT><A HREF="place:sort=8">firefox internal</A>
			<DT><A HREF="https://ok.example/">ok</A></DL>`;
		const parsed = parseNetscapeBookmarks(html);
		expect(parsed).toHaveLength(1);
		expect(parsed[0].url).toBe("https://ok.example/");
	});

	it("returns empty array for non-bookmark HTML", () => {
		expect(parseNetscapeBookmarks("<html><body>hello</body></html>")).toEqual(
			[],
		);
	});
});
