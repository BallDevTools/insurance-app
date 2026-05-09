-- Fix short_name ให้ถูกต้องตามมาตรฐาน
UPDATE companies SET short_name = 'TIP'  WHERE name LIKE '%ทิพย%';
UPDATE companies SET short_name = 'VIB'  WHERE name LIKE '%วิริยะ%';
UPDATE companies SET short_name = 'BKI'  WHERE name LIKE '%กรุงเทพ%';
UPDATE companies SET short_name = 'MTI'  WHERE name LIKE '%เมืองไทย%';
UPDATE companies SET short_name = 'TVI'  WHERE name LIKE '%ไทยวิวัฒน%';
UPDATE companies SET short_name = 'DVI'  WHERE name LIKE '%เทเวศ%';
UPDATE companies SET short_name = 'TKI'  WHERE name LIKE '%โตเกียว%' OR name LIKE '%คุ้มภัย%';
UPDATE companies SET short_name = 'AZAY' WHERE name LIKE '%อลิอันซ%' OR name LIKE '%Allianz%';
UPDATE companies SET short_name = 'ERGO' WHERE name LIKE '%ERGO%' OR name LIKE '%เออร์โก%';
UPDATE companies SET short_name = 'LMG'  WHERE name LIKE '%LMG%' OR name LIKE '%แอลเอ็มจี%';
UPDATE companies SET short_name = 'AXA'  WHERE name LIKE '%AXA%' OR name LIKE '%แอกซ่า%';
UPDATE companies SET short_name = 'MSIG' WHERE name LIKE '%MSIG%' OR name LIKE '%เอ็มเอสไอจี%';
UPDATE companies SET short_name = 'DHIPAYA' WHERE name LIKE '%ธิปไตย%';
UPDATE companies SET short_name = 'NKI'  WHERE name LIKE '%นวกิจ%';
UPDATE companies SET short_name = 'SEI'  WHERE name LIKE '%สินมั่นคง%';

-- ปิด duplicate ที่ชื่อไม่ครบ (ชื่อสั้นกว่า = scraper noise)
UPDATE companies SET is_active = 0
WHERE name IN ('ERGO', 'LMG', 'กรุงเทพ', 'เมืองไทย', 'ทิพย', 'วิริยะ')
  AND LENGTH(name) < 6;
