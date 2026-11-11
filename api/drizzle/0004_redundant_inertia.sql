ALTER TABLE "ai_jobs" ADD COLUMN "project_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD COLUMN "result_photo_id" uuid;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD COLUMN "reason" text;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_jobs" ADD CONSTRAINT "ai_jobs_result_photo_id_project_photos_id_fk" FOREIGN KEY ("result_photo_id") REFERENCES "public"."project_photos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_jobs_user_created_idx" ON "ai_jobs" USING btree ("user_id","created_at");