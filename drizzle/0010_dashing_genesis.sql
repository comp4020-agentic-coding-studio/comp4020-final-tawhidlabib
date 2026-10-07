CREATE TABLE `blocks` (
	`blocker_id` integer NOT NULL,
	`blocked_id` integer NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	PRIMARY KEY(`blocker_id`, `blocked_id`),
	FOREIGN KEY (`blocker_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`blocked_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `members` ADD `muted` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `people` ADD `avatar_photo` text;--> statement-breakpoint
ALTER TABLE `people` ADD `avatar_emoji` text;--> statement-breakpoint
ALTER TABLE `people` ADD `bio` text;