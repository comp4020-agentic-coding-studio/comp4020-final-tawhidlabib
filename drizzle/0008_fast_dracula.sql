CREATE TABLE `everyone_free` (
	`group_id` text NOT NULL,
	`date` text NOT NULL,
	`start_hour` integer NOT NULL,
	`end_hour` integer NOT NULL,
	PRIMARY KEY(`group_id`, `date`, `start_hour`, `end_hour`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `nudges` (
	`group_id` text NOT NULL,
	`from_person_id` integer NOT NULL,
	`to_member_id` integer NOT NULL,
	`week` text NOT NULL,
	PRIMARY KEY(`group_id`, `from_person_id`, `to_member_id`, `week`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`from_person_id`) REFERENCES `people`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`to_member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
