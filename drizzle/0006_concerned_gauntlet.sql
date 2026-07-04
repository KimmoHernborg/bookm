DROP INDEX `categories_user_name_uq`;--> statement-breakpoint
CREATE UNIQUE INDEX `categories_user_name_uq` ON `categories` (`user_id`,lower("name"));