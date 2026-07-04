--> Seed the global default-categories template, then copy it to every user
--> that already exists (the signup hook only covers users created later).
INSERT INTO `default_categories` (`name`, `sort_order`) VALUES
	('Programming', 0),
	('AI & Machine Learning', 1),
	('Design', 2),
	('DevOps & Infrastructure', 3),
	('Productivity & Tools', 4),
	('Science & Research', 5),
	('Business & Finance', 6),
	('News & Culture', 7),
	('Reference', 8);--> statement-breakpoint
INSERT INTO `categories` (`user_id`, `name`, `sort_order`)
SELECT u.`id`, dc.`name`, dc.`sort_order` FROM `user` u CROSS JOIN `default_categories` dc;
