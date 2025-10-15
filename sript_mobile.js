// Funcionalidades móviles para encuestadores
class MobileSurvey {
  constructor() {
    this.init();
  }
  
  init() {
    this.setupValidation();
    this.setupToasts();
    this.setupProgress();
  }
  
  setupValidation() {
    const form = document.getElementById('formEncuesta');
    if (!form) return;
    
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.addEventListener('blur', () => this.validateField(input));
      input.addEventListener('input', () => this.clearFieldError(input));
    });
  }
  
  validateField(field) {
    if (field.hasAttribute('required') && !field.value.trim()) {
      this.setFieldError(field);
      return false;
    }
    
    if (field.value.trim()) {
      this.setFieldSuccess(field);
      return true;
    }
    
    this.clearFieldError(field);
    return true;
  }
  
  setFieldError(field) {
    field.classList.add('field-error');
    field.classList.remove('field-success');
  }
  
  setFieldSuccess(field) {
    field.classList.add('field-success');
    field.classList.remove('field-error');
  }
  
  clearFieldError(field) {
    field.classList.remove('field-error', 'field-success');
  }
  
  setupToasts() {
    // Los toasts se crearán dinámicamente cuando se necesiten
  }
  
  showToast(message, type = 'info') {
    const existingToast = document.querySelector('.toast');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 100);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
  
  setupProgress() {
    // Funcionalidad de progreso se puede agregar después
  }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('formEncuesta')) {
    window.mobileSurvey = new MobileSurvey();
  }
});

// Mejorar el envío del formulario
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('formEncuesta');
  if (form) {
    form.addEventListener('submit', (e) => {
      const requiredFields = form.querySelectorAll('[required]');
      let hasErrors = false;
      
      requiredFields.forEach(field => {
        if (!field.value.trim()) {
          window.mobileSurvey.setFieldError(field);
          hasErrors = true;
        }
      });
      
      if (hasErrors) {
        e.preventDefault();
        window.mobileSurvey.showToast('Completa todos los campos obligatorios', 'error');
        return;
      }
      
      // Si todo está bien, mostrar éxito
      setTimeout(() => {
        window.mobileSurvey.showToast('¡Encuesta guardada exitosamente!', 'success');
      }, 100);
    });
  }
});

window.mobileSurvey = window.mobileSurvey || {
  showToast: (msg) => console.log('[toast]', msg)
};