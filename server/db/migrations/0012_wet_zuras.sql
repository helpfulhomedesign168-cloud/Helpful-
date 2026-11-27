ALTER TABLE "contractors" ADD COLUMN "type" text DEFAULT 'contractor' NOT NULL;--> statement-breakpoint
ALTER TABLE "contractors" ADD COLUMN "kind" text;--> statement-breakpoint
ALTER TABLE "contractors" ADD COLUMN "specialty" text;--> statement-breakpoint
ALTER TABLE "contractors" ADD COLUMN "main_work" text;--> statement-breakpoint
ALTER TABLE "contractors" ADD COLUMN "scope" text;--> statement-breakpoint
ALTER TABLE "contractors" ADD COLUMN "details" text;--> statement-breakpoint
ALTER TABLE "contractors" ADD COLUMN "trades" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "contractors" ADD COLUMN "fee_mode" text;--> statement-breakpoint
ALTER TABLE "contractors" ADD COLUMN "fee_amount" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "contractors" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;