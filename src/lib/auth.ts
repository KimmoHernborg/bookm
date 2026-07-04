import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { db } from "#/db/index.ts";
import * as schema from "#/db/schema.ts";
import { log } from "#/lib/server/log.ts";

export const auth = betterAuth({
	database: drizzleAdapter(db, {
		provider: "sqlite",
		schema: {
			user: schema.user,
			session: schema.session,
			account: schema.account,
			verification: schema.verification,
		},
	}),
	emailAndPassword: {
		enabled: true,
	},
	databaseHooks: {
		user: {
			create: {
				// Copy the admin-managed template into the new user's own
				// categories. Fires for every signup path (admin bootstrap in
				// init.ts and adminCreateUser both go through auth.api).
				// Best-effort: the user row already exists, so a seeding
				// failure must not fail the signup itself.
				after: async (createdUser) => {
					try {
						const defaults = db
							.select()
							.from(schema.defaultCategories)
							.orderBy(schema.defaultCategories.sortOrder)
							.all();
						if (defaults.length === 0) return;
						db.insert(schema.categories)
							.values(
								defaults.map((d) => ({
									userId: createdUser.id,
									name: d.name,
									sortOrder: d.sortOrder,
								})),
							)
							.onConflictDoNothing()
							.run();
					} catch (error) {
						log.error("default_categories_seed_failed", {
							userId: createdUser.id,
							error: error instanceof Error ? error.message : String(error),
						});
					}
				},
			},
		},
	},
	user: {
		changeEmail: {
			enabled: true,
			// No email infrastructure exists; users are always unverified, so
			// the change applies immediately. If emailVerified were ever true,
			// change-email returns 400 "Verification email isn't enabled".
			updateEmailWithoutVerification: true,
		},
		additionalFields: {
			isAdmin: {
				type: "boolean",
				defaultValue: false,
				input: false,
			},
			openrouterModel: {
				type: "string",
				required: false,
				input: false,
			},
		},
	},
	plugins: [tanstackStartCookies()],
});
