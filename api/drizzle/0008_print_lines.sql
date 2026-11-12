CREATE TYPE "public"."product_line" AS ENUM('photo', 'digital');
ALTER TABLE "products" ADD COLUMN "line" "product_line";
