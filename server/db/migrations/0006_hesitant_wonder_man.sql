CREATE TYPE "public"."cancellation_status" AS ENUM('pending', 'awaiting_credit_note', 'awaiting_transfer', 'completed');--> statement-breakpoint
CREATE TABLE "cancellation_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"status" "cancellation_status" DEFAULT 'pending' NOT NULL,
	"refund_amount_cents" integer DEFAULT 0 NOT NULL,
	"deductions_cents" integer DEFAULT 0 NOT NULL,
	"refund_reason" text,
	"bank_name" text,
	"bank_account_name" text,
	"bank_account_number" text,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "cancellation_cases" ADD CONSTRAINT "cancellation_cases_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_cases" ADD CONSTRAINT "cancellation_cases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;