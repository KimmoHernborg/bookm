import { randomBytes } from "node:crypto";
import { count, eq } from "drizzle-orm";

import { db } from "#/db/index.ts";
import { user } from "#/db/schema.ts";
import { env } from "./env.ts";
import { log } from "./log.ts";

// Runs once per process: bootstrap the first admin, start the job worker.
// Triggered from every server entry point (auth route, server fns, healthz)
// so it works in both dev and the built server without a custom entry.
const globalForInit = globalThis as unknown as {
	__bookmInit?: Promise<void>;
};

export function ensureInit(): Promise<void> {
	globalForInit.__bookmInit ??= init().catch((error) => {
		// Reset so a transient failure (e.g. bad env) can be retried on the
		// next request instead of poisoning the process forever.
		globalForInit.__bookmInit = undefined;
		throw error;
	});
	return globalForInit.__bookmInit;
}

async function init() {
	await bootstrapAdmin();
	const { startWorker } = await import("./jobs/worker.ts");
	startWorker();
	log.info("server_init_complete");
}

async function bootstrapAdmin() {
	if (!env.adminEmail) return;
	const [{ value: userCount }] = await db.select({ value: count() }).from(user);
	if (userCount > 0) return;

	// Dynamic import to avoid a static cycle (auth.ts imports db).
	const { auth } = await import("#/lib/auth.ts");
	const password = randomBytes(12).toString("base64url");
	await auth.api.signUpEmail({
		body: {
			email: env.adminEmail,
			password,
			name: env.adminEmail.split("@")[0],
		},
	});
	await db
		.update(user)
		.set({ isAdmin: true })
		.where(eq(user.email, env.adminEmail));
	log.info("admin_bootstrapped", {
		email: env.adminEmail,
		// One-time generated credential, only ever printed here.
		password,
	});
}
