ALTER TABLE "projects" ADD COLUMN "stage_states" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "sub_stages" jsonb DEFAULT '{}'::jsonb NOT NULL;