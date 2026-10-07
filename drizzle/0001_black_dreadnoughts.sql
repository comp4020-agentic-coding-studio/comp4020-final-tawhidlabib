CREATE TABLE `event_guests` (
	`event_id` integer NOT NULL,
	`person_id` integer NOT NULL,
	`invited_by` integer,
	`response` text NOT NULL,
	PRIMARY KEY(`event_id`, `person_id`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`share_id` text NOT NULL,
	`host_id` integer NOT NULL,
	`title` text NOT NULL,
	`details` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`date` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`timezone` text NOT NULL,
	`visibility` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`host_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_share_id_unique` ON `events` (`share_id`);--> statement-breakpoint
CREATE TABLE `friendships` (
	`requester_id` integer NOT NULL,
	`addressee_id` integer NOT NULL,
	`status` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`requester_id`, `addressee_id`),
	FOREIGN KEY (`requester_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`addressee_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `people` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`token` text NOT NULL,
	`friend_code` text NOT NULL,
	`timezone` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `people_token_unique` ON `people` (`token`);--> statement-breakpoint
CREATE UNIQUE INDEX `people_friend_code_unique` ON `people` (`friend_code`);--> statement-breakpoint
ALTER TABLE `members` ADD `person_id` integer REFERENCES people(id);