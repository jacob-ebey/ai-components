CREATE TABLE `open_ai_api_key` (
	`user_id` integer PRIMARY KEY NOT NULL,
	`api_key` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
