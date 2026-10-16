CREATE TABLE `follows` (
	`follower_id` text NOT NULL,
	`following_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`follower_id`, `following_id`)
);
--> statement-breakpoint
CREATE INDEX `follows_target_idx` ON `follows` (`following_id`);--> statement-breakpoint
CREATE TABLE `messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`sender_id` text NOT NULL,
	`recipient_id` text NOT NULL,
	`body` text NOT NULL,
	`created_at` integer NOT NULL,
	`read_at` integer,
	`client_id` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `message_dedupe` ON `messages` (`sender_id`,`client_id`);--> statement-breakpoint
CREATE INDEX `messages_sender_idx` ON `messages` (`sender_id`,`id`);--> statement-breakpoint
CREATE INDEX `messages_recipient_idx` ON `messages` (`recipient_id`,`id`);