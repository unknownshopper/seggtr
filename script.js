// Inicialización segura por página
document.addEventListener('DOMContentLoaded', () => {
  const hasForm = !!document.getElementById('formEncuesta');
  if (hasForm && window.FormHandler && typeof FormHandler.init === 'function') {
    FormHandler.init();
  }
});