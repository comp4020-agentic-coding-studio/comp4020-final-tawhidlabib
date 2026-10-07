CREATE TABLE `group_bans` (
	`group_id` text NOT NULL,
	`person_id` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`group_id`, `person_id`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `groups` ADD `admin_id` integer;--> statement-breakpoint
ALTER TABLE `groups` ADD `archived_at` text;