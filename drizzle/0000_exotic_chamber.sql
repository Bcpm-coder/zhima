CREATE TABLE `bookmarks` (
	`user_id` text NOT NULL,
	`post_id` integer NOT NULL,
	PRIMARY KEY(`user_id`, `post_id`)
);
--> statement-breakpoint
CREATE TABLE `checkins` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	PRIMARY KEY(`user_id`, `day`)
);
--> statement-breakpoint
CREATE TABLE `likes` (
	`user_id` text NOT NULL,
	`post_id` integer NOT NULL,
	PRIMARY KEY(`user_id`, `post_id`)
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`category` text NOT NULL,
	`author` text NOT NULL,
	`created_at` integer NOT NULL,
	`legacy_id` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `legacy_import` ON `posts` (`user_id`,`legacy_id`);--> statement-breakpoint
CREATE TABLE `views` (
	`post_id` integer PRIMARY KEY NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
