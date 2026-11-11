CREATE INDEX "ai_jobs_user_idx" ON "ai_jobs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_at_idx" ON "audit_log" USING btree ("at");--> statement-breakpoint
CREATE INDEX "audit_log_user_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "interactions_customer_idx" ON "interactions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "interactions_order_idx" ON "interactions" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_project_idx" ON "orders" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_invites_project_idx" ON "project_invites" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_members_user_idx" ON "project_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "projects_variant_idx" ON "projects" USING btree ("variant_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_chk" CHECK ("orders"."total" >= 0);--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_pages_min_chk" CHECK ("product_variants"."pages_min" >= 0);--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_base_price_chk" CHECK ("product_variants"."base_price" >= 0);--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_price_per_page_chk" CHECK ("product_variants"."price_per_page" >= 0);--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_min_dpi_chk" CHECK ("product_variants"."min_dpi" > 0);--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_expected_members_chk" CHECK ("projects"."expected_members" is null or "projects"."expected_members" >= 0);--> statement-breakpoint
ALTER TABLE "promo_codes" ADD CONSTRAINT "promo_codes_percent_chk" CHECK ("promo_codes"."discount_percent" between 0 and 100);