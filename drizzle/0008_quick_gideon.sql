ALTER TABLE "audit_log" ADD COLUMN "actor_name" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "actor_email" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "target_type" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "target_id" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "target_label" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "ip_address" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "user_agent" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
CREATE INDEX "audit_log_target_idx" ON "audit_log" USING btree ("target_type","target_id");--> statement-breakpoint
-- Backfill: every pre-existing entry targeted a device, including the ones
-- whose device_id was already nulled by a delete. Keep the assignment where
-- there still is one, and snapshot the labels that still resolve.
UPDATE "audit_log" SET "target_type" = 'device', "target_id" = "device_id"::text;--> statement-breakpoint
UPDATE "audit_log" SET "target_label" = "devices"."alias" FROM "devices" WHERE "audit_log"."device_id" = "devices"."id";--> statement-breakpoint
UPDATE "audit_log" SET "actor_name" = "user"."name", "actor_email" = "user"."email" FROM "user" WHERE "audit_log"."user_id" = "user"."id";