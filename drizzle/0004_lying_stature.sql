CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_user_name_uq` ON `categories` (`user_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `categories_id_user_uq` ON `categories` (`id`,`user_id`);--> statement-breakpoint
CREATE TABLE `default_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `default_categories_name_unique` ON `default_categories` (`name`);--> statement-breakpoint
--> drizzle-kit omitted the ON DELETE clause recorded in the snapshot
--> (bookmarks_category_id_categories_id_fk: set null); added by hand so
--> deleting a category un-categorizes its bookmarks instead of erroring.
ALTER TABLE `bookmarks` ADD `category_id` integer REFERENCES categories(id) ON DELETE SET NULL;--> statement-breakpoint
CREATE INDEX `bookmarks_category_idx` ON `bookmarks` (`category_id`);