CREATE TYPE "public"."payment_custody" AS ENUM('company', 'sales');--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "custody" "payment_custody" DEFAULT 'company' NOT NULL;