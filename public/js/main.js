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
    brandHidden.value = brandName

    // reset model
    modelSelect.innerHTML = '<option value="">-- กำลังโหลด... --</option>'
    modelSelect.disabled = true
    modelHidden.value = ''

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
        opt.dataset.value = m.base_value
        modelSelect.appendChild(opt)
      })
      modelSelect.disabled = false
    } catch (e) {
      modelSelect.innerHTML = '<option value="">-- เลือกรุ่นรถ (โหลดไม่ได้) --</option>'
      modelSelect.disabled = false
    }
  })

  modelSelect.addEventListener('change', function () {
    const opt = this.options[this.selectedIndex]
    modelHidden.value = opt?.text || ''
  })

  // Trigger ถ้ามีค่าอยู่แล้ว (กรณี validation error กลับมา)
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
    // Basic client-side check
    const brand = document.getElementById('car_brand_id')?.value
    const model = document.getElementById('car_model_id')?.value
    const year = document.getElementById('car_year')?.value
    const plate = document.getElementById('license_plate')?.value?.trim()
    const prov = document.getElementById('province')?.value
    const insType = document.querySelector('input[name="insurance_type"]:checked')

    if (!brand || !model || !year || !plate || !prov || !insType) {
      return // ให้ server validate แทน
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
