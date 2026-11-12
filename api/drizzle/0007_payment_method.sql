CREATE TYPE "public"."payment_method" AS ENUM('card', 'erip', 'courier');
ALTER TABLE "orders" ADD COLUMN "payment_method" "payment_method" NOT NULL DEFAULT 'card';
ALTER TABLE "orders" ADD COLUMN "erip_number" text;
