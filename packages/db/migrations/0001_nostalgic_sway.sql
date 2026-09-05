CREATE TABLE "llm_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"feature" text NOT NULL,
	"prompt_tokens" integer NOT NULL,
	"completion_tokens" integer NOT NULL,
	"cache_hit_tokens" integer NOT NULL,
	"cache_miss_tokens" integer NOT NULL,
	"estimated_cost_usd" numeric(12, 6) NOT NULL,
	"latency_ms" integer,
	"cassette_mode" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "llm_calls" ADD CONSTRAINT "llm_calls_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_llm_calls_owner_created" ON "llm_calls" USING btree ("owner_id","created_at" DESC NULLS LAST);