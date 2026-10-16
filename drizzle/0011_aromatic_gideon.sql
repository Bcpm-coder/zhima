CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`post_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`parent_id` text,
	`reply_to_id` text,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer,
	`client_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `comment_dedupe` ON `comments` (`user_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `comments_post_parent` ON `comments` (`post_id`,`parent_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_author_time` ON `comments` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`recipient_id` text NOT NULL,
	`actor_id` text NOT NULL,
	`kind` text NOT NULL,
	`post_id` integer,
	`comment_id` text,
	`created_at` integer NOT NULL,
	`read_at` integer,
	`event_key` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notification_event` ON `notifications` (`recipient_id`,`event_key`);--> statement-breakpoint
CREATE INDEX `notifications_recipient` ON `notifications` (`recipient_id`,`id`);--> statement-breakpoint
CREATE INDEX `notifications_unread` ON `notifications` (`recipient_id`,`read_at`);