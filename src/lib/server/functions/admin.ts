import { createServerFn } from "@tanstack/react-start";
import { count, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "#/db/index.ts";
import { bookmarks, jobs, user } from "#/db/schema.ts";
import { retryJob } from "#/lib/server/jobs/worker.ts";
import { requireAdmin } from "#/lib/server/session.ts";

export const getAdminOverview = createServerFn({ method: "GET" }).handler(
	async () => {
		await requireAdmin();

		const jobRows = db.all<{
			id: number;
			kind: string;
			status: string;
			attempts: number;
			last_error: string | null;
			created_at: number;
			bookmark_url: string | null;
			user_email: string | null;
		}>(sql`
			-- fetch_favicon jobs carry no bookmarkId; fall back to their pageUrl
			-- so the admin table still shows which site is being processed.
			SELECT j.id, j.kind, j.status, j.attempts, j.last_error, j.created_at,
				COALESCE(b.url, json_extract(j.payload_json, '$.pageUrl')) AS bookmark_url,
				u.email AS user_email
			FROM jobs j
			LEFT JOIN bookmarks b ON b.id = json_extract(j.payload_json, '$.bookmarkId')
			LEFT JOIN user u ON u.id = b.user_id
			WHERE j.status IN ('pending', 'running', 'failed')
			ORDER BY j.status = 'failed' DESC, j.created_at DESC
			LIMIT 200
		`);

		const users = db
			.select({
				id: user.id,
				email: user.email,
				isAdmin: user.isAdmin,
				createdAt: user.createdAt,
				bookmarkCount: count(bookmarks.id),
			})
			.from(user)
			.leftJoin(
				bookmarks,
				sql`${bookmarks.userId} = ${user.id} AND ${bookmarks.deletedAt} IS NULL`,
			)
			.groupBy(user.id)
			.orderBy(user.createdAt)
			.all();

		const broken = db
			.select({
				id: bookmarks.id,
				url: bookmarks.url,
				userEmail: user.email,
				updatedAt: bookmarks.updatedAt,
			})
			.from(bookmarks)
			.innerJoin(user, eq(user.id, bookmarks.userId))
			.where(eq(bookmarks.status, "broken"))
			.orderBy(desc(bookmarks.updatedAt))
			.all();

		const jobStats = db
			.select({ status: jobs.status, value: count() })
			.from(jobs)
			.groupBy(jobs.status)
			.all();

		return {
			jobs: jobRows.map((j) => ({
				id: j.id,
				kind: j.kind,
				status: j.status,
				attempts: j.attempts,
				lastError: j.last_error,
				createdAt: j.created_at * 1000,
				bookmarkUrl: j.bookmark_url,
				userEmail: j.user_email,
			})),
			users: users.map((u) => ({
				...u,
				createdAt: u.createdAt.getTime(),
			})),
			broken: broken.map((b) => ({
				...b,
				updatedAt: b.updatedAt.getTime(),
			})),
			jobStats,
		};
	},
);

export const adminRetryJob = createServerFn({ method: "POST" })
	.inputValidator((data: { id: number }) =>
		z.object({ id: z.number().int() }).parse(data),
	)
	.handler(async ({ data }) => {
		await requireAdmin();
		retryJob(data.id);
	});

export const adminSetAdmin = createServerFn({ method: "POST" })
	.inputValidator((data: { userId: string; isAdmin: boolean }) =>
		z.object({ userId: z.string(), isAdmin: z.boolean() }).parse(data),
	)
	.handler(async ({ data }) => {
		const admin = await requireAdmin();
		if (admin.id === data.userId && !data.isAdmin) {
			throw new Error("You cannot demote yourself");
		}
		db.update(user)
			.set({ isAdmin: data.isAdmin, updatedAt: new Date() })
			.where(eq(user.id, data.userId))
			.run();
	});

export const adminCreateUser = createServerFn({ method: "POST" })
	.inputValidator((data: { email: string; password: string; name: string }) =>
		z
			.object({
				email: z.string().email(),
				password: z.string().min(8).max(128),
				name: z.string().trim().min(1).max(100),
			})
			.parse(data),
	)
	.handler(async ({ data }) => {
		await requireAdmin();
		// Server-side call bypasses the public sign-up gate in the auth route.
		const { auth } = await import("#/lib/auth.ts");
		await auth.api.signUpEmail({
			body: { email: data.email, password: data.password, name: data.name },
		});
	});

export const adminDeleteBrokenBookmarks = createServerFn({ method: "POST" })
	.inputValidator((data: { ids: Array<number> }) =>
		z.object({ ids: z.array(z.number().int()).min(1).max(1000) }).parse(data),
	)
	.handler(async ({ data }) => {
		await requireAdmin();
		db.update(bookmarks)
			.set({ deletedAt: new Date(), updatedAt: new Date() })
			.where(inArray(bookmarks.id, data.ids))
			.run();
	});
