/**
 * สร้าง Admin User เริ่มต้น
 * รัน: node setup_admin.js
 * Default: admin / admin1234
 */
'use strict'

const db = require('./db')
const bcrypt = require('bcryptjs')

async function main() {
  const username = process.argv[2] || 'admin'
  const password = process.argv[3] || 'admin1234'
  const fullName = process.argv[4] || 'Super Admin'

  console.log(`\nสร้าง Admin User: ${username}`)
  const hash = await bcrypt.hash(password, 10)

  await db.query(
    `INSERT INTO admin_users (username, password_hash, full_name, role)
     VALUES (?, ?, ?, 'superadmin')
     ON DUPLICATE KEY UPDATE password_hash = ?, full_name = ?`,
    [username, hash, fullName, hash, fullName]
  )

  console.log('✅ สร้างสำเร็จ!')
  console.log(`   Username : ${username}`)
  console.log(`   Password : ${password}`)
  console.log(`   URL      : http://localhost:3000/admin/login`)
  process.exit(0)
}

main().catch(err => { console.error(err); process.exit(1) })
