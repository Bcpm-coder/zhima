ALTER TABLE `posts` ADD `tags` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `format` text DEFAULT 'plain' NOT NULL;--> statement-breakpoint
ALTER TABLE `posts` ADD `source_name` text DEFAULT '' NOT NULL;