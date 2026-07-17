import { sql } from "drizzle-orm";
import {
	foreignKey,
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

export const user = sqliteTable(
	"user",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		email: text("email").notNull().unique(),
		emailVerified: integer("email_verified", { mode: "boolean" })
			.notNull()
			.default(false),
		image: text("image"),
		isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
		// null = public showcase disabled. Managed outside better-auth so the
		// token never rides along in session payloads.
		showcaseToken: text("showcase_token"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [uniqueIndex("user_showcase_token_uq").on(t.showcaseToken)],
);

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

// Curated per-user list; the AI picks one per bookmark from this list and
// never invents new ones (unlike tags). Names keep display casing.
export const categories = sqliteTable(
	"categories",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		sortOrder: integer("sort_order").notNull().default(0),
	},
	(t) => [
		// Case-insensitive, matching the app-level duplicate checks — the DB
		// must not accept "Design" and "design" for the same user.
		uniqueIndex("categories_user_name_uq").on(t.userId, sql`lower(${t.name})`),
		// Composite-FK target, kept for a future (category_id, user_id) FK.
		uniqueIndex("categories_id_user_uq").on(t.id, t.userId),
	],
);

// Global template copied into a user's categories at signup. Admin-managed;
// edits do not ripple to existing users.
export const defaultCategories = sqliteTable("default_categories", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	name: text("name").notNull().unique(),
	sortOrder: integer("sort_order").notNull().default(0),
});

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
		// Single-column FK by design: a composite (category_id, user_id) FK
		// cannot use SET NULL (it would null user_id too) and cannot be added
		// without rebuilding this table, which would cascade-delete
		// bookmark_tags (see drizzle/0003). Tenant isolation is enforced in
		// every write path instead.
		categoryId: integer("category_id").references(() => categories.id, {
			onDelete: "set null",
		}),
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
		index("bookmarks_category_idx").on(t.categoryId),
		// Composite-FK target for bookmark_tags (id + user_id together).
		uniqueIndex("bookmarks_id_user_uq").on(t.id, t.userId),
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
	(t) => [
		uniqueIndex("tags_user_name_uq").on(t.userId, t.name),
		// Composite-FK target for bookmark_tags (id + user_id together).
		uniqueIndex("tags_id_user_uq").on(t.id, t.userId),
	],
);

export const bookmarkTags = sqliteTable(
	"bookmark_tags",
	{
		bookmarkId: integer("bookmark_id").notNull(),
		tagId: integer("tag_id").notNull(),
		// Tenant key: composite FKs below force the linked bookmark and tag to
		// belong to this same user, so a join row can never cross tenants.
		userId: text("user_id")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(t) => [
		primaryKey({ columns: [t.bookmarkId, t.tagId] }),
		index("bookmark_tags_tag_idx").on(t.tagId),
		foreignKey({
			columns: [t.bookmarkId, t.userId],
			foreignColumns: [bookmarks.id, bookmarks.userId],
		}).onDelete("cascade"),
		foreignKey({
			columns: [t.tagId, t.userId],
			foreignColumns: [tags.id, tags.userId],
		}).onDelete("cascade"),
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
export type Category = typeof categories.$inferSelect;
export type DefaultCategory = typeof defaultCategories.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type User = typeof user.$inferSelect;
