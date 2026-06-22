import { z } from "zod";

import { db } from "#/db/index.ts";
import { jobs } from "#/db/schema.ts";

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
]);

export type JobPayload = z.infer<typeof jobPayloadSchema>;
export type JobKind = JobPayload["kind"];

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
