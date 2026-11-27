ALTER TABLE "work_order_assignments" ADD COLUMN "line_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "work_order_assignments" ADD COLUMN "time" text;--> statement-breakpoint
ALTER TABLE "work_order_assignments" ADD COLUMN "material_deduction_item" text;--> statement-breakpoint
ALTER TABLE "work_order_assignments" ADD COLUMN "material_deduction_amount_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "work_order_extra_works" ADD COLUMN "resource_id" uuid;--> statement-breakpoint
ALTER TABLE "work_order_extra_works" ADD COLUMN "supplier_id" uuid;--> statement-breakpoint
ALTER TABLE "work_order_extra_works" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "group_id" text;--> statement-breakpoint
ALTER TABLE "work_orders" ADD COLUMN "date_changes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "work_order_extra_works" ADD CONSTRAINT "work_order_extra_works_resource_id_contractors_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."contractors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_order_extra_works" ADD CONSTRAINT "work_order_extra_works_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;