CREATE TABLE `analytics_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `article_daily` (
	`user_id` text NOT NULL,
	`post_id` integer NOT NULL,
	`day` text NOT NULL,
	`views` integer DEFAULT 0 NOT NULL,
	`likes` integer DEFAULT 0 NOT NULL,
	`unlikes` integer DEFAULT 0 NOT NULL,
	`saves` integer DEFAULT 0 NOT NULL,
	`unsaves` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `post_id`, `day`)
);
--> statement-breakpoint
CREATE INDEX `article_daily_owner_day` ON `article_daily` (`user_id`,`day`);--> statement-breakpoint
CREATE TABLE `follower_daily` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`added` integer DEFAULT 0 NOT NULL,
	`removed` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `day`)
);
