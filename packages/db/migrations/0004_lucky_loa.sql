CREATE TYPE "public"."application_status" AS ENUM('discovered', 'matched', 'drafted', 'approved', 'applied', 'replied', 'interviewing', 'offer', 'rejected', 'ghosted');--> statement-breakpoint
CREATE TABLE "application_transitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"from_status" "application_status",
	"to_status" "application_status" NOT NULL,
	"note" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"document_id" uuid,
	"status" "application_status" DEFAULT 'discovered' NOT NULL,
	"snapshot_checksum_pdf" text,
	"snapshot_checksum_docx" text,
	"snapshot_claim_ids" uuid[],
	"snapshot_model" text,
	"snapshot_prompt_version" text,
	"snapshot_cassette_key" text,
	"approved_at" timestamp with time zone,
	"applied_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Nullable first, then backfilled and locked down: this table already had
-- one real row (Phase 8's manual end-to-end verification) before this
-- column existed, so a bare "ADD COLUMN ... NOT NULL" would fail against
-- it. Backfilled with its actual, real cassette key from that verification
-- run, not a placeholder -- the value is already known.
--
-- `documents` already has FORCE ROW LEVEL SECURITY from an earlier
-- migration run (sql/02-rls.sql, which re-applies unconditionally right
-- after this file and will re-enable it) -- a blind UPDATE here, with no
-- `jobhunter.current_user_id` session var set, would otherwise match zero
-- rows under that policy and leave the real row's new column still NULL.
ALTER TABLE "documents" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "cassette_key" text;--> statement-breakpoint
UPDATE "documents" SET "cassette_key" = 'd8267ef9ab205bb4c6870e39cb92d8a39760d6bafab7743ed5ac452b634f6fb9' WHERE "cassette_key" IS NULL;--> statement-breakpoint
ALTER TABLE "documents" ALTER COLUMN "cassette_key" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "application_transitions" ADD CONSTRAINT "application_transitions_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_transitions" ADD CONSTRAINT "application_transitions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_job_canonical_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."job_canonical"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_application_transitions_application" ON "application_transitions" USING btree ("application_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_applications_owner_job" ON "applications" USING btree ("owner_id","job_id");--> statement-breakpoint
CREATE INDEX "idx_applications_owner_status" ON "applications" USING btree ("owner_id","status");