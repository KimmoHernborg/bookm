import { createFileRoute } from "@tanstack/react-router";

import { auth } from "#/lib/auth.ts";
import { env } from "#/lib/server/env.ts";
import { ensureInit } from "#/lib/server/init.ts";

async function handle(request: Request) {
	await ensureInit();
	// Public sign-up is gated by REGISTRATION_OPEN. Admin-created users go
	// through auth.api.signUpEmail server-side, which bypasses this route.
	const url = new URL(request.url);
	if (
		!env.registrationOpen &&
		request.method === "POST" &&
		url.pathname === "/api/auth/sign-up/email"
	) {
		return Response.json(
			{ message: "Registration is closed" },
			{ status: 403 },
		);
	}
	return auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
	server: {
		handlers: {
			GET: ({ request }) => handle(request),
			POST: ({ request }) => handle(request),
		},
	},
});
