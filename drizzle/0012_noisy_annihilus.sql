CREATE TABLE `activity` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` text NOT NULL,
	`actor_id` integer,
	`actor_label` text NOT NULL,
	`action` text NOT NULL,
	`target` text NOT NULL,
	`outcome` text NOT NULL,
	`detail` text
);
--> statement-breakpoint
CREATE INDEX `activity_at` ON `activity` (`at`);