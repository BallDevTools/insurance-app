-- อัพเดต logo_url บริษัทประกัน จากรูปที่ scrape มาจาก insure.724.co.th
-- รัน: node run_migrations.js  หรือรันตรงบน MySQL

UPDATE companies SET logo_url = 'https://insure.724.co.th/uploads/partner-4.png'
WHERE name LIKE '%วิริยะ%';

UPDATE companies SET logo_url = 'https://insure.724.co.th/uploads/partner-6.png'
WHERE name LIKE '%LMG%' OR name LIKE '%แอลเอ็มจี%';

UPDATE companies SET logo_url = 'https://insure.724.co.th/uploads/partner-7.png'
WHERE name LIKE '%ไทยวิวัฒน%';

UPDATE companies SET logo_url = 'https://insure.724.co.th/uploads/partner-9.png'
WHERE name LIKE '%กรุงเทพ%';

UPDATE companies SET logo_url = 'https://insure.724.co.th/uploads/partner-10.png'
WHERE name LIKE '%เมืองไทย%';

UPDATE companies SET logo_url = 'https://insure.724.co.th/uploads/partner-12.png'
WHERE name LIKE '%เทเวศ%';

-- ⚠️ ทิพย: logo วงกลมเขียว/ภูเขาเหลือง — ตรวจสอบก่อนว่าถูกต้องไหม
UPDATE companies SET logo_url = 'https://insure.724.co.th/uploads/partner-16.png'
WHERE name LIKE '%ทิพย%';

UPDATE companies SET logo_url = 'https://www.mrkumka.com/wp-content/themes/mrkumka_mint/assets/img_new/partner/ergo/logo_ergo.webp'
WHERE name LIKE '%ERGO%' OR name LIKE '%เออร์โก%';
