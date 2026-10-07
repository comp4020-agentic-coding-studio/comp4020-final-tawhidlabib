CREATE TABLE `comments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer,
	`hangout_id` integer,
	`author_id` integer NOT NULL,
	`body` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hangout_id`) REFERENCES `hangouts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "comments_one_target" CHECK(("comments"."event_id" IS NULL) != ("comments"."hangout_id" IS NULL))
);
--> statement-breakpoint
CREATE INDEX `comments_event` ON `comments` (`event_id`);--> statement-breakpoint
CREATE INDEX `comments_hangout` ON `comments` (`hangout_id`);--> statement-breakpoint
CREATE TABLE `reactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer,
	`hangout_id` integer,
	`person_id` integer NOT NULL,
	`emoji` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hangout_id`) REFERENCES `hangouts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "reactions_one_target" CHECK(("reactions"."event_id" IS NULL) != ("reactions"."hangout_id" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reactions_event_person` ON `reactions` (`event_id`,`person_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `reactions_hangout_person` ON `reactions` (`hangout_id`,`person_id`);