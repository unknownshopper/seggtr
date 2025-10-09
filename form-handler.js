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
    // Si la sesión aún no trae username, usar email de Firebase si existe
    if (!username && window.fbAuth && window.fbAuth.currentUser) {
      username = window.fbAuth.currentUser.email || window.fbAuth.currentUser.uid || '';
    }
  } catch (_) {}

  // Derivar un ID visible y normalizado para el encuestador/admin
  let display = '';
  if (username) {
    const u = String(username).toLowerCase();

    if (u.includes('@')) {
      const [local, domain] = u.split('@');
      if (domain === 'omobility.com' || domain === 'unknownshoppers.com') {
        if (local === 'admin') {
          display = 'admin';
        } else if (local.startsWith('encuestador')) {
          display = 'Encuestador'; // Mostrar literal “Encuestador”
        } else {
          display = local; // otros usuarios del dominio
        }
      } else {
        // otros dominios: usar la parte local tal cual
        display = local;
      }
    } else {
      // usuario local sin dominio
      if (u === 'admin') display = 'admin';
      else if (u.startsWith('encuestador')) display = 'Encuestador';
      else display = u;
    }
  }

  if (display) {
    field.value = display;
    field.placeholder = display;
    field.readOnly = true;            // bloquear edición
    field.style.backgroundColor = '#f7f7f7';
    field.title = 'Autocompletado desde sesión';

    // Protección extra contra cambios manuales
    const lockVal = () => { field.value = display; };
    field.addEventListener('keydown', (e) => { e.preventDefault(); lockVal(); });
    field.addEventListener('input', lockVal);
    field.addEventListener('paste', (e) => { e.preventDefault(); lockVal(); });
  }
}

function forceFillInterviewerId() {
  const f = document.getElementById('encuestador_id');
  if (!f) return;
  if (f.value) return;

  // Intenta usar la lógica existente
  try { setInterviewerIdFromSession(); } catch (_) {}

  if (f.value) return;

  // Fallback directo desde sesión/email si siguiera vacío
  try {
    const sess = (window.AuthSystem && typeof AuthSystem.getSession === 'function') ? AuthSystem.getSession() : null;
    const username = sess?.username || (window.fbAuth?.currentUser?.email) || '';
    const u = String(username || '').toLowerCase();
    let display = '';
    if (u.includes('@')) {
      const [local, domain] = u.split('@');
      if (domain === 'omobility.com' || domain === 'unknownshoppers.com') {
        if (local === 'admin') display = 'admin';
        else if (local.startsWith('encuestador')) display = 'Encuestador';
        else display = local;
      } else {
        display = local;
      }
    } else {
      if (u === 'admin') display = 'admin';
      else if (u.startsWith('encuestador')) display = 'Encuestador';
      else display = u;
    }
    if (display) {
      f.value = display;
      f.placeholder = display;
      f.readOnly = true;
      f.style.backgroundColor = '#f7f7f7';
      f.title = 'Autocompletado desde sesión';
      const lockVal = () => { f.value = display; };
      f.addEventListener('keydown', (e) => { e.preventDefault(); lockVal(); });
      f.addEventListener('input', lockVal);
      f.addEventListener('paste', (e) => { e.preventDefault(); lockVal(); });
    }
  } catch (_) {}
}

function userCanSubmitSurvey() {
  try {
    if (window.AuthSystem && typeof AuthSystem.getSession === 'function') {
      const s = AuthSystem.getSession();
      const role = (s?.role || '').toLowerCase();
      if (role === 'encuestador' || role === 'admin') return true;
    }
    // Fallback: si ya hay usuario de Firebase pero la sesión local aún no tiene rol,
    // damos permiso como encuestador para no bloquear el envío.
    if (window.fbAuth && window.fbAuth.currentUser) {
      return true;
    }
  } catch (_) {}
  // Por defecto, ser conservadores
  return false;
}

function enforceSurveyPermissions() {
  const formEncuestaEl = document.getElementById('formEncuesta');
  if (!formEncuestaEl) return;
  const submitBtn = formEncuestaEl.querySelector('button[type="submit"]');

  const can = userCanSubmitSurvey();
  if (!can) {
    // Deshabilitar envío para supervisor (u otros no permitidos)
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('outline');
      submitBtn.title = 'Solo encuestadores y admin pueden enviar';
      submitBtn.textContent = 'Sin permiso para enviar';
    }
  } else {
    // Asegurar habilitado cuando sí puede
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('outline');
      submitBtn.title = '';
      submitBtn.textContent = 'Enviar respuesta';
    }
  }
}

async function saveSurveyToFirestore(row) {
  console.log('[saveSurveyToFirestore] Inicio - db:', !!window.db, 'fbAuth:', !!window.fbAuth, 'currentUser:', window.fbAuth?.currentUser?.email || null);
  
  try {
    if (!window.db || !window.fbAuth) return { ok: false, reason: 'no_firebase' };

    const user = window.fbAuth.currentUser;
    console.log('[saveSurveyToFirestore] user tras leer:', user?.email || null, 'uid:', user?.uid || null);
    
    if (!user) return { ok: false, reason: 'no_auth' };

    // Colección donde guardaremos
    const col = window.db.collection('surveys');

    // Puedes usar add (id autogenerado) o un id determinista por ts+encuestador
    // Opción simple: add
    const payload = {
      ...row,
      _createdAt: new Date().toISOString(),
      _createdBy: user.uid,
      _createdEmail: user.email || null,
      _origin: location.origin
    };

    await col.add(payload);
    console.log('[Form] Guardado en Firestore OK:', payload._createdAt, 'user:', payload._createdBy, 'email:', payload._createdEmail);
    return { ok: true };
  } catch (e) {
    console.error('Firestore write error:', e);
    return { ok: false, reason: e?.message || 'error' };
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
  
    // Ajusta el botón según permisos (supervisor deshabilitado)
    enforceSurveyPermissions();
  
    formEncuestaEl.addEventListener('submit', async (e) => {
      e.preventDefault();

      // Forzar ID de encuestador y validar requeridos antes de continuar
    forceFillInterviewerId();

    // Si faltan requeridos, mostrar al usuario qué falta y no seguir
    if (!formEncuestaEl.checkValidity()) {
      formEncuestaEl.reportValidity();
      if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalText; }
      return;
    }

    const submitBtnEl = formEncuestaEl.querySelector('button[type="submit"]');
    if (submitBtnEl && !submitBtnEl.__omoBound) {
      submitBtnEl.__omoBound = true;
      submitBtnEl.addEventListener('click', () => {
        forceFillInterviewerId();
        // Si algo falta, el navegador marcará el campo que falta
        formEncuestaEl.reportValidity();
      });
    }
  
      // Defensa adicional si el estado de sesión cambia tarde
      if (!userCanSubmitSurvey()) {
        alert('No tienes permiso para enviar esta encuesta.');
        return;
      }
  
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
  
        // 4) Generar imagen de evidencia (JPEG base64) con overlay de metadatos
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

        // 5.1) Intentar guardar en Firestore (no bloquea si falla)
        // 5.1) Intentar guardar en Firestore (no bloquea si falla)
        try {
          const res = await saveSurveyToFirestore(row);
          if (!res.ok) {
            const reason = res.reason || 'error';
            const msg = `Guardado local OK. Firestore falló: ${reason}`;
            console.warn('No se guardó en Firestore:', reason);
            if (window.mobileSurvey && typeof window.mobileSurvey.showToast === 'function') {
              window.mobileSurvey.showToast(msg, 'error');
            } else {
              alert(msg);
            }
          }
        } catch (e) {
          const msg = `Guardado local OK. Firestore falló: ${e?.message || 'error'}`;
          console.warn('No se guardó en Firestore (ex):', e);
          if (window.mobileSurvey && typeof window.mobileSurvey.showToast === 'function') {
            window.mobileSurvey.showToast(msg, 'error');
          } else {
            alert(msg);
          }
        }

        
  
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

  // ——— Remember me helpers ———
  getRememberFlag() {
    try { return localStorage.getItem('omo_remember_me') === '1'; } catch { return false; }
  },
  setRememberFlag(v) {
    try { localStorage.setItem('omo_remember_me', v ? '1' : '0'); } catch {}
  },
  rememberUsername(username) {
    try { localStorage.setItem('omo_last_user', username || ''); } catch {}
  },
  getRememberedUsername() {
    try { return localStorage.getItem('omo_last_user') || ''; } catch { return ''; }
  },
  ensureRememberUI() {
    const form = document.getElementById('loginForm');
    if (!form) return;
    let remember = form.querySelector('#rememberMe');
    if (!remember) {
      const holder = document.createElement('div');
      holder.style.cssText = 'margin:6px 0; display:flex; align-items:center; gap:6px; font-size:12px;';
      holder.innerHTML = `
        <input type="checkbox" id="rememberMe" />
        <label for="rememberMe">Recordarme en este dispositivo</label>
      `;
      form.appendChild(holder);
      remember = holder.querySelector('#rememberMe');
    }
    remember.checked = this.getRememberFlag();
  
    // Prefill username
    const userInput = document.getElementById('username');
    if (userInput) {
      const last = this.getRememberedUsername();
      if (last && !userInput.value) userInput.value = last;
    }
  
    // Persistir cambio de la casilla
    remember.addEventListener('change', () => this.setRememberFlag(remember.checked));
  },

ensureRememberUI() {
  const form = document.getElementById('loginForm');
  if (!form) return;
  let remember = form.querySelector('#rememberMe');
  if (!remember) {
    // Insertar UI simple
    const holder = document.createElement('div');
    holder.style.cssText = 'margin:6px 0; display:flex; align-items:center; gap:6px; font-size:12px;';
    holder.innerHTML = `
      <input type="checkbox" id="rememberMe" />
      <label for="rememberMe">Recordarme en este dispositivo</label>
    `;
    form.appendChild(holder);
    remember = holder.querySelector('#rememberMe');
  }
  remember.checked = this.getRememberFlag();

  // Prefill username
  const userInput = document.getElementById('username');
  if (userInput) {
    const last = this.getRememberedUsername();
    if (last && !userInput.value) userInput.value = last;
  }

  // Persistir cambio de la casilla
  remember.addEventListener('change', () => this.setRememberFlag(remember.checked));
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
  
    // Aplicar permisos (botón Enviar)
    enforceSurveyPermissions();
    // Reintentos escalonados
    setTimeout(() => enforceSurveyPermissions(), 600);
    setTimeout(() => enforceSurveyPermissions(), 1500);
    setTimeout(() => enforceSurveyPermissions(), 3000);
  
    // Polling defensivo que se corta cuando ya hay permiso
    const permInterval = setInterval(() => {
      enforceSurveyPermissions();
      if (userCanSubmitSurvey()) clearInterval(permInterval);
    }, 1500);
    // Auto-stop de seguridad a los 10s
    setTimeout(() => clearInterval(permInterval), 10000);
  
    this.setupFormSubmission();
    this.setupConditionalFields();
  
    // Poll robusto: espera a tener campo y sesión; si sigue vacío, hace fallback directo
    (function () {
      const deadline = Date.now() + 10000; // 10s máx
      const iv = setInterval(() => {
        const f = document.getElementById('encuestador_id');
        const sess = (window.AuthSystem && typeof AuthSystem.getSession === 'function') ? AuthSystem.getSession() : null;
        const hasUser = !!(sess && sess.username);
  
        // Si hay campo pero vacío, y ya hay sesión → intenta setInterviewerIdFromSession()
        if (f && !f.value && hasUser) {
          setInterviewerIdFromSession();
  
          // Fallback directo si sigue vacío
          if (!f.value) {
            const u = String(sess.username || '').toLowerCase();
            let display = '';
            if (u.includes('@')) {
              const [local, domain] = u.split('@');
              if (domain === 'omobility.com' || domain === 'unknownshoppers.com') {
                if (local === 'admin') display = 'admin';
                else if (local.startsWith('encuestador')) display = 'Encuestador';
                else display = local;
              } else {
                display = local;
              }
            } else {
              if (u === 'admin') display = 'admin';
              else if (u.startsWith('encuestador')) display = 'Encuestador';
              else display = u;
            }
  
            if (display) {
              f.value = display;
              f.placeholder = display;
              f.readOnly = true;
              f.style.backgroundColor = '#f7f7f7';
              f.title = 'Autocompletado desde sesión';
              const lockVal = () => { f.value = display; };
              f.addEventListener('keydown', (e) => { e.preventDefault(); lockVal(); });
              f.addEventListener('input', lockVal);
              f.addEventListener('paste', (e) => { e.preventDefault(); lockVal(); });
            }
          }
        }
  
        // Si ya está lleno, o se acabó el tiempo → detener
        if ((f && f.value) || Date.now() > deadline) {
          clearInterval(iv);
        }
      }, 400);
    })();
  } // ← cierra el método init()
};   // ← cierra el objeto FormHandler

// Enforce interviewer ID autofill independent of FormHandler.init()
(function enforceInterviewerIdAutofill() {
  function computeDisplayFromUsername(username) {
    const u = String(username || '').toLowerCase();
    if (!u) return '';
    if (u.includes('@')) {
      const [local, domain] = u.split('@');
      if (domain === 'omobility.com' || domain === 'unknownshoppers.com') {
        if (local === 'admin') return 'admin';
        if (local.startsWith('encuestador')) return 'Encuestador';
        return local;
      }
      return local;
    } else {
      if (u === 'admin') return 'admin';
      if (u.startsWith('encuestador')) return 'Encuestador';
      return u;
    }
  }

  function lockField(f, display) {
    f.value = display;
    f.placeholder = display;
    f.readOnly = true;
    f.style.backgroundColor = '#f7f7f7';
    f.title = 'Autocompletado desde sesión';
    const lockVal = () => { f.value = display; };
    f.addEventListener('keydown', (e) => { e.preventDefault(); lockVal(); });
    f.addEventListener('input', lockVal);
    f.addEventListener('paste', (e) => { e.preventDefault(); lockVal(); });
  }

  function tryFill() {
    const f = document.getElementById('encuestador_id');
    const sess = (window.AuthSystem && typeof AuthSystem.getSession === 'function') ? AuthSystem.getSession() : null;
    const username = sess?.username || (window.fbAuth?.currentUser?.email) || '';
    if (!f || !username) return false;

    if (!f.value) {
      const display = computeDisplayFromUsername(username);
      if (display) {
        lockField(f, display);
        return true;
      }
    }
    return !!f.value;
  }

  function start() {
    const deadline = Date.now() + 15000; // hasta 15s
    const tick = () => {
      if (tryFill() || Date.now() > deadline) return;
      setTimeout(tick, 300);
    };
    tick();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();