CREATE TABLE `domain_favicons` (
	`domain` text PRIMARY KEY NOT NULL,
	`data_url` text,
	`status` text NOT NULL,
	`fetched_at` integer DEFAULT (unixepoch()) NOT NULL
);
