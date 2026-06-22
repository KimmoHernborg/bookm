-- FTS5 mirror of bookmarks. rowid = bookmarks.id. Maintained from
-- application code (src/lib/server/fts.ts), not triggers, because the
-- `tags` column is a join across bookmark_tags.
CREATE VIRTUAL TABLE `bookmarks_fts` USING fts5(
	`title`,
	`summary`,
	`description`,
	`tags`
);
