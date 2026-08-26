CREATE TABLE "styles" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "name" text NOT NULL,
  "current_version_id" uuid,
  "next_version_number" integer DEFAULT 2 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "style_versions" (
  "id" uuid PRIMARY KEY NOT NULL,
  "style_id" uuid NOT NULL,
  "version_number" integer NOT NULL,
  "positive_prompt" text NOT NULL,
  "negative_prompt" text NOT NULL,
  "metadata_json" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "style_versions_style_version_number_unique" UNIQUE("style_id", "version_number")
);
--> statement-breakpoint
ALTER TABLE "styles" ADD CONSTRAINT "styles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "style_versions" ADD CONSTRAINT "style_versions_style_id_styles_id_fk" FOREIGN KEY ("style_id") REFERENCES "public"."styles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "styles" ADD CONSTRAINT "styles_current_version_id_style_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "public"."style_versions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "styles_user_deleted_updated_idx" ON "styles" USING btree ("user_id", "deleted_at", "updated_at");
--> statement-breakpoint
CREATE INDEX "style_versions_style_version_idx" ON "style_versions" USING btree ("style_id", "version_number" DESC);
