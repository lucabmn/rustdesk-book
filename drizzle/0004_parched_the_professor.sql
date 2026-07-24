CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"contact" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_name_idx" ON "customers" USING btree ("name");--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "devices_customer_id_idx" ON "devices" USING btree ("customer_id");--> statement-breakpoint
-- Data backfill: promote existing free-text device.customer values into the
-- new customers table (one row per distinct trimmed name), then link devices.
INSERT INTO "customers" ("name")
SELECT DISTINCT btrim("customer")
FROM "devices"
WHERE "customer" IS NOT NULL AND btrim("customer") <> ''
ON CONFLICT ("name") DO NOTHING;--> statement-breakpoint
UPDATE "devices" AS d
SET "customer_id" = c."id"
FROM "customers" AS c
WHERE d."customer" IS NOT NULL AND btrim(d."customer") = c."name";