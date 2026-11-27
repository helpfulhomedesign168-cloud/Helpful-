ALTER TABLE "invoices" ADD COLUMN "team" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "is_additional" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "parent_invoice_id" uuid;