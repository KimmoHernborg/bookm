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
				openrouterBaseUrl: user.openrouterBaseUrl,
			})
			.from(user)
			.where(eq(user.id, sessionUser.id))
			.all();
		return {
			email: sessionUser.email,
			openrouterModel: row?.openrouterModel ?? "",
			openrouterBaseUrl: row?.openrouterBaseUrl ?? "",
			serverDefaultModel: env.openrouterDefaultModel,
		};
	},
);

export const updateSettings = createServerFn({ method: "POST" })
	.inputValidator(
		(data: { openrouterModel: string; openrouterBaseUrl: string }) =>
			z
				.object({
					// Free-form model slug, deliberately not restricted to a known list.
					openrouterModel: z.string().trim().max(200),
					openrouterBaseUrl: z
						.string()
						.trim()
						.max(500)
						.refine((v) => v === "" || /^https?:\/\//.test(v), {
							message: "Base URL must start with http:// or https://",
						}),
				})
				.parse(data),
	)
	.handler(async ({ data }) => {
		const sessionUser = await requireUser();
		db.update(user)
			.set({
				openrouterModel: data.openrouterModel || null,
				openrouterBaseUrl: data.openrouterBaseUrl || null,
				updatedAt: new Date(),
			})
			.where(eq(user.id, sessionUser.id))
			.run();
	});
