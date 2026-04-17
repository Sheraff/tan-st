CREATE TABLE `links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text,
	`destination_url` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT "links_active_check" CHECK("links"."active" in (0, 1))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `links_slug_unique` ON `links` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `links_destination_url_unique` ON `links` (`destination_url`);--> statement-breakpoint
CREATE INDEX `idx_links_slug_active` ON `links` (`slug`,`active`);