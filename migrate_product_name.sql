-- Migration: เพิ่ม product_name ใน scraped_packages
-- เพื่อรองรับหลายแพ็กเกจต่อบริษัทต่อชั้นประกัน

USE insurance_db;

-- เพิ่มคอลัมน์ product_name
ALTER TABLE scraped_packages
  ADD COLUMN IF NOT EXISTS product_name VARCHAR(500) DEFAULT NULL AFTER company_name;

-- สร้าง index สำรองสำหรับ FK (model_id) ก่อน
-- เพราะ uniq_package เป็น backing index ของ FK อยู่
ALTER TABLE scraped_packages
  ADD INDEX IF NOT EXISTS idx_model_id (model_id);

-- หา FK constraint name แล้ว drop
SET @fk = (
  SELECT CONSTRAINT_NAME
  FROM information_schema.KEY_COLUMN_USAGE
  WHERE TABLE_SCHEMA = 'insurance_db'
    AND TABLE_NAME = 'scraped_packages'
    AND COLUMN_NAME = 'model_id'
    AND REFERENCED_TABLE_NAME = 'scraped_models'
  LIMIT 1
);

SET @sql = CONCAT('ALTER TABLE scraped_packages DROP FOREIGN KEY ', @fk);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ตอนนี้ drop unique key เดิมได้แล้ว
ALTER TABLE scraped_packages
  DROP INDEX uniq_package;

-- สร้าง unique key ใหม่รวม product_name
ALTER TABLE scraped_packages
  ADD UNIQUE KEY uniq_package (model_id, car_year, insurance_class, company_name, product_name);

-- เพิ่ม FK กลับ
ALTER TABLE scraped_packages
  ADD CONSTRAINT fk_pkg_model FOREIGN KEY (model_id) REFERENCES scraped_models(id);

-- ลบ index สำรองที่ไม่ต้องการแล้ว (FK ใหม่สร้างของตัวเองแล้ว)
ALTER TABLE scraped_packages
  DROP INDEX IF EXISTS idx_model_id;
