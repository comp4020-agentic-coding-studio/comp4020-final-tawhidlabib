CREATE TABLE `availability` (
	`member_id` integer NOT NULL,
	`date` text NOT NULL,
	`hour` integer NOT NULL,
	PRIMARY KEY(`member_id`, `date`, `hour`),
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`timezone` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `hangouts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` text NOT NULL,
	`date` text NOT NULL,
	`start_hour` integer NOT NULL,
	`end_hour` integer NOT NULL,
	`title` text NOT NULL,
	`proposed_by` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proposed_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` text NOT NULL,
	`name` text NOT NULL,
	`name_key` text NOT NULL,
	`token` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_token_unique` ON `members` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_group_name` ON `members` (`group_id`,`name_key`);--> statement-breakpoint
CREATE TABLE `rsvps` (
	`hangout_id` integer NOT NULL,
	`member_id` integer NOT NULL,
	`response` text NOT NULL,
	PRIMARY KEY(`hangout_id`, `member_id`),
	FOREIGN KEY (`hangout_id`) REFERENCES `hangouts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
