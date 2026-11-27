CREATE TABLE "invoice_payment_plan" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"installment" integer NOT NULL,
	"label" text NOT NULL,
	"percentage" integer NOT NULL,
	"amount_cents" integer NOT NULL,
	"cumulative_cents" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice_payment_plan" ADD CONSTRAINT "invoice_payment_plan_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "invoice_payment_plan_invoice_installment" ON "invoice_payment_plan" USING btree ("invoice_id","installment");