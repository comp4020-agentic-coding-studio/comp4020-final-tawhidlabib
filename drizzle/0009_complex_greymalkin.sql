CREATE TABLE `photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer,
	`hangout_id` integer,
	`uploader_id` integer NOT NULL,
	`file` text NOT NULL,
	`mime` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hangout_id`) REFERENCES `hangouts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploader_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "photos_one_target" CHECK(("photos"."event_id" IS NULL) != ("photos"."hangout_id" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `photos_file_unique` ON `photos` (`file`);--> statement-breakpoint
CREATE TABLE `ratings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer,
	`hangout_id` integer,
	`person_id` integer NOT NULL,
	`score` integer NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`hangout_id`) REFERENCES `hangouts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ratings_one_target" CHECK(("ratings"."event_id" IS NULL) != ("ratings"."hangout_id" IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ratings_event_person` ON `ratings` (`event_id`,`person_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ratings_hangout_person` ON `ratings` (`hangout_id`,`person_id`);