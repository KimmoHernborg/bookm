import { sql } from "drizzle-orm";

import { db } from "#/db/index.ts";
import type { Job } from "#/db/schema.ts";
import { env } from "#/lib/server/env.ts";
import { log } from "#/lib/server/log.ts";
import { handlers, onJobExhausted } from "./handlers.ts";
import { type JobPayload, jobPayloadSchema } from "./queue.ts";

const POLL_INTERVAL_MS = 1_000;
const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_SECONDS = 30;

let runningJobs = 0;

const globalForWorker = globalThis as unknown as {
	__bookmWorker?: ReturnType<typeof setInterval>;
};

export function startWorker() {
	if (globalForWorker.__bookmWorker) return;

	// Single-process deployment: anything still 'running' at boot is an
	// orphan from a previous process and gets requeued.
	db.run(
		sql`UPDATE jobs SET status = 'pending', updated_at = unixepoch()
			WHERE status = 'running'`,
	);

	globalForWorker.__bookmWorker = setInterval(() => {
		tick().catch((error) =>
			log.error("worker_tick_failed", { error: String(error) }),
		);
	}, POLL_INTERVAL_MS);
	// Don't keep the process alive just for the poll loop.
	globalForWorker.__bookmWorker.unref?.();
	log.info("worker_started", { concurrency: env.jobConcurrency });
}

async function tick() {
	const slots = env.jobConcurrency - runningJobs;
	if (slots <= 0) return;

	// Atomic claim: only one tick can move a given row out of 'pending'.
	const claimed = db.all<Job & { payload_json: string }>(
		sql`UPDATE jobs
			SET status = 'running', claimed_at = unixepoch(),
				attempts = attempts + 1, updated_at = unixepoch()
			WHERE id IN (
				SELECT id FROM jobs
				WHERE status = 'pending' AND next_run_at <= unixepoch()
				ORDER BY next_run_at
				LIMIT ${slots}
			)
			RETURNING *`,
	);

	for (const job of claimed) {
		runningJobs++;
		void runJob(job).finally(() => {
			runningJobs--;
		});
	}
}

async function runJob(job: Job & { payload_json: string }) {
	const parsed = jobPayloadSchema.safeParse(JSON.parse(job.payload_json));
	if (!parsed.success) {
		finishJob(job.id, "failed", `invalid payload: ${parsed.error.message}`);
		log.error("job_invalid_payload", { jobId: job.id, kind: job.kind });
		return;
	}
	const payload = parsed.data;

	try {
		// The discriminated union guarantees payload matches its handler,
		// but TS cannot correlate the two through the indexed access.
		await (handlers[payload.kind] as (p: JobPayload) => Promise<void>)(payload);
		finishJob(job.id, "completed", null);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		// RETURNING gave us the post-claim row, so `attempts` already
		// includes this run.
		const attempts = job.attempts;
		if (attempts >= MAX_ATTEMPTS) {
			finishJob(job.id, "failed", message);
			onJobExhausted(payload);
			log.error("job_failed", {
				jobId: job.id,
				kind: payload.kind,
				attempts,
				message,
			});
		} else {
			const backoffSeconds = BACKOFF_BASE_SECONDS * 2 ** (attempts - 1);
			db.run(
				sql`UPDATE jobs
					SET status = 'pending', last_error = ${message},
						next_run_at = unixepoch() + ${backoffSeconds},
						updated_at = unixepoch()
					WHERE id = ${job.id}`,
			);
			log.warn("job_retry_scheduled", {
				jobId: job.id,
				kind: payload.kind,
				attempts,
				backoffSeconds,
			});
		}
	}
}

function finishJob(
	jobId: number,
	status: "completed" | "failed",
	error: string | null,
) {
	db.run(
		sql`UPDATE jobs
			SET status = ${status}, last_error = ${error}, updated_at = unixepoch()
			WHERE id = ${jobId}`,
	);
}

// Used by the admin "Retry" button.
export function retryJob(jobId: number) {
	db.run(
		sql`UPDATE jobs
			SET status = 'pending', attempts = 0, last_error = NULL,
				next_run_at = unixepoch(), updated_at = unixepoch()
			WHERE id = ${jobId} AND status = 'failed'`,
	);
}
