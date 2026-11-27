CREATE TYPE "public"."custom_work_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "custom_work_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"work_order_id" uuid NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit" text NOT NULL,
	"status" "custom_work_status" DEFAULT 'pending' NOT NULL,
	"price_cents" integer,
	"notes" text,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_by" uuid,
	"responded_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "custom_work_requests" ADD CONSTRAINT "custom_work_requests_work_order_id_work_orders_id_fk" FOREIGN KEY ("work_order_id") REFERENCES "public"."work_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_work_requests" ADD CONSTRAINT "custom_work_requests_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_work_requests" ADD CONSTRAINT "custom_work_requests_responded_by_users_id_fk" FOREIGN KEY ("responded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;