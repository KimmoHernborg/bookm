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
			openrouterBaseUrl: {
				type: "string",
				required: false,
				input: false,
			},
		},
	},
	plugins: [tanstackStartCookies()],
});
