import { sql } from "drizzle-orm";
import {
	index,
	integer,
	primaryKey,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

// ---------------------------------------------------------------------------
// Better Auth tables
// ---------------------------------------------------------------------------

export const user = sqliteTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: integer("email_verified", { mode: "boolean" })
		.notNull()
		.default(false),
	image: text("image"),
	isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
	openrouterModel: text("openrouter_model"),
	openrouterBaseUrl: text("openrouter_base_url"),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

export const session = sqliteTable("session", {
	id: text("id").primaryKey(),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
	token: text("token").notNull().unique(),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

export const account = sqliteTable("account", {
	id: text("id").primaryKey(),
	accountId: text("account_id").notNull(),
	providerId: text("provider_id").notNull(),
	userId: text("user_id")
		.notNull()
		.references(() => user.id, { onDelete: "cascade" }),
	accessToken: text("access_token"),
	refreshToken: text("refresh_token"),
	idToken: text("id_token"),
	accessTokenExpiresAt: integer("access_token_expires_at", {
		mode: "timestamp",
	}),
	refreshTokenExpiresAt: integer("refresh_token_expires_at", {
		mode: "timestamp",
	}),
	scope: text("scope"),
	password: text("password"),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

export const verification = sqliteTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
	createdAt: integer("created_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.notNull()
		.default(sql`(unixepoch())`),
});

// ---------------------------------------------------------------------------
// Bookm domain tables
// ---------------------------------------------------------------------------

export const CONTENT_TYPES = [
	"article",
	"video",
	"repo",
	"docs",
	"paper",
	"tool",
	"discussion",
	"other",
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const BOOKMARK_STATUSES = [
	"pending",
	"processed",
	"failed",
	"broken",
] as const;
export type BookmarkStatus = (typeof BOOKMARK_STATUSES)[number];

export const bookmarks = sqliteTable(
	"bookmarks",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		url: text("url").notNull(),
		urlCanonical: text("url_canonical").notNull(),
		title: text("title"),
		summary: text("summary"),
		description: text("description"),
		contentType: text("content_type").$type<ContentType>(),
		language: text("language"),
		readingTimeMinutes: integer("reading_time_minutes"),
		// Readability-extracted plain text; read by tag_bookmark
		content: text("content"),
		extractionQuality: text("extraction_quality").$type<"full" | "low">(),
		// broken = URL unreachable at fetch time (4xx/5xx), distinct from
		// failed (job error). Set only during fetch_and_extract.
		status: text("status").$type<BookmarkStatus>().notNull().default("pending"),
		starred: integer("starred", { mode: "boolean" }).notNull().default(false),
		archived: integer("archived", { mode: "boolean" }).notNull().default(false),
		deletedAt: integer("deleted_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		processedAt: integer("processed_at", { mode: "timestamp" }),
	},
	(t) => [
		uniqueIndex("bookmarks_user_url_canonical_uq").on(t.userId, t.urlCanonical),
		index("bookmarks_user_view_idx").on(t.userId, t.archived, t.deletedAt),
		index("bookmarks_status_idx").on(t.status),
	],
);

export const tags = sqliteTable(
	"tags",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		color: text("color"),
	},
	(t) => [uniqueIndex("tags_user_name_uq").on(t.userId, t.name)],
);

export const bookmarkTags = sqliteTable(
	"bookmark_tags",
	{
		bookmarkId: integer("bookmark_id")
			.notNull()
			.references(() => bookmarks.id, { onDelete: "cascade" }),
		tagId: integer("tag_id")
			.notNull()
			.references(() => tags.id, { onDelete: "cascade" }),
	},
	(t) => [
		primaryKey({ columns: [t.bookmarkId, t.tagId] }),
		index("bookmark_tags_tag_idx").on(t.tagId),
	],
);

export const JOB_STATUSES = [
	"pending",
	"running",
	"completed",
	"failed",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const jobs = sqliteTable(
	"jobs",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		kind: text("kind").notNull(),
		// Zod-validated discriminated union per kind
		payloadJson: text("payload_json").notNull(),
		status: text("status").$type<JobStatus>().notNull().default("pending"),
		attempts: integer("attempts").notNull().default(0),
		// set atomically when worker claims the job
		claimedAt: integer("claimed_at", { mode: "timestamp" }),
		nextRunAt: integer("next_run_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		lastError: text("last_error"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [index("jobs_claim_idx").on(t.status, t.nextRunAt)],
);

export type Bookmark = typeof bookmarks.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type User = typeof user.$inferSelect;
