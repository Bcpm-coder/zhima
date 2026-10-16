ALTER TABLE `posts` ADD `summary` text;--> statement-breakpoint
ALTER TABLE `posts` ADD `summary_status` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `summary_revision` text;