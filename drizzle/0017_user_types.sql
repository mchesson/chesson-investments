ALTER TYPE "public"."user_role" ADD VALUE 'admin';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "guest_type" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "guest_extras" text[];