'use strict'

const cron = require('node-cron')
const db = require('../db')
const { sendRenewalReminder } = require('./emailService')
const { pushMessage, textMsg } = require('./lineBot')

/**
 * ส่ง renewal reminder ให้ลูกค้าที่กรมธรรม์ใกล้หมดอายุ
 * เช็คทุกวันเวลา 09:00
 */
function startRenewalReminderJob() {
  // รัน cron ทุกวัน 09:00 น.
  cron.schedule('0 9 * * *', async () => {
    console.log('[RenewalReminder] กำลังตรวจสอบกรมธรรม์ใกล้หมดอายุ...')
    await checkAndSendReminders()
  }, { timezone: 'Asia/Bangkok' })

  console.log('[RenewalReminder] Cron job ตั้งค่าแล้ว (ทุกวัน 09:00 น.)')
}

async function checkAndSendReminders() {
  const REMIND_DAYS = [30, 7]  // แจ้งเตือนตอนเหลือ 30 วัน และ 7 วัน

  for (const daysLeft of REMIND_DAYS) {
    try {
      // หา quotes ที่จะหมดอายุใน daysLeft วัน (±1 วัน)
      const [rows] = await db.query(`
        SELECT q.*,
               cl.full_name, cl.phone, cl.email, cl.preferred_contact,
               ls.line_user_id
        FROM quotes q
        LEFT JOIN customer_leads cl ON cl.quote_id = q.id
        LEFT JOIN line_sessions ls ON ls.display_name IS NOT NULL
          AND cl.phone IS NOT NULL
        WHERE q.expires_at IS NOT NULL
          AND DATE(q.expires_at) = DATE_ADD(CURDATE(), INTERVAL ? DAY)
          AND q.status NOT IN ('cancelled')
          AND (cl.id IS NOT NULL)
      `, [daysLeft])

      for (const row of rows) {
        const lead = {
          full_name: row.full_name,
          phone: row.phone,
          email: row.email,
          preferred_contact: row.preferred_contact
        }

        // ส่ง email ถ้ามี email
        if (row.email) {
          await sendRenewalReminder(row, lead, daysLeft).catch(err => {
            console.error('[RenewalReminder] Email error:', err.message)
          })
        }

        // ส่ง LINE ถ้ามี line_user_id
        if (row.line_user_id) {
          const msg = daysLeft <= 7
            ? `🚨 ประกันรถ ${row.license_plate} (${row.car_brand} ${row.car_model}) จะหมดอายุใน ${daysLeft} วัน!\n\n` +
              `กรุณาต่ออายุโดยเร็วที่สุดเพื่อความต่อเนื่องในการคุ้มครอง`
            : `⚠️ แจ้งเตือน: ประกันรถ ${row.license_plate} จะหมดอายุใน ${daysLeft} วัน\n\n` +
              `พิมพ์ "ต่ออายุประกัน" หรือโทรหาเจ้าหน้าที่เพื่อรับข้อมูล`
          await pushMessage(row.line_user_id, [textMsg(msg)]).catch(err => {
            console.error('[RenewalReminder] LINE error:', err.message)
          })
        }

        console.log(`[RenewalReminder] ส่งแจ้งเตือนให้ ${row.full_name || row.license_plate} (${daysLeft} วัน)`)
      }

      if (rows.length > 0) {
        console.log(`[RenewalReminder] ส่งแจ้งเตือน ${rows.length} รายการ (${daysLeft} วัน)`)
      }
    } catch (err) {
      console.error(`[RenewalReminder] Error for ${daysLeft} days:`, err.message)
    }
  }
}

module.exports = { startRenewalReminderJob, checkAndSendReminders }
