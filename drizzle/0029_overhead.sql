CREATE TABLE "overhead_expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"file_id" uuid,
	"vendor" text,
	"amount" numeric(14, 2),
	"spent_on" date,
	"category" text DEFAULT 'other' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "overhead_expenses" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "overhead_expenses" ADD CONSTRAINT "overhead_expenses_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overhead_expenses" ADD CONSTRAINT "overhead_expenses_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "overhead_expenses" ADD CONSTRAINT "overhead_expenses_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "overhead_entity_on" ON "overhead_expenses" USING btree ("entity_id","spent_on");