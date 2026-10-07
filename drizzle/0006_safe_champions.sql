ALTER TABLE `events` ADD `rsvp_by_date` text;--> statement-breakpoint
ALTER TABLE `events` ADD `rsvp_by_time` text;--> statement-breakpoint
ALTER TABLE `events` ADD `cover` text DEFAULT 'sunset' NOT NULL;