ALTER TABLE "invoices" ADD COLUMN "sales_name" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "supervisor_name" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "idempotency_key" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_idempotency_key_unique" UNIQUE("idempotency_key");