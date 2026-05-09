-- Prevent duplicate scraped_packages by using confirm_url as unique key
-- confirm_url is extracted from coverage JSON (always unique per insurance product)
-- Run once on local and production DB

-- Drop old composite key (model_id, car_year, insurance_class, company_name, product_name)
-- that was insufficient — same package scraped under different model_id would still insert
ALTER TABLE scraped_packages DROP INDEX IF EXISTS uniq_package;

-- Add confirm_url as a stored generated column (auto-computed from coverage JSON)
ALTER TABLE scraped_packages
  ADD COLUMN IF NOT EXISTS confirm_url VARCHAR(512)
    GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(coverage, '$.confirm_url'))) STORED;

-- Add unique constraint — ON DUPLICATE KEY UPDATE in scraper/db.js now works correctly
ALTER TABLE scraped_packages
  ADD UNIQUE INDEX IF NOT EXISTS uq_confirm_url (confirm_url);
