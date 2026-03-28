'use strict'

// Edit Model Modal
function openEditModal (id, brandId, name, val) {
  document.getElementById('editModelForm').action = `/admin/cars/model/${id}/edit`
  document.getElementById('em_brand').value = brandId
  document.getElementById('em_name').value = name
  document.getElementById('em_val').value = val
  document.getElementById('editModelModal').style.display = 'flex'
}
function closeEditModal () {
  document.getElementById('editModelModal').style.display = 'none'
}
// alias ชื่อที่เรียกจาก EJS
const openEditModel = openEditModal

// Rate % hint
document.querySelectorAll('input[name$="_rate"]').forEach(inp => {
  inp.addEventListener('input', function () {
    const hint = this.nextElementSibling
    if (hint && hint.classList.contains('adm-settings-hint')) {
      hint.textContent = (parseFloat(this.value || 0) * 100).toFixed(1) + '%'
    }
  })
})

// Close modal on backdrop click
document.addEventListener('click', e => {
  const modal = document.getElementById('editModelModal')
  if (modal && e.target === modal) closeEditModal()
})
