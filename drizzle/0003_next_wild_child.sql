PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bookmark_tags` (
	`bookmark_id` integer NOT NULL,
	`tag_id` integer NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`bookmark_id`, `tag_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`bookmark_id`,`user_id`) REFERENCES `bookmarks`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`,`user_id`) REFERENCES `tags`(`id`,`user_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_bookmark_tags`("bookmark_id", "tag_id", "user_id") SELECT bt."bookmark_id", bt."tag_id", b."user_id" FROM `bookmark_tags` bt JOIN `bookmarks` b ON b."id" = bt."bookmark_id";--> statement-breakpoint
DROP TABLE `bookmark_tags`;--> statement-breakpoint
ALTER TABLE `__new_bookmark_tags` RENAME TO `bookmark_tags`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `bookmark_tags_tag_idx` ON `bookmark_tags` (`tag_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `bookmarks_id_user_uq` ON `bookmarks` (`id`,`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `tags_id_user_uq` ON `tags` (`id`,`user_id`);