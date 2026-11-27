ALTER TABLE "suppliers" ADD COLUMN "contact2" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "phone2" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "categories" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "has_product_styles" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "suppliers" ADD COLUMN "logo_file_id" uuid;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_logo_file_id_files_id_fk" FOREIGN KEY ("logo_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;