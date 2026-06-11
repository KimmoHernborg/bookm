import { createServerFn } from "@tanstack/react-start";

import { env } from "#/lib/server/env.ts";
import { getSessionUser } from "#/lib/server/session.ts";

// Used by route guards and the login page; also the first code that runs
// on any page load, so it triggers server init.
export const getAuthState = createServerFn({ method: "GET" }).handler(
	async () => {
		const user = await getSessionUser();
		return {
			user,
			registrationOpen: env.registrationOpen,
		};
	},
);
