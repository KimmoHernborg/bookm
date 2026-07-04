import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "#/db/index.ts";
import { user } from "#/db/schema.ts";
import { env } from "#/lib/server/env.ts";
import { requireUser } from "#/lib/server/session.ts";

export const getSettings = createServerFn({ method: "GET" }).handler(
	async () => {
		const sessionUser = await requireUser();
		const [row] = db
			.select({
				openrouterModel: user.openrouterModel,
			})
			.from(user)
			.where(eq(user.id, sessionUser.id))
			.all();
		return {
			name: sessionUser.name,
			email: sessionUser.email,
			openrouterModel: row?.openrouterModel ?? "",
			serverDefaultModel: env.openrouterDefaultModel,
		};
	},
);

export const updateSettings = createServerFn({ method: "POST" })
	.inputValidator((data: { openrouterModel: string }) =>
		z
			.object({
				// Free-form model slug, deliberately not restricted to a known list.
				openrouterModel: z.string().trim().max(200),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		const sessionUser = await requireUser();
		db.update(user)
			.set({
				openrouterModel: data.openrouterModel || null,
				updatedAt: new Date(),
			})
			.where(eq(user.id, sessionUser.id))
			.run();
	});
