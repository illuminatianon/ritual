CREATE TABLE "style_import_ledger" (
  "source_fingerprint" text NOT NULL,
  "legacy_style_id" text NOT NULL,
  "style_id" uuid NOT NULL REFERENCES "styles"("id") ON DELETE cascade,
  "imported_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("source_fingerprint", "legacy_style_id")
);
