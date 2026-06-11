import { createFileRoute } from "@tanstack/react-router";
import { sql } from "drizzle-orm";

import { db } from "#/db/index.ts";
import { ensureInit } from "#/lib/server/init.ts";

export const Route = createFileRoute("/api/healthz")({
	server: {
		handlers: {
			GET: async () => {
				try {
					await ensureInit();
					db.run(sql`SELECT 1`);
					return Response.json({ ok: true });
				} catch (error) {
					return Response.json(
						{ ok: false, error: String(error) },
						{ status: 503 },
					);
				}
			},
		},
	},
});
