CREATE TABLE "device_group_members" (
	"group_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	CONSTRAINT "device_group_members_group_id_device_id_pk" PRIMARY KEY("group_id","device_id")
);
--> statement-breakpoint
CREATE TABLE "device_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_group_members" ADD CONSTRAINT "device_group_members_group_id_device_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."device_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_group_members" ADD CONSTRAINT "device_group_members_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_groups" ADD CONSTRAINT "device_groups_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "device_group_members_device_idx" ON "device_group_members" USING btree ("device_id");--> statement-breakpoint
CREATE INDEX "device_groups_user_idx" ON "device_groups" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "device_groups_user_name_idx" ON "device_groups" USING btree ("user_id","name");