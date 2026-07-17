import { createServerFn } from "@tanstack/react-start";

import { requireUser } from "#/lib/server/session.ts";

export const getSettings = createServerFn({ method: "GET" }).handler(
	async () => {
		const sessionUser = await requireUser();
		return {
			name: sessionUser.name,
			email: sessionUser.email,
		};
	},
);
