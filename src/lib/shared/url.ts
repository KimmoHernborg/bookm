// Canonicalization per PLAN.md: lowercase host, strip `www.`, drop the
// fragment. No tracking-param stripping. Used for deduping on
// (user_id, url_canonical).
export function canonicalizeUrl(raw: string): string {
	const url = new URL(raw);
	url.hash = "";
	if (url.hostname.startsWith("www.")) {
		url.hostname = url.hostname.slice(4);
	}
	return url.toString();
}

export function isHttpUrl(raw: string): boolean {
	try {
		const url = new URL(raw);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

export function domainOf(raw: string): string {
	try {
		const host = new URL(raw).hostname;
		return host.startsWith("www.") ? host.slice(4) : host;
	} catch {
		return raw;
	}
}
