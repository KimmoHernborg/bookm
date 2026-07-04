import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";

import { db } from "#/db/index.ts";
import * as schema from "#/db/schema.ts";

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
				after: async (createdUser) => {
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
				},
			},
		},
	},
	user: {
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
