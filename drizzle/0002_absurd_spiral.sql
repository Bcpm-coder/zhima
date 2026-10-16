CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`username` text NOT NULL,
	`email` text,
	`bio` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
