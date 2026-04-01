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
  carForm.addEventListener('submit', function (e) {
    const brand = document.getElementById('car_brand_id')?.value
    const model = document.getElementById('car_model_id')?.value
    const year = document.getElementById('car_year')?.value
    const plate = document.getElementById('license_plate')?.value?.trim()
    const prov = document.getElementById('province')?.value
    const insType = document.querySelector('input[name="insurance_type"]:checked')

    if (!brand || !model || !year || !plate || !prov || !insType) {
      return
    }
    submitBtn.classList.add('btn-loading')
    submitBtn.disabled = true
  })
}

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
