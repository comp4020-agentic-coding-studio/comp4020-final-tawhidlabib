PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_hangouts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` text NOT NULL,
	`date` text NOT NULL,
	`start_hour` integer NOT NULL,
	`end_hour` integer NOT NULL,
	`title` text NOT NULL,
	`proposed_by` integer,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`proposed_by`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_hangouts`("id", "group_id", "date", "start_hour", "end_hour", "title", "proposed_by", "created_at") SELECT "id", "group_id", "date", "start_hour", "end_hour", "title", "proposed_by", "created_at" FROM `hangouts`;--> statement-breakpoint
DROP TABLE `hangouts`;--> statement-breakpoint
ALTER TABLE `__new_hangouts` RENAME TO `hangouts`;--> statement-breakpoint
PRAGMA foreign_keys=ON;