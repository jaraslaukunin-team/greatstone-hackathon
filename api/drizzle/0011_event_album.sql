ALTER TABLE "projects" ADD COLUMN "is_pool" boolean DEFAULT false NOT NULL;-->statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "source_project_id" uuid;-->statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_source_project_id_projects_id_fk" FOREIGN KEY ("source_project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;-->statement-breakpoint
CREATE UNIQUE INDEX "projects_owner_source_uq" ON "projects" USING btree ("owner_id","source_project_id") WHERE "source_project_id" IS NOT NULL;-->statement-breakpoint
ALTER TABLE "project_photos" ADD COLUMN "source_photo_id" uuid;
