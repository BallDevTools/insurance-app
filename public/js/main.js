'use strict'

// =============================================
// Mobile nav burger
// =============================================
;(function () {
  var burger = document.getElementById('navBurger')
  var nav    = burger && burger.closest('.nav')
  if (!burger || !nav) return
  burger.addEventListener('click', function () {
    nav.classList.toggle('nav--open')
  })
  // Close when clicking a link
  nav.querySelectorAll('.nav__links a').forEach(function (a) {
    a.addEventListener('click', function () { nav.classList.remove('nav--open') })
  })
})();

// =============================================
// FAQ accordion
// =============================================
document.querySelectorAll('.faq-item__q').forEach(function(btn) {
  btn.addEventListener('click', function() {
    var item = this.closest('.faq-item')
    var isOpen = item.classList.contains('is-open')
    document.querySelectorAll('.faq-item').forEach(function(i) { i.classList.remove('is-open') })
    if (!isOpen) item.classList.add('is-open')
  })
})

// =============================================
// Class card selection — sync with hidden radio
// =============================================
document.querySelectorAll('.class-card').forEach(function(card) {
  card.addEventListener('click', function() {
    document.querySelectorAll('.class-card').forEach(function(c) { c.classList.remove('is-active') })
    this.classList.add('is-active')
    var radio = this.querySelector('input[type="radio"]')
    if (radio) radio.dispatchEvent(new Event('change', { bubbles: true }))
  })
})

// =============================================
// Custom Select (cs-wrap)
// =============================================
function initCS(wrap) {
  if (!wrap) return null
  const trigger = wrap.querySelector('.cs-trigger')
  const valEl   = wrap.querySelector('.cs-val')
  const search  = wrap.querySelector('.cs-search')
  const list    = wrap.querySelector('.cs-list')

  function open() {
    if (wrap.classList.contains('cs-wrap--disabled')) return
    document.querySelectorAll('.cs-wrap--open').forEach(w => { if (w !== wrap) closeWrap(w) })
    wrap.classList.add('cs-wrap--open')
    if (search) { search.value = ''; filterItems(''); search.focus() }
  }
  function closeWrap(w) { w.classList.remove('cs-wrap--open') }
  function close() { closeWrap(wrap) }

  function pick(li) {
    const val   = li.dataset.value || ''
    const label = li.dataset.label || li.textContent.trim()
    valEl.textContent = val ? label : li.textContent.trim()
    valEl.classList.toggle('cs-val--ph', !val)
    list.querySelectorAll('.cs-item--active').forEach(i => i.classList.remove('cs-item--active'))
    if (val) li.classList.add('cs-item--active')
    close()
    wrap.dispatchEvent(new CustomEvent('cs:pick', { detail: { value: val, label: val ? label : '' }, bubbles: true }))
  }

  function filterItems(q) {
    const qq = q.toLowerCase().trim()
    let visible = 0
    list.querySelectorAll('.cs-item:not(.cs-item--ph)').forEach(li => {
      const catHidden = li.dataset.catHidden === '1'
      const match = !qq || li.textContent.toLowerCase().includes(qq)
      li.hidden = catHidden || !match
      if (!catHidden && match) visible++
    })
    let empty = list.querySelector('.cs-item--empty')
    if (!visible && qq) {
      if (!empty) { empty = document.createElement('li'); empty.className = 'cs-item cs-item--empty'; list.appendChild(empty) }
      empty.textContent = `ไม่พบ "${q}"`
      empty.hidden = false
    } else if (empty) { empty.hidden = true }
  }

  trigger.addEventListener('click', () => wrap.classList.contains('cs-wrap--open') ? close() : open())
  trigger.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); wrap.classList.contains('cs-wrap--open') ? close() : open() } })
  list.addEventListener('click', e => { const li = e.target.closest('.cs-item'); if (li && !li.classList.contains('cs-item--empty')) pick(li) })
  if (search) {
    search.addEventListener('input', () => filterItems(search.value))
    search.addEventListener('keydown', e => { if (e.key === 'Escape') close() })
  }
  document.addEventListener('click', e => { if (!wrap.contains(e.target)) close() }, true)

  return {
    setItems(items, ph) {
      list.innerHTML = `<li class="cs-item cs-item--ph" data-value="">${ph}</li>`
      items.forEach(m => {
        const li = document.createElement('li')
        li.className = 'cs-item'; li.dataset.value = m.id; li.dataset.label = m.name; li.textContent = m.name
        list.appendChild(li)
      })
    },
    reset(ph) {
      valEl.textContent = ph; valEl.classList.add('cs-val--ph')
      list.querySelectorAll('.cs-item--active').forEach(i => i.classList.remove('cs-item--active'))
    },
    selectById(id) {
      const li = list.querySelector(`.cs-item[data-value="${id}"]`)
      if (li) pick(li)
    },
    disable() { wrap.classList.add('cs-wrap--disabled') },
    enable()  { wrap.classList.remove('cs-wrap--disabled') },
  }
}

// Brand / Model wiring
;(function () {
  const brandWrap   = document.getElementById('cs-brand')
  const modelWrap   = document.getElementById('cs-model')
  if (!brandWrap || !modelWrap) return

  const brandIdIn  = document.getElementById('car_brand_id')
  const brandNameIn= document.getElementById('car_brand')
  const modelIdIn  = document.getElementById('car_model_id')
  const modelNameIn= document.getElementById('car_model')

  const csB = initCS(brandWrap)
  const csM = initCS(modelWrap)

  brandWrap.addEventListener('cs:pick', async function (e) {
    const brandId = e.detail.value
    brandIdIn.value  = brandId
    brandNameIn.value= e.detail.label

    csM.reset('กำลังโหลด...')
    csM.disable()
    modelIdIn.value = ''; modelNameIn.value = ''

    if (!brandId) { csM.reset('เลือกรุ่นรถ'); return }

    try {
      const res    = await fetch(`/api/models?brand_id=${brandId}`)
      const models = await res.json()
      const toShow = window.__catFilter ? models.filter(m => window.__catFilter(m.name)) : models
      csM.setItems(toShow.length ? toShow : models, 'เลือกรุ่นรถ')
      csM.enable()
      const initId = modelWrap.dataset.initId
      if (initId) csM.selectById(initId)
    } catch {
      csM.reset('โหลดไม่ได้'); csM.enable()
    }
  })

  modelWrap.addEventListener('cs:pick', function (e) {
    modelIdIn.value  = e.detail.value
    modelNameIn.value= e.detail.label
  })

  // restore state on validation error return
  const initBrandId = brandWrap.dataset.initId
  if (initBrandId) {
    brandIdIn.value = initBrandId
    brandWrap.dispatchEvent(new CustomEvent('cs:pick', {
      detail: { value: initBrandId, label: brandWrap.dataset.initName || '' }, bubbles: true
    }))
  }
})()

// Year custom select
;(function () {
  const yearWrap = document.getElementById('cs-year')
  const yearIn   = document.getElementById('car_year')
  if (!yearWrap || !yearIn) return
  const csY = initCS(yearWrap)
  yearWrap.addEventListener('cs:pick', function (e) {
    yearIn.value = e.detail.value
  })
})()

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
    const brand   = document.getElementById('car_brand_id')?.value
    const model   = document.getElementById('car_model_id')?.value
    const year    = document.getElementById('car_year')?.value
    const insType = document.querySelector('input[name="insurance_type"]:checked')

    let hasError = false

    function setErr(id, msg) {
      const field = document.getElementById(id)?.closest('.field')
      if (!field) return
      let span = field.querySelector('.field-error')
      if (!span) { span = document.createElement('span'); span.className = 'field-error'; field.appendChild(span) }
      span.textContent = msg
      field.querySelector('.cs-wrap')?.classList.add('cs-wrap--error')
      hasError = true
    }
    function clearErr(id) {
      const field = document.getElementById(id)?.closest('.field')
      if (!field) return
      const span = field.querySelector('.field-error')
      if (span) span.textContent = ''
      field.querySelector('.cs-wrap')?.classList.remove('cs-wrap--error')
    }

    clearErr('car_brand_id')
    clearErr('car_model_id')
    clearErr('car_year')

    if (!brand) setErr('car_brand_id', 'กรุณาเลือกยี่ห้อรถ')
    if (!model) setErr('car_model_id', 'กรุณาเลือกรุ่นรถ')
    if (!year)  setErr('car_year', 'กรุณาเลือกปีผลิต')

    if (hasError) { e.preventDefault(); return }

    submitBtn.classList.add('btn-loading')
    submitBtn.disabled = true
  })

  window.addEventListener('pageshow', function (e) {
    if (e.persisted) {
      submitBtn.classList.remove('btn-loading')
      submitBtn.disabled = false
    }
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

  const toggleOrigHTML = toggle.innerHTML
  toggle.addEventListener('click', function () {
    const open = panel.style.display !== 'none'
    panel.style.display = open ? 'none' : 'block'
    toggle.innerHTML = open ? toggleOrigHTML : '✕ ปิด'
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
// Compare page — custom selects
// =============================================
;(function () {
  const brandWrap = document.getElementById('cs-cmp-brand')
  const modelWrap = document.getElementById('cs-cmp-model')
  const yearWrap  = document.getElementById('cs-cmp-year')
  const classWrap = document.getElementById('cs-cmp-class')
  if (!brandWrap) return

  const brandIn = document.getElementById('cmp_brand_id')
  const modelIn = document.getElementById('cmp_model_id')
  const yearIn  = document.getElementById('cmp_year')
  const classIn = document.getElementById('cmp_insurance_class')

  const csB = initCS(brandWrap)
  const csM = initCS(modelWrap)
  initCS(yearWrap)
  initCS(classWrap)

  brandWrap.addEventListener('cs:pick', async function (e) {
    const brandId = e.detail.value
    brandIn.value = brandId
    if (!brandId) { csM.reset('รุ่นรถ'); csM.disable(); modelIn.value = ''; return }
    csM.reset('กำลังโหลด...'); csM.disable(); modelIn.value = ''
    try {
      const res  = await fetch('/api/models?brand_id=' + brandId)
      const data = await res.json()
      csM.setItems(data, 'รุ่นรถ'); csM.enable()
    } catch { csM.reset('โหลดไม่ได้'); csM.enable() }
  })

  modelWrap.addEventListener('cs:pick', e => { modelIn.value = e.detail.value })
  yearWrap.addEventListener('cs:pick',  e => { yearIn.value  = e.detail.value })
  classWrap.addEventListener('cs:pick', e => { classIn.value = e.detail.value })
})()

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
