-- =====================================================
-- companies table + new fields on scraped_packages
-- =====================================================

CREATE TABLE IF NOT EXISTS companies (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  name       VARCHAR(200) NOT NULL UNIQUE,
  short_name VARCHAR(50)  NULL,
  logo_url   VARCHAR(500) NULL,
  is_active  TINYINT(1)  NOT NULL DEFAULT 1,
  created_at TIMESTAMP   NOT NULL DEFAULT current_timestamp()
);

-- Populate from existing scraped data
INSERT IGNORE INTO companies (name)
SELECT DISTINCT company_name
FROM scraped_packages
WHERE company_name IS NOT NULL
ORDER BY company_name;

-- New columns on scraped_packages
ALTER TABLE scraped_packages
  ADD COLUMN IF NOT EXISTS repair_type VARCHAR(20) NULL
    COMMENT 'garage = อู่ทั่วไป, authorized = ซ่อมศูนย์',
  ADD COLUMN IF NOT EXISTS has_flood TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS company_id INT NULL;

-- Link company_id by name
UPDATE scraped_packages sp
INNER JOIN companies c ON c.name = sp.company_name
SET sp.company_id = c.id
WHERE sp.company_id IS NULL;

ALTER TABLE scraped_packages
  ADD INDEX IF NOT EXISTS idx_company_id (company_id),
  ADD INDEX IF NOT EXISTS idx_repair_type (repair_type),
  ADD INDEX IF NOT EXISTS idx_has_flood   (has_flood);
