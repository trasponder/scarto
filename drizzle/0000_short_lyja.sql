CREATE TABLE `scarto_rooms` (
	`code` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`payload` text NOT NULL,
	`updated` integer NOT NULL
);
