ALTER TABLE `event_guests` ADD `plus_ones` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `event_guests` ADD `waitlist_seq` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `capacity` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `max_plus_ones` integer DEFAULT 0 NOT NULL;