// Lógica específica de formularios
const FormHandler = {
    serializeForm(form) {
      const data = {};
      const groups = new Map();
      const els = form.querySelectorAll('input, select, textarea');
      
      els.forEach(el => {
        const { name, type } = el;
        if(!name) return;
        
        if(type === 'checkbox') {
          if(!groups.has(name)) groups.set(name, []);
          if(el.checked) groups.get(name).push(el.value);
          return;
        }
        
        if(type === 'radio') {
          if(el.checked) data[name] = el.value;
          return;
        }
        
        let val = el.value;
        if(type === 'number') val = val === '' ? '' : Number(val);
        data[name] = val;
      });
      
      // Flatten checkbox groups
      for(const [name, arr] of groups.entries()) {
        data[name] = arr.join('|');
      }
      
      // Add timestamp
      if(!('ts' in data)) data.ts = new Date().toISOString();
      return data;
    },
    
    setupFormSubmission() {
      const formEncuestaEl = document.getElementById('formEncuesta');
      if (formEncuestaEl) {
        formEncuestaEl.addEventListener('submit', (e) => {
          e.preventDefault();
          const row = this.serializeForm(e.target);
          const all = DataManager.readAll(); 
          all.push(row); 
          DataManager.writeAll(all);
          e.target.reset(); 
          
          // Usar toast si está disponible, sino alert
          if (window.mobileSurvey) {
            window.mobileSurvey.showToast('¡Encuesta guardada exitosamente!', 'success');
          } else {
            alert('¡Gracias! Respuesta registrada.');
          }
        });
      }
    },
    
    setupConditionalFields() {
      const ocupacionSelect = document.getElementById('ocupacion');
      if (ocupacionSelect) {
        ocupacionSelect.addEventListener('change', function() {
          const otroField = document.getElementById('ocupacion_otro');
          if (this.value === 'Otro') {
            otroField.style.display = 'block';
            otroField.required = true;
          } else {
            otroField.style.display = 'none';
            otroField.required = false;
            otroField.value = '';
          }
        });
      }
    },
    
    init() {
      this.setupFormSubmission();
      this.setupConditionalFields();
    }
  };