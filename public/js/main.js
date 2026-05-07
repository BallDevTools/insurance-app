'use strict'

// =============================================
// โหลดรุ่นรถตามยี่ห้อที่เลือก (AJAX)
// =============================================
const brandSelect = document.getElementById('car_brand_id')
const modelSelect = document.getElementById('car_model_id')
const brandHidden = document.getElementById('car_brand')
const modelHidden = document.getElementById('car_model')

if (brandSelect && modelSelect) {
  brandSelect.addEventListener('change', async function () {
    const brandId = this.value
    const brandName = this.options[this.selectedIndex]?.text || ''
    if (brandHidden) brandHidden.value = brandName

    // reset model
    modelSelect.innerHTML = '<option value="">-- กำลังโหลด... --</option>'
    modelSelect.disabled = true
    if (modelHidden) modelHidden.value = ''

    if (!brandId) {
      modelSelect.innerHTML = '<option value="">-- เลือกรุ่นรถ --</option>'
      modelSelect.disabled = false
      return
    }

    try {
      const res = await fetch(`/api/models?brand_id=${brandId}`)
      const models = await res.json()
      modelSelect.innerHTML = '<option value="">-- เลือกรุ่นรถ --</option>'
      models.forEach(m => {
        const opt = document.createElement('option')
        opt.value = m.id
        opt.textContent = m.name
        modelSelect.appendChild(opt)
      })
      // re-select ถ้ามีค่าเดิม (กรณี validation error หรือ compare page)
      const defaultId = modelSelect.dataset.defaultModelId
      if (defaultId) {
        modelSelect.value = defaultId
        if (modelSelect.value && modelHidden) {
          modelHidden.value = modelSelect.options[modelSelect.selectedIndex]?.text || ''
        }
      }
      modelSelect.disabled = false
    } catch (e) {
      modelSelect.innerHTML = '<option value="">-- เลือกรุ่นรถ (โหลดไม่ได้) --</option>'
      modelSelect.disabled = false
    }
  })

  modelSelect.addEventListener('change', function () {
    const opt = this.options[this.selectedIndex]
    if (modelHidden) modelHidden.value = opt?.text || ''
  })

  // Trigger ถ้ามีค่าอยู่แล้ว (กรณี validation error กลับมา หรือ compare page)
  if (brandSelect.value) {
    brandSelect.dispatchEvent(new Event('change'))
  }
}

// =============================================
// ไฮไลต์ insurance card ที่เลือก
// =============================================
const insuranceInputs = document.querySelectorAll('input[name="insurance_type"]')
insuranceInputs.forEach(input => {
  input.addEventListener('change', () => {
    document.querySelectorAll('.insurance-card-inner').forEach(card => {
      card.style.removeProperty('border-color')
    })
  })
})

// =============================================
// Submit button loading state
// =============================================
const carForm = document.getElementById('carForm')
const submitBtn = document.getElementById('submitBtn')
if (carForm && submitBtn) {
  carForm.addEventListener('submit', function () {
    const brand   = document.getElementById('car_brand_id')?.value
    const model   = document.getElementById('car_model_id')?.value
    const year    = document.getElementById('car_year')?.value
    const insType = document.querySelector('input[name="insurance_type"]:checked')
    if (!brand || !model || !year || !insType) return
    submitBtn.classList.add('btn-loading')
    submitBtn.disabled = true
  })
}

// =============================================
// Partial Lead Capture
// =============================================
;(function () {
  const partialTokenField = document.getElementById('partial_token')
  if (!partialTokenField) return

  // สร้างหรือดึง token สำหรับ session นี้
  let formToken = sessionStorage.getItem('ins_form_token')
  if (!formToken) {
    formToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
      .map(b => b.toString(16).padStart(2, '0')).join('')
    sessionStorage.setItem('ins_form_token', formToken)
  }
  partialTokenField.value = formToken

  let coldTimer = null
  let warmTimer = null

  function getFormData() {
    return {
      model_id:       document.getElementById('car_model_id')?.value,
      car_year:       document.getElementById('car_year')?.value,
      insurance_type: document.querySelector('input[name="insurance_type"]:checked')?.value,
      name:           document.getElementById('name')?.value || '',
      phone:          document.getElementById('phone')?.value || ''
    }
  }

  function isReadyForCold(d) {
    return d.model_id && d.car_year && d.insurance_type
  }

  function isReadyForWarm(d) {
    return isReadyForCold(d) && (d.name.trim().length >= 2 || /^0[0-9]{8,9}$/.test(d.phone.replace(/[\s-]/g, '')))
  }

  function sendPartial(stage) {
    const d = getFormData()
    if (!isReadyForCold(d)) return
    const body = new URLSearchParams({
      partial_token:  formToken,
      model_id:       d.model_id,
      car_year:       d.car_year,
      insurance_type: d.insurance_type,
      name:           d.name,
      phone:          d.phone,
      funnel_stage:   stage
    })
    fetch('/partial-lead', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
      .catch(() => {})
  }

  function scheduleCold() {
    clearTimeout(coldTimer)
    coldTimer = setTimeout(() => {
      const d = getFormData()
      if (isReadyForWarm(d)) sendPartial('warm')
      else if (isReadyForCold(d)) sendPartial('cold')
    }, 1500)
  }

  function scheduleWarm() {
    clearTimeout(warmTimer)
    warmTimer = setTimeout(() => {
      const d = getFormData()
      if (isReadyForWarm(d)) sendPartial('warm')
    }, 1500)
  }

  // Watch core fields (cold trigger)
  document.getElementById('car_model_id')?.addEventListener('change', scheduleCold)
  document.getElementById('car_year')?.addEventListener('change', scheduleCold)
  document.querySelectorAll('input[name="insurance_type"]').forEach(r => r.addEventListener('change', scheduleCold))

  // Watch contact fields (warm trigger)
  document.getElementById('name')?.addEventListener('blur', scheduleWarm)
  document.getElementById('phone')?.addEventListener('blur', scheduleWarm)
})();

// =============================================
// Concierge Panel
// =============================================
;(function () {
  const toggle  = document.getElementById('conciergeToggle')
  const panel   = document.getElementById('conciergePanel')
  const submit  = document.getElementById('conciergeSubmit')
  const success = document.getElementById('conciergeSuccess')
  const phoneIn = document.getElementById('c_phone')
  const phoneErr= document.getElementById('c_phone_err')
  if (!toggle || !panel) return

  toggle.addEventListener('click', function () {
    const open = panel.style.display !== 'none'
    panel.style.display = open ? 'none' : 'block'
    toggle.textContent = open ? '📞 ไม่อยากกรอกเอง? ให้เราโทรกลับ' : '✕ ปิด'
  })

  submit.addEventListener('click', async function () {
    const phone = phoneIn.value.trim().replace(/[\s-]/g, '')
    if (!/^0[0-9]{8,9}$/.test(phone)) {
      phoneErr.style.display = 'block'
      phoneIn.focus()
      return
    }
    phoneErr.style.display = 'none'
    submit.disabled = true
    submit.textContent = 'กำลังส่ง...'

    const body = new URLSearchParams({
      phone,
      name: document.getElementById('c_name')?.value || ''
    })
    try {
      const res  = await fetch('/concierge', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body })
      const data = await res.json()
      if (data.ok) {
        submit.style.display   = 'none'
        success.style.display  = 'block'
        toggle.style.display   = 'none'
      } else {
        phoneErr.textContent   = data.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่'
        phoneErr.style.display = 'block'
        submit.disabled        = false
        submit.textContent     = 'ให้เราโทรกลับ →'
      }
    } catch {
      phoneErr.textContent   = 'เกิดข้อผิดพลาด กรุณาลองใหม่'
      phoneErr.style.display = 'block'
      submit.disabled        = false
      submit.textContent     = 'ให้เราโทรกลับ →'
    }
  })

  phoneIn?.addEventListener('input', function () {
    this.value = this.value.replace(/[^0-9\s\-]/g, '')
    phoneErr.style.display = 'none'
  })
})();

// =============================================
// Format license plate input (auto uppercase)
// =============================================
const plateInput = document.getElementById('license_plate')
if (plateInput) {
  plateInput.addEventListener('input', function () {
    const pos = this.selectionStart
    this.value = this.value.toUpperCase()
    this.setSelectionRange(pos, pos)
  })
}

// =============================================
// Phone number formatting
// =============================================
const phoneInput = document.getElementById('phone')
if (phoneInput) {
  phoneInput.addEventListener('input', function () {
    this.value = this.value.replace(/[^0-9\s\-]/g, '')
  })
}

// =============================================
// Upload Documents
// =============================================
async function uploadDocs(quoteNumber) {
  const reg = document.getElementById('doc_registration')
  const id  = document.getElementById('doc_id_card')
  const msg = document.getElementById('upload-msg')
  if (!reg || !id) return

  const form = new FormData()
  if (reg.files[0]) form.append('registration', reg.files[0])
  if (id.files[0])  form.append('id_card', id.files[0])
  if (!reg.files[0] && !id.files[0]) {
    msg.textContent = 'กรุณาเลือกไฟล์ก่อน'
    msg.className = 'upload-msg err'
    return
  }

  msg.textContent = 'กำลังอัปโหลด...'
  msg.className = 'upload-msg'
  try {
    const res = await fetch(`/upload/${quoteNumber}`, { method: 'POST', body: form })
    const data = await res.json()
    if (data.ok) {
      msg.textContent = `✓ อัปโหลดสำเร็จ ${data.files.length} ไฟล์`
      msg.className = 'upload-msg ok'
      reg.value = ''
      id.value = ''
    } else {
      msg.textContent = 'อัปโหลดไม่สำเร็จ: ' + (data.message || 'unknown error')
      msg.className = 'upload-msg err'
    }
  } catch {
    msg.textContent = 'เกิดข้อผิดพลาด กรุณาลองใหม่'
    msg.className = 'upload-msg err'
  }
}
