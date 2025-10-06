// Lógica específica de formularios
// ——— Utilidades para geolocalización e imagen de evidencia ———
async function getGeolocation(options = { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }) {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      return resolve({ lat: null, lng: null, accuracy: null, error: 'geolocation_unsupported' });
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords || {};
        resolve({ lat: latitude ?? null, lng: longitude ?? null, accuracy: accuracy ?? null, error: null });
      },
      (err) => {
        resolve({ lat: null, lng: null, accuracy: null, error: err?.code || 'geolocation_error' });
      },
      options
    );
  });
}

function drawMetadataOverlay(ctx, w, h, metaLines) {
  const padding = 20;
  const boxHeight = 140;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, h - boxHeight, w, boxHeight);

  ctx.fillStyle = '#fff';
  ctx.font = '16px Inter, Arial, sans-serif';
  let y = h - boxHeight + padding + 4;
  metaLines.forEach(line => {
    ctx.fillText(line, padding, y);
    y += 22;
  });
}

async function generateSurveyImage(formEl, metadata) {
  if (typeof html2canvas === 'undefined' || !formEl) return null;

  // Capturamos el formulario con escala reducida
  const baseCanvas = await html2canvas(formEl, {
    scale: 0.6,                 // reduce pixeles renderizados
    backgroundColor: '#ffffff'
  });

  // Reescalar a un ancho máximo para asegurar tamaño de archivo
  const maxWidth = 800;         // objetivo ~800px de ancho
  let srcW = baseCanvas.width;
  let srcH = baseCanvas.height;

  let dstW = srcW;
  let dstH = srcH;
  if (srcW > maxWidth) {
    const ratio = maxWidth / srcW;
    dstW = Math.round(srcW * ratio);
    dstH = Math.round(srcH * ratio);
  }

  const canvas = document.createElement('canvas');
  canvas.width = dstW;
  canvas.height = dstH;
  const ctx = canvas.getContext('2d');

  // Dibujar imagen base reescalada
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, dstW, dstH);
  ctx.drawImage(baseCanvas, 0, 0, srcW, srcH, 0, 0, dstW, dstH);

  // Preparar líneas de metadatos visibles
  const metaLines = [
    `Fecha/hora: ${metadata.localTime || ''}`,
    `Encuestador ID: ${metadata.encuestador_id || ''}`,
    `Lat: ${metadata.geo_lat ?? 'N/A'} | Lng: ${metadata.geo_lng ?? 'N/A'} | Acc: ${metadata.geo_accuracy ?? 'N/A'}m`,
    `TS ISO: ${metadata.ts || ''}`
  ];

  // Dibujar overlay de metadatos
  const padding = 16;
  const lineH = 20;
  const boxHeight = padding * 2 + lineH * metaLines.length;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, dstH - boxHeight, dstW, boxHeight);

  ctx.fillStyle = '#fff';
  ctx.font = '14px Inter, Arial, sans-serif';
  let y = dstH - boxHeight + padding + 14;
  metaLines.forEach(line => {
    ctx.fillText(line, padding, y);
    y += lineH;
  });

  // Exportar como JPEG con compresión
  const quality = 0.7; // 0.6–0.75 balance visual/tamaño
  return canvas.toDataURL('image/jpeg', quality);
}

function setInterviewerIdFromSession() {
  const field = document.getElementById('encuestador_id');
  if (!field) return;

  let username = '';
  try {
    if (window.AuthSystem && typeof AuthSystem.getSession === 'function') {
      const session = AuthSystem.getSession();
      username = session?.username || '';
    }
  } catch (_) {}

  if (username) {
    field.value = username;
    field.readOnly = true;              // Lo fija para evitar cambios manuales
    field.style.backgroundColor = '#f7f7f7';
    field.title = 'Autocompletado desde sesión';
  }
}

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
    for (const [name, arr] of groups.entries()) {
      data[name] = arr.join('|');
    }
  
    // Add timestamp
    if (!('ts' in data)) data.ts = new Date().toISOString();
  
    // >>> PEGAR AQUÍ (antes del return) <<<
    // Fijar encuestador desde sesión si el campo viene vacío
    if (!data.encuestador_id) {
      try {
        if (window.AuthSystem && typeof AuthSystem.getSession === 'function') {
          const session = AuthSystem.getSession();
          if (session?.username) data.encuestador_id = session.username;
        }
      } catch (_) {}
    }
    // >>> FIN DEL BLOQUE A PEGAR <<<
  
    return data;
  },
  
  setupFormSubmission() {
    const formEncuestaEl = document.getElementById('formEncuesta');
    if (!formEncuestaEl) return;
  
    formEncuestaEl.addEventListener('submit', async (e) => {
      e.preventDefault();
  
      const submitBtn = formEncuestaEl.querySelector('button[type="submit"]');
      const originalText = submitBtn ? submitBtn.textContent : '';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando...';
      }
  
      try {
        // 1) Serializar datos del formulario
        const row = this.serializeForm(e.target);
  
        // 2) Capturar geolocalización (no bloquea si falla)
        const geo = await getGeolocation();
        row.geo_lat = geo.lat;
        row.geo_lng = geo.lng;
        row.geo_accuracy = geo.accuracy;
        row.geo_error = geo.error || '';
  
        // 3) Metadatos para imagen
        const metadata = {
          ts: row.ts || new Date().toISOString(),
          localTime: new Date().toLocaleString(),
          encuestador_id: row.encuestador_id || '',
          geo_lat: row.geo_lat,
          geo_lng: row.geo_lng,
          geo_accuracy: row.geo_accuracy
        };
  
        // 4) Generar imagen de evidencia (PNG base64) con overlay de metadatos
        //    Guardamos dataURL en el registro. Nota: localStorage tiene límites (~5MB).
        let imageDataUrl = null;
        try {
          imageDataUrl = await generateSurveyImage(formEncuestaEl, metadata);
        } catch (_) {
          imageDataUrl = null; // No bloquear si la generación falla
        }
        if (imageDataUrl) {
          row.image_proof_png = imageDataUrl;
        }
  
        // 5) Guardar en localStorage
        const all = DataManager.readAll();
        all.push(row);
        DataManager.writeAll(all);
  
        // 6) Limpiar y feedback
        e.target.reset();
  
        if (window.mobileSurvey) {
          window.mobileSurvey.showToast('¡Encuesta guardada con evidencia!', 'success');
        } else {
          alert('¡Gracias! Respuesta registrada con evidencia.');
        }
      } catch (err) {
        console.error('Error al guardar encuesta:', err);
        if (window.mobileSurvey) {
          window.mobileSurvey.showToast('Error al guardar. Intenta nuevamente.', 'error');
        } else {
          alert('Error al guardar. Intenta nuevamente.');
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      }
    });
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
  
    // Manejo del campo condicional para zona
    const zonaSelect = document.getElementById('zona');
    if (zonaSelect) {
      zonaSelect.addEventListener('change', function() {
        const otroField = document.getElementById('zona_otro');
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
  
    // Manejo del campo condicional para moto actual
    const usaMotoSelect = document.getElementById('usaMoto');
    if (usaMotoSelect) {
      usaMotoSelect.addEventListener('change', function() {
        const motoActualField = document.getElementById('moto_actual');
        if (this.value === 'Sí') {
          motoActualField.style.display = 'block';
          motoActualField.required = true;
        } else {
          motoActualField.style.display = 'none';
          motoActualField.required = false;
          motoActualField.value = '';
        }
      });
    }
  },
  
  init() {
    // Intento inmediato (puede ya existir sesión previa en localStorage)
    setInterviewerIdFromSession();
  
    // Reintento corto para cuando AuthSystem termine de inicializar
    setTimeout(() => {
      setInterviewerIdFromSession();
    }, 600);
  
    this.setupFormSubmission();
    this.setupConditionalFields();
  }
};