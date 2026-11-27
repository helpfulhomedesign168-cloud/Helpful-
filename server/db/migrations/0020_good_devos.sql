ALTER TABLE "municipal_order_lines" ADD COLUMN "source_line_id" uuid;--> statement-breakpoint
ALTER TABLE "municipal_order_lines" ADD COLUMN "measure" text;--> statement-breakpoint
ALTER TABLE "municipal_order_lines" ADD COLUMN "length" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "municipal_order_lines" ADD COLUMN "width" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "municipal_order_lines" ADD COLUMN "dimension_unit" text;--> statement-breakpoint
ALTER TABLE "municipal_order_lines" ADD COLUMN "product_style_text" text;