// Inicialización segura por página
document.addEventListener('DOMContentLoaded', () => {
  const hasForm = !!document.getElementById('formEncuesta');
  if (hasForm && window.FormHandler && typeof FormHandler.init === 'function') {
    FormHandler.init();
  }

  // Fechas en portada y footer (si existen)
  const todayEl = document.getElementById('today');
  const genEl = document.getElementById('generated');
  if (todayEl || genEl) {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const yyyy = d.getFullYear();
    const pretty = `${dd}/${mm}/${yyyy}`;
    if (todayEl) todayEl.textContent = pretty;
    if (genEl) genEl.textContent = pretty;
  }
});