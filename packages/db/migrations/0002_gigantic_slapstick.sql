CREATE TYPE "public"."job_source_provider" AS ENUM('greenhouse', 'lever');--> statement-breakpoint
CREATE TABLE "company_ats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"provider" "job_source_provider" NOT NULL,
	"board_token" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_canonical" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"dedup_key" text NOT NULL,
	"company" text NOT NULL,
	"title" text NOT NULL,
	"location" text,
	"description" text NOT NULL,
	"url" text NOT NULL,
	"posted_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"supersedes_id" uuid,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_raw" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "job_source_provider" NOT NULL,
	"source_job_id" text NOT NULL,
	"payload_hash" text NOT NULL,
	"raw_payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_source_listing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"canonical_id" uuid NOT NULL,
	"provider" "job_source_provider" NOT NULL,
	"source_job_id" text NOT NULL,
	"raw_id" uuid NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_source_listing" ADD CONSTRAINT "job_source_listing_canonical_id_job_canonical_id_fk" FOREIGN KEY ("canonical_id") REFERENCES "public"."job_canonical"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_source_listing" ADD CONSTRAINT "job_source_listing_raw_id_job_raw_id_fk" FOREIGN KEY ("raw_id") REFERENCES "public"."job_raw"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_company_ats_provider_token" ON "company_ats" USING btree ("provider","board_token");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_job_canonical_dedup_key_open" ON "job_canonical" USING btree ("dedup_key") WHERE "job_canonical"."closed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_job_canonical_company" ON "job_canonical" USING btree ("company");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_job_raw_provider_job_hash" ON "job_raw" USING btree ("provider","source_job_id","payload_hash");--> statement-breakpoint
CREATE INDEX "idx_job_raw_provider_job" ON "job_raw" USING btree ("provider","source_job_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_job_source_listing_provider_job" ON "job_source_listing" USING btree ("provider","source_job_id");--> statement-breakpoint
CREATE INDEX "idx_job_source_listing_canonical" ON "job_source_listing" USING btree ("canonical_id");