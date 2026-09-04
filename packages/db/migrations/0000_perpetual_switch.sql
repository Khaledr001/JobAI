CREATE TYPE "public"."claim_kind" AS ENUM('used_technology', 'held_role', 'date_range', 'metric', 'responsibility', 'delivered_project');--> statement-breakpoint
CREATE TYPE "public"."conflict_kind" AS ENUM('tech_stack', 'count', 'metric_value', 'date_range', 'coverage_gap', 'duplicate_entity', 'definition');--> statement-breakpoint
CREATE TYPE "public"."conflict_status" AS ENUM('open', 'resolved', 'accepted_both', 'wont_fix');--> statement-breakpoint
CREATE TYPE "public"."evidence_kind" AS ENUM('git_commit', 'git_file_presence', 'dependency_manifest', 'log_line', 'doc_section', 'live_url', 'employer_reference', 'certificate', 'attestation');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('active', 'shipped', 'archived');--> statement-breakpoint
CREATE TYPE "public"."taxonomy_edge_relation" AS ENUM('implies', 'broader_than', 'adjacent', 'requires', 'used_with', 'belongs_to_domain');--> statement-breakpoint
CREATE TYPE "public"."taxonomy_node_kind" AS ENUM('technology', 'skill', 'concept', 'domain');--> statement-breakpoint
CREATE TYPE "public"."taxonomy_review_status" AS ENUM('proposed', 'canonical', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."tech_tag_role" AS ENUM('primary', 'supporting', 'incidental');--> statement-breakpoint
CREATE TYPE "public"."verification" AS ENUM('attested', 'documented', 'corroborated', 'measured');--> statement-breakpoint
CREATE TYPE "public"."work_entry_type" AS ENUM('feature', 'fix', 'refactor', 'architecture', 'performance', 'infra', 'integration', 'security', 'docs', 'learning', 'release');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"owner_id" uuid PRIMARY KEY NOT NULL,
	"headline" text,
	"summary" text,
	"location" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "experiences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"organization_name" text NOT NULL,
	"title" text NOT NULL,
	"location" text,
	"started_on" date NOT NULL,
	"ended_on" date,
	"ends_open" boolean DEFAULT false NOT NULL,
	"counts_toward_total" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taxonomy_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"node_id" uuid NOT NULL,
	"alias" text NOT NULL,
	"normalized" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taxonomy_edges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"from_node_id" uuid NOT NULL,
	"to_node_id" uuid NOT NULL,
	"relation" "taxonomy_edge_relation" NOT NULL,
	"weight" numeric(4, 3) DEFAULT '1.000' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "taxonomy_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "taxonomy_node_kind" NOT NULL,
	"canonical_name" text NOT NULL,
	"slug" text NOT NULL,
	"review_status" "taxonomy_review_status" DEFAULT 'canonical' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_epochs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"label" text NOT NULL,
	"stack_summary" text,
	"started_on" date NOT NULL,
	"ended_on" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" "project_status" DEFAULT 'active' NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"project_id" uuid,
	"epoch_id" uuid,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"outcome" text,
	"type" "work_entry_type" NOT NULL,
	"occurred_on" date NOT NULL,
	"occurred_through" date,
	"source_kind" "evidence_kind",
	"source_ref" text,
	"content_hash" text NOT NULL,
	"retracted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_entry_technologies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"work_entry_id" uuid NOT NULL,
	"technology_id" uuid NOT NULL,
	"role" "tech_tag_role" DEFAULT 'primary' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" "claim_kind" NOT NULL,
	"subject" text NOT NULL,
	"statement" text NOT NULL,
	"quantities" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"verification" "verification" DEFAULT 'attested' NOT NULL,
	"confirmed_at" timestamp with time zone,
	"confirmed_by" uuid,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"kind" "evidence_kind" NOT NULL,
	"locator" text NOT NULL,
	"excerpt" text,
	"occurred_on" date,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conflict_claims" (
	"owner_id" uuid NOT NULL,
	"conflict_id" uuid NOT NULL,
	"claim_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conflict_claims_conflict_id_claim_id_pk" PRIMARY KEY("conflict_id","claim_id")
);
--> statement-breakpoint
CREATE TABLE "conflict_positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"conflict_id" uuid NOT NULL,
	"value" jsonb NOT NULL,
	"display" text NOT NULL,
	"evidence_id" uuid,
	"strength" numeric(4, 3) DEFAULT '0.500' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"kind" "conflict_kind" NOT NULL,
	"subject" text NOT NULL,
	"status" "conflict_status" DEFAULT 'open' NOT NULL,
	"blocks_emission" boolean DEFAULT true NOT NULL,
	"resolution_note" text,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile_versions" (
	"owner_id" uuid PRIMARY KEY NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"bumped_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "technology_scores" (
	"owner_id" uuid NOT NULL,
	"technology_id" uuid NOT NULL,
	"raw_usage_count" integer NOT NULL,
	"recency_score" numeric(6, 4) NOT NULL,
	"depth_score" numeric(6, 4) NOT NULL,
	"breadth_score" numeric(6, 4) NOT NULL,
	"composite_score" numeric(6, 4) NOT NULL,
	"first_used_on" date NOT NULL,
	"last_used_on" date NOT NULL,
	"months_active" integer NOT NULL,
	"project_count" integer NOT NULL,
	"verification" "verification" NOT NULL,
	"profile_version" integer NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "technology_scores_owner_id_technology_id_pk" PRIMARY KEY("owner_id","technology_id")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxonomy_aliases" ADD CONSTRAINT "taxonomy_aliases_node_id_taxonomy_nodes_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."taxonomy_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxonomy_edges" ADD CONSTRAINT "taxonomy_edges_from_node_id_taxonomy_nodes_id_fk" FOREIGN KEY ("from_node_id") REFERENCES "public"."taxonomy_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxonomy_edges" ADD CONSTRAINT "taxonomy_edges_to_node_id_taxonomy_nodes_id_fk" FOREIGN KEY ("to_node_id") REFERENCES "public"."taxonomy_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_epochs" ADD CONSTRAINT "project_epochs_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_epochs" ADD CONSTRAINT "project_epochs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_entries" ADD CONSTRAINT "work_entries_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_entries" ADD CONSTRAINT "work_entries_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_entries" ADD CONSTRAINT "work_entries_epoch_id_project_epochs_id_fk" FOREIGN KEY ("epoch_id") REFERENCES "public"."project_epochs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_entry_technologies" ADD CONSTRAINT "work_entry_technologies_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_entry_technologies" ADD CONSTRAINT "work_entry_technologies_work_entry_id_work_entries_id_fk" FOREIGN KEY ("work_entry_id") REFERENCES "public"."work_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_entry_technologies" ADD CONSTRAINT "work_entry_technologies_technology_id_taxonomy_nodes_id_fk" FOREIGN KEY ("technology_id") REFERENCES "public"."taxonomy_nodes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "claims" ADD CONSTRAINT "claims_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evidence" ADD CONSTRAINT "evidence_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict_claims" ADD CONSTRAINT "conflict_claims_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict_claims" ADD CONSTRAINT "conflict_claims_conflict_id_conflicts_id_fk" FOREIGN KEY ("conflict_id") REFERENCES "public"."conflicts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict_claims" ADD CONSTRAINT "conflict_claims_claim_id_claims_id_fk" FOREIGN KEY ("claim_id") REFERENCES "public"."claims"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict_positions" ADD CONSTRAINT "conflict_positions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict_positions" ADD CONSTRAINT "conflict_positions_conflict_id_conflicts_id_fk" FOREIGN KEY ("conflict_id") REFERENCES "public"."conflicts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflict_positions" ADD CONSTRAINT "conflict_positions_evidence_id_evidence_id_fk" FOREIGN KEY ("evidence_id") REFERENCES "public"."evidence"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflicts" ADD CONSTRAINT "conflicts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conflicts" ADD CONSTRAINT "conflicts_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_versions" ADD CONSTRAINT "profile_versions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technology_scores" ADD CONSTRAINT "technology_scores_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "technology_scores" ADD CONSTRAINT "technology_scores_technology_id_taxonomy_nodes_id_fk" FOREIGN KEY ("technology_id") REFERENCES "public"."taxonomy_nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_experiences_owner" ON "experiences" USING btree ("owner_id","started_on" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_taxonomy_aliases_normalized" ON "taxonomy_aliases" USING btree ("normalized");--> statement-breakpoint
CREATE INDEX "idx_taxonomy_aliases_node" ON "taxonomy_aliases" USING btree ("node_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_taxonomy_edges_triple" ON "taxonomy_edges" USING btree ("from_node_id","to_node_id","relation");--> statement-breakpoint
CREATE INDEX "idx_taxonomy_edges_from" ON "taxonomy_edges" USING btree ("from_node_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_taxonomy_nodes_slug" ON "taxonomy_nodes" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_project_epochs_project" ON "project_epochs" USING btree ("project_id","started_on" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_projects_owner_slug" ON "projects" USING btree ("owner_id","slug");--> statement-breakpoint
CREATE INDEX "idx_projects_owner" ON "projects" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_work_entries_owner_occurred" ON "work_entries" USING btree ("owner_id","occurred_on" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_work_entries_owner_hash" ON "work_entries" USING btree ("owner_id","content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_work_entry_technologies" ON "work_entry_technologies" USING btree ("work_entry_id","technology_id");--> statement-breakpoint
CREATE INDEX "idx_work_entry_technologies_tech" ON "work_entry_technologies" USING btree ("technology_id");--> statement-breakpoint
CREATE INDEX "idx_claims_owner" ON "claims" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_claims_emittable" ON "claims" USING btree ("owner_id","verification") WHERE "claims"."rejected_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_evidence_claim" ON "evidence" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "idx_evidence_owner" ON "evidence" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_conflict_claims_claim" ON "conflict_claims" USING btree ("claim_id");--> statement-breakpoint
CREATE INDEX "idx_conflict_positions_conflict" ON "conflict_positions" USING btree ("conflict_id","strength");--> statement-breakpoint
CREATE INDEX "idx_conflicts_owner_status" ON "conflicts" USING btree ("owner_id","status");