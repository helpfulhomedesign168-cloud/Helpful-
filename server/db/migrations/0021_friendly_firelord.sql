ALTER TABLE "cancellation_cases" ADD COLUMN "transfer_reference" text;--> statement-breakpoint
ALTER TABLE "cancellation_cases" ADD COLUMN "credit_note_file_id" uuid;--> statement-breakpoint
ALTER TABLE "cancellation_cases" ADD COLUMN "signed_credit_note_file_id" uuid;--> statement-breakpoint
ALTER TABLE "cancellation_cases" ADD COLUMN "transfer_proof_file_id" uuid;--> statement-breakpoint
ALTER TABLE "cancellation_cases" ADD COLUMN "commission_reversals" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "cancellation_cases" ADD COLUMN "completed_by" uuid;--> statement-breakpoint
ALTER TABLE "cancellation_cases" ADD CONSTRAINT "cancellation_cases_credit_note_file_id_files_id_fk" FOREIGN KEY ("credit_note_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_cases" ADD CONSTRAINT "cancellation_cases_signed_credit_note_file_id_files_id_fk" FOREIGN KEY ("signed_credit_note_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_cases" ADD CONSTRAINT "cancellation_cases_transfer_proof_file_id_files_id_fk" FOREIGN KEY ("transfer_proof_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_cases" ADD CONSTRAINT "cancellation_cases_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;