ALTER TABLE `user` ADD `showcase_token` text;--> statement-breakpoint
CREATE UNIQUE INDEX `user_showcase_token_uq` ON `user` (`showcase_token`);