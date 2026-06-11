// Polite outbound fetches per PLAN.md: per-host 1 RPS, custom user-agent,
// hard timeout. robots.txt is deliberately not consulted — this fetches on
// behalf of a specific user, it is not a crawler.

const USER_AGENT = "Bookm/0.1 (personal bookmarking tool)";
const FETCH_TIMEOUT_MS = 20_000;
const PER_HOST_INTERVAL_MS = 1_000;

const hostQueues = new Map<string, Promise<unknown>>();

function rateLimited<T>(host: string, run: () => Promise<T>): Promise<T> {
	const prev = hostQueues.get(host) ?? Promise.resolve();
	const result = prev.catch(() => {}).then(run);
	// Keep the host slot busy for the minimum interval regardless of how
	// fast the request itself completes.
	const slot = result
		.catch(() => {})
		.then(() => new Promise((r) => setTimeout(r, PER_HOST_INTERVAL_MS)));
	hostQueues.set(host, slot);
	void slot.then(() => {
		if (hostQueues.get(host) === slot) hostQueues.delete(host);
	});
	return result;
}

export function politeFetch(
	url: string,
	init?: RequestInit,
): Promise<Response> {
	const host = new URL(url).hostname;
	return rateLimited(host, () =>
		fetch(url, {
			redirect: "follow",
			...init,
			headers: {
				"user-agent": USER_AGENT,
				accept:
					"text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
				...(init?.headers as Record<string, string> | undefined),
			},
			signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
		}),
	);
}
