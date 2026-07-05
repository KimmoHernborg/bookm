import { createHash } from "node:crypto";

import { getRequest } from "@tanstack/react-start/server";

import { auth } from "#/lib/auth.ts";
import { normalizeGravatarEmail } from "#/lib/shared/avatar.ts";
import { ensureInit } from "./init.ts";

export type SessionUser = {
	id: string;
	email: string;
	name: string;
	isAdmin: boolean;
	// sha256 of the normalized email, for Gravatar lookups client-side.
	avatarHash: string;
};

export async function getSessionUser(): Promise<SessionUser | null> {
	await ensureInit();
	const request = getRequest();
	const session = await auth.api.getSession({ headers: request.headers });
	if (!session?.user) return null;
	const u = session.user as typeof session.user & { isAdmin?: boolean };
	return {
		id: u.id,
		email: u.email,
		name: u.name,
		isAdmin: u.isAdmin === true,
		avatarHash: createHash("sha256")
			.update(normalizeGravatarEmail(u.email))
			.digest("hex"),
	};
}

export async function requireUser(): Promise<SessionUser> {
	const user = await getSessionUser();
	if (!user) throw new Error("Not authenticated");
	return user;
}

export async function requireAdmin(): Promise<SessionUser> {
	const user = await requireUser();
	if (!user.isAdmin) throw new Error("Not authorized");
	return user;
}
