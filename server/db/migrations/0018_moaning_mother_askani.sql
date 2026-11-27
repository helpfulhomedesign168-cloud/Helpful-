ALTER TABLE "custom_work_requests" ALTER COLUMN "work_order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_work_requests" ADD COLUMN "invoice_id" uuid;--> statement-breakpoint
ALTER TABLE "custom_work_requests" ADD COLUMN "invoice_line_id" uuid;--> statement-breakpoint
ALTER TABLE "custom_work_requests" ADD CONSTRAINT "custom_work_requests_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_work_requests" ADD CONSTRAINT "custom_work_requests_invoice_line_id_invoice_lines_id_fk" FOREIGN KEY ("invoice_line_id") REFERENCES "public"."invoice_lines"("id") ON DELETE set null ON UPDATE no action;