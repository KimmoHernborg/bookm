import { z } from "zod";

import { db } from "#/db/index.ts";
import { jobs } from "#/db/schema.ts";
import { domainOf } from "#/lib/shared/url.ts";

// payload_json is a Zod-validated discriminated union — one variant per
// job kind. Every handler receives a fully-typed payload.
export const jobPayloadSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("fetch_and_extract"),
		bookmarkId: z.number().int(),
	}),
	z.object({
		kind: z.literal("tag_bookmark"),
		bookmarkId: z.number().int(),
	}),
	// Category-only pass over an already-processed bookmark (backfill);
	// cheaper than tag_bookmark and never rewrites titles or summaries.
	z.object({
		kind: z.literal("categorize_bookmark"),
		bookmarkId: z.number().int(),
	}),
	// One job per domain — favicons are deduped by domain, not bookmark.
	// pageUrl is a real bookmark URL on that domain: icon <link>s live in
	// page HTML and relative hrefs must resolve against a concrete URL.
	z.object({
		kind: z.literal("fetch_favicon"),
		domain: z.string(),
		pageUrl: z.string(),
	}),
]);

export type JobPayload = z.infer<typeof jobPayloadSchema>;
export type JobKind = JobPayload["kind"];

// Duplicate enqueues for a domain are cheap no-ops: the handler skips
// domains that already have a favicon row.
export function enqueueFaviconFetch(url: string) {
	enqueueJob({ kind: "fetch_favicon", domain: domainOf(url), pageUrl: url });
}

export function enqueueJob(
	payload: JobPayload,
	opts?: { delaySeconds?: number },
) {
	const nextRunAt = new Date(Date.now() + (opts?.delaySeconds ?? 0) * 1000);
	db.insert(jobs)
		.values({
			kind: payload.kind,
			payloadJson: JSON.stringify(payload),
			nextRunAt,
		})
		.run();
}
