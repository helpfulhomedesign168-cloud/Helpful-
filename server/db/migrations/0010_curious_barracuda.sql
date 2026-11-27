ALTER TABLE "users" ADD COLUMN "code" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "surname" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "salutation" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "company_phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "emergency_name" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "emergency_phone" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "team" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_file_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_avatar_file_id_files_id_fk" FOREIGN KEY ("avatar_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;