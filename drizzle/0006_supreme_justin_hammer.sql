CREATE TABLE IF NOT EXISTS "enrollment_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_id" uuid NOT NULL,
	"claim_hash" text NOT NULL,
	"rustdesk_id" text NOT NULL,
	"alias" text NOT NULL,
	"os_key" text,
	"rustdesk_version" text,
	"expires_at" timestamp NOT NULL,
	"finalized_at" timestamp,
	"device_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "enrollment_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"token_prefix" text NOT NULL,
	"kind" text NOT NULL,
	"install_if_missing" boolean DEFAULT true NOT NULL,
	"customer" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rustdesk_config" text,
	"use_count" integer DEFAULT 0 NOT NULL,
	"used_at" timestamp,
	"last_used_at" timestamp,
	"revoked_at" timestamp,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "enrollment_tokens_kind_check" CHECK ("enrollment_tokens"."kind" in ('single', 'permanent')),
	CONSTRAINT "enrollment_tokens_use_count_check" CHECK ("enrollment_tokens"."use_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN IF NOT EXISTS "enrollment_token_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment_claims" ADD CONSTRAINT "enrollment_claims_token_id_enrollment_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."enrollment_tokens"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment_claims" ADD CONSTRAINT "enrollment_claims_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "enrollment_tokens" ADD CONSTRAINT "enrollment_tokens_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enrollment_claims_hash_idx" ON "enrollment_claims" USING btree ("claim_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enrollment_claims_token_idx" ON "enrollment_claims" USING btree ("token_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "enrollment_tokens_hash_idx" ON "enrollment_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "enrollment_tokens_created_by_idx" ON "enrollment_tokens" USING btree ("created_by");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "devices" ADD CONSTRAINT "devices_enrollment_token_id_enrollment_tokens_id_fk" FOREIGN KEY ("enrollment_token_id") REFERENCES "public"."enrollment_tokens"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "devices_enrollment_token_rustdesk_id_idx" ON "devices" USING btree ("enrollment_token_id","rustdesk_id");