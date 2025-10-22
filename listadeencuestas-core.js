// Lógica principal para la página de lista de encuestas
// Maneja la tabla, filtros, paginación, ordenamiento y operaciones CRUD

(function() {
    const MAX = 250; // mostrar máximo 250
    
    const state = {
      role: 'encuestador',
      page: 1,
      pageSize: 50,
      filtered: [],
      all: [],
      editIndex: null,
      sortColumn: 'ts',
      sortDirection: 'desc' // desc = más reciente primero
    };
  
    // ==================== UTILIDADES ====================
    
    function getRoleBadge(role) {
      const cls = role === 'admin' ? 'role-admin' : role === 'supervisor' ? 'role-supervisor' : 'role-encuestador';
      return '<span class="pill ' + cls + '">' + role + '</span>';
    }
  
    function canView(role) { 
      return ['admin', 'supervisor', 'encuestador'].includes(role); 
    }
    
    function canEdit(role) { 
      return role === 'admin'; 
    }
    
    function canDelete(role) { 
      return role === 'admin'; 
    }
  
    function fmtDate(iso) {
      try { 
        return new Date(iso).toLocaleString(); 
      } catch { 
        return iso || ''; 
      }
    }
  
    function fmtGeo(r) {
      if (r.geo_lat == null || r.geo_lng == null) {
        return '<span class="muted">N/A</span>';
      }
      
      const lat = Number(r.geo_lat).toFixed(5);
      const lng = Number(r.geo_lng).toFixed(5);
      const acc = (r.geo_accuracy != null) ? ` ±${Math.round(r.geo_accuracy)}m` : '';
      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;      
      return `
        <div style="display: flex; flex-direction: column; gap: 2px; font-size: 12px;">
          <span style="user-select: text; color: #64748b;">Lat: ${lat}</span>
          <span style="user-select: text; color: #64748b;">Lng: ${lng}</span>
          ${acc ? `<span style="color: #94a3b8; font-size: 11px;">${acc}</span>` : ''}
          <a href="${mapsUrl}" target="_blank" rel="noopener noreferrer" 
             class="btn outline small" 
             style="font-size: 10px; padding: 2px 6px; text-decoration: none; display: inline-flex; align-items: center; gap: 3px; width: fit-content; margin-top: 2px;">
            🗺️ Ver mapa
          </a>
        </div>
      `;
    }
  
    function getEncuestadorBadge(encuestadorId, createdEmail) {
      // Priorizar _createdEmail si encuestador_id es genérico
      const emailToUse = (encuestadorId === 'Encuestador' || encuestadorId === 'encuestador') 
        ? createdEmail 
        : encuestadorId;
      
      if (!emailToUse) return { badge: 'NA', class: '' };
      
      const id = emailToUse.toString().toLowerCase().trim();
      
      // Admin
      if (id === 'admin' || id.includes('admin')) {
        return { badge: 'AD', class: 'admin' };
      }
      
      // Supervisor
      if (id === 'supervisor' || id.includes('supervisor')) {
        return { badge: 'SU', class: 'supervisor' };
      }
      
      // Máximo García Dorame
      if (id === 'encuestador' || 
          id === 'encuestador@omobility.com' ||
          id.includes('maximo') ||
          id.includes('máximo') ||
          id.includes('garcia')) {
        return { badge: 'MX', class: 'maximo' };
      }
      
      // Humberto Castillo
      if (id === 'encuestador2' || 
          id === 'encuestador2@omobility.com' ||
          id.includes('humberto') ||
          id.includes('castillo')) {
        return { badge: 'HU', class: 'humberto' };
      }
      
      // Arístides Prats
      if (id === 'encuestador3' || 
          id === 'encuestador3@omobility.com' ||
          id.includes('aristides') ||
          id.includes('arístides') ||
          id.includes('prats')) {
        return { badge: 'AR', class: 'aristides' };
      }
      
      // Default
      return { badge: id.slice(0, 2).toUpperCase(), class: '' };
    }
  
    // ==================== SESIÓN Y ROLES ====================
  
    function loadSession() {
      const prev = state.role;
      let role = 'encuestador';
  
      try {
        if (window.AuthSystem && typeof AuthSystem.getSession === 'function') {
          const s = AuthSystem.getSession();
          if (s?.role) role = s.role;
          if ((s?.username || '').toLowerCase() === 'admin') {
            role = 'admin';
          }
        } else {
          // fallback al localStorage directo
          const raw = localStorage.getItem('omomobility_session');
          if (raw) {
            const sess = JSON.parse(raw);
            role = sess?.role || role;
            if ((sess?.username || '').toLowerCase() === 'admin') {
              role = 'admin';
            }
          }
        }
      } catch(error) {
        console.error('[ListaEncuestas] Error cargando sesión:', error);
      }
  
      state.role = role;
  
      const badge = document.getElementById('roleBadge');
      if (badge) {
        badge.innerHTML = '<span class="muted">Rol:</span> ' + getRoleBadge(state.role);
      }
  
      if (state.role !== prev) {
        render();
      }
    }
  
    // ==================== DATOS DE FIRESTORE ====================
  
    function loadData() {
      if (!window.db) {
        console.error('[Dashboard] Firebase no disponible');
        alert('Firebase no está disponible. Verifica tu conexión a internet.');
        state.all = [];
        applyFilter();
        return;
      }
  
      fetchFromFirestore().then(rows => {
        if (Array.isArray(rows)) {
          state.all = rows.slice(0, MAX);
          applyFilter();
          updateFirebaseStats();
          console.log(`[Dashboard] Cargadas ${rows.length} encuestas desde Firestore`);
        } else {
          state.all = [];
          applyFilter();
        }
      }).catch((err) => {
        console.error('[Dashboard] Error cargando desde Firestore:', err);
        alert('Error al cargar encuestas desde Firebase. Verifica tu conexión.');
        state.all = [];
        applyFilter();
      });
    }
  
    async function fetchFromFirestore() {
      try {
        const colRef = window.db.collection('surveys');
        const snap = await colRef.limit(250).get();
        const rows = [];
        
        snap.forEach(doc => {
          const d = doc.data() || {};
  
          rows.push({
            _firestoreId: doc.id,
            ts: d.ts || d._createdAt || d.when || null,
            encuestador_id: d.encuestador_id || '',
            zona: d.zona || 'Sin especificar',
            edad: d.edad ?? '',
            intencion: d.intencion ?? '',
            comentarios: d.comentarios || '',
            geo_lat: d.geo_lat ?? null,
            geo_lng: d.geo_lng ?? null,
            geo_accuracy: d.geo_accuracy ?? null,
            image_proof_png: d.image_proof_png || null,
            ...d
          });
        });
        
        // DEBUGGING
        const uniqueEncuestadores = [...new Set(rows.map(r => r.encuestador_id))];
        console.log('🔍 Encuestadores únicos en Firebase:', uniqueEncuestadores);
        console.log('📊 Distribución:', uniqueEncuestadores.map(enc => ({
          encuestador: enc,
          cantidad: rows.filter(r => r.encuestador_id === enc).length
                })));
        
        console.log('[Dashboard] Firestore rows:', rows.length, rows[0] ? Object.keys(rows[0]) : 'no rows');
        return rows;
      } catch (e) {
        console.warn('Firestore read failed:', e?.message || e);
        return [];
      }
    }
     

    
     
    function updateFirebaseStats() {
      const total = state.all.length;
      const maxSurveys = 250;
      
      const withImages = state.all.filter(r => r.image_proof_png && r.image_proof_png.length > 0).length;
      
      let estimatedSize = 0;
      state.all.forEach(r => {
        estimatedSize += 2; // Base: ~2KB por documento
        
        if (r.image_proof_png) {
          const base64Length = r.image_proof_png.length;
          const sizeInKB = (base64Length * 0.75) / 1024;
          estimatedSize += sizeInKB;
        }
      });
      
      const estimatedMB = (estimatedSize / 1024).toFixed(2);
      const storagePercent = ((estimatedSize / 1024) / 1024 * 100).toFixed(1);
      
      // Actualizar UI
      document.getElementById('stat-total').textContent = total;
      document.getElementById('stat-storage').textContent = `${estimatedMB} MB`;
      document.getElementById('stat-images').textContent = withImages;
      document.getElementById('stat-images-percent').textContent = 
        total > 0 ? `${Math.round((withImages / total) * 100)}% del total` : '0% del total';
      document.getElementById('stat-updated').textContent = 
        new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      
      // Barras de progreso
      const surveyPercent = Math.min((total / maxSurveys) * 100, 100);
      const surveyBar = document.getElementById('progress-surveys');
      if (surveyBar) {
        surveyBar.style.width = `${surveyPercent}%`;
        surveyBar.classList.remove('ok', 'warning', 'danger');
        if (surveyPercent >= 90) surveyBar.classList.add('danger');
        else if (surveyPercent >= 70) surveyBar.classList.add('warning');
        else surveyBar.classList.add('ok');
      }
      
      const storageBar = document.getElementById('progress-storage');
      if (storageBar) {
        storageBar.style.width = `${Math.min(storagePercent, 100)}%`;
        storageBar.classList.remove('ok', 'warning', 'danger');
        if (storagePercent > 80) storageBar.classList.add('danger');
        else if (storagePercent > 60) storageBar.classList.add('warning');
        else storageBar.classList.add('ok');
      }
      
      console.log(`[Stats] Total: ${total}, Storage: ${estimatedMB}MB, Images: ${withImages}`);
    }
    
    // Función global para generar evidencia
    window.generarEvidencia = async function(firestoreId) {
      const record = state.all.find(r => r._firestoreId === firestoreId);
      if (!record) {
        alert('❌ No se encontró el registro');
        return;
      }
      
      const btn = event.target;
      btn.disabled = true;
      btn.textContent = '⏳ Generando imagen...';
      
      try {
        const imageDataUrl = await generateEvidenceFromData(record);
        
        // Mostrar imagen generada
        const container = document.getElementById(`evidence-container-${firestoreId}`);
        container.innerHTML = `<div class="img-wrap"><img src="${imageDataUrl}" alt="evidencia generada"/></div>`;
        
        // Guardar en Firestore
        if (window.db) {
          const shouldSave = confirm('✅ Imagen generada correctamente.\n\n¿Deseas guardarla permanentemente en Firestore?');
          if (shouldSave) {
            btn.textContent = '💾 Guardando en Firestore...';
            await window.db.collection('surveys').doc(firestoreId).update({
              image_proof_png: imageDataUrl
            });
            alert('✅ Imagen guardada en Firestore exitosamente');
            // Actualizar en memoria local
            record.image_proof_png = imageDataUrl;
            btn.remove();
          } else {
            btn.textContent = '✅ Imagen generada (no guardada)';
            btn.disabled = false;
          }
        } else {
          btn.textContent = '✅ Imagen generada';
          btn.disabled = false;
        }
      } catch (error) {
        console.error('Error generando evidencia:', error);
        alert('❌ Error al generar imagen: ' + error.message);
        btn.disabled = false;
        btn.textContent = '🖼️ Reintentar';
      }
    };
     
    // ==================== FILTROS Y ORDENAMIENTO ====================
  
    function applyFilter() {
      const q = (document.getElementById('search').value || '').toLowerCase().trim();
      const list = state.all.filter(r => {
        const hay = (v) => (v ?? '').toString().toLowerCase().includes(q);
        return !q ||
          hay(r.encuestador_id) ||
          hay(r.zona) ||
          hay(r.comentarios) ||
          hay(r.ts);
      });
      state.filtered = list;
      sortData();
      state.page = 1;
      render();
      updateFirebaseStats();
    }
  
    function sortData() {
      const col = state.sortColumn;
      const dir = state.sortDirection;
      
      state.filtered.sort((a, b) => {
        let valA = a[col];
        let valB = b[col];
        
        if (valA == null) valA = '';
        if (valB == null) valB = '';
        
        if (col === 'edad' || col === 'intencion') {
          valA = Number(valA) || 0;
          valB = Number(valB) || 0;
        }
        
        if (col === 'ts') {
          valA = new Date(valA).getTime() || 0;
          valB = new Date(valB).getTime() || 0;
        }
        
        let comparison = 0;
        if (valA > valB) comparison = 1;
        if (valA < valB) comparison = -1;
        
        return dir === 'asc' ? comparison : -comparison;
      });
    }
    
    function setSortColumn(column) {
      if (state.sortColumn === column) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
      } else {
        state.sortColumn = column;
        state.sortDirection = 'desc';
      }
      
      sortData();
      state.page = 1;
      render();
    }
  
    function paginate(arr) {
      const start = (state.page - 1) * state.pageSize;
      return arr.slice(start, start + state.pageSize);
    }
  
    // ==================== RENDERIZADO ====================
  
    function render() {
      const total = state.filtered.length;
      const pages = Math.max(1, Math.ceil(total / state.pageSize));
      state.page = Math.min(state.page, pages);
  
      // Actualizar indicadores de ordenamiento
      document.querySelectorAll('th.sortable').forEach(th => {
        th.classList.remove('sort-asc', 'sort-desc');
        if (th.getAttribute('data-sort') === state.sortColumn) {
          th.classList.add(`sort-${state.sortDirection}`);
        }
      });
  
      const tbody = document.getElementById('rows');
      tbody.innerHTML = '';
  
      const pageRows = paginate(state.filtered);
      pageRows.forEach((r, i) => {
        const idx = (state.page - 1) * state.pageSize + i;
  
        const actions = [];
        actions.push(`<button class="btn outline small" data-action="view" data-idx="${idx}">Ver</button>`);
        if (canEdit(state.role)) {
          actions.push(`<button class="btn outline small" data-action="edit" data-idx="${idx}">Editar</button>`);
        }
        if (canDelete(state.role)) {
          actions.push(`<button class="btn outline small" style="color:#e53e3e;border-color:#e53e3e" data-action="delete" data-idx="${idx}">Eliminar</button>`);
        }
        
        const encBadge = getEncuestadorBadge(r.encuestador_id, r._createdEmail);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="nowrap">${fmtDate(r.ts)}</td>
          <td>
            <div class="cell-user">
              <span class="avatar ${encBadge.class}">${encBadge.badge}</span>
            </div>
          </td>
          <td><span class="chip">${(r.zona || 'Sin especificar')}</span></td>
          <td class="num">${r.edad ?? ''}</td>
          <td class="num">
            <div class="intent">
              <div class="intent-bar">
                <div class="intent-fill" style="width: ${Math.max(0, Math.min(100, Number(r.intencion || 0) * 10))}%;"></div>
              </div>
              <span>${r.intencion ?? ''}</span>
            </div>
          </td>
          <td class="nowrap">${fmtGeo(r)}</td>
          <td>
            ${r.image_proof_png
              ? `<img class="thumb" src="${r.image_proof_png}" alt="evidencia" onclick="openEvidence(${idx})" style="cursor: pointer;" />`
              : `<div class="generating-thumb" data-idx="${idx}">⏳ Generando...</div>`}
          </td>
          <td><div class="actions">${actions.join('')}</div></td>
        `;
        tbody.appendChild(tr);
      });
  
      document.getElementById('pageInfo').textContent = `Página ${state.page} de ${pages}`;
      document.getElementById('countInfo').textContent = `${total} encuestas (mostrando máx. ${MAX})`;
      document.getElementById('prev').disabled = state.page <= 1;
      document.getElementById('next').disabled = state.page >= pages;
      
      // Generar imágenes faltantes en segundo plano
      setTimeout(() => autoGenerateMissingImages(), 500);
    }
  
    // Generar imágenes faltantes automáticamente
    async function autoGenerateMissingImages() {
      const recordsWithoutImage = state.filtered.filter(r => !r.image_proof_png);
      
      if (recordsWithoutImage.length === 0) return;
      
      console.log(`[AutoGen] Generando ${recordsWithoutImage.length} imágenes faltantes...`);
      
      for (const record of recordsWithoutImage) {
        try {
          const imageDataUrl = await generateEvidenceFromData(record);
          
          // Guardar en Firestore
          if (window.db && record._firestoreId) {
            await window.db.collection('surveys').doc(record._firestoreId).update({
              image_proof_png: imageDataUrl
            });
          }
          
          // Actualizar en memoria
          record.image_proof_png = imageDataUrl;
          const originalRecord = state.all.find(r => r._firestoreId === record._firestoreId);
          if (originalRecord) originalRecord.image_proof_png = imageDataUrl;
          
          console.log(`[AutoGen] ✅ Imagen generada para ${record._firestoreId}`);
        } catch (error) {
          console.error(`[AutoGen] ❌ Error generando imagen para ${record._firestoreId}:`, error);
        }
      }
      
      // Refrescar tabla después de generar todas
      render();
      updateFirebaseStats();
    }
  
    // ==================== EVENTOS ====================
  
    function wireEvents() {
      document.getElementById('search').addEventListener('input', () => applyFilter());
      
      document.getElementById('pageSize').addEventListener('change', (e) => {
        state.pageSize = parseInt(e.target.value, 10) || 50;
        render();
      });
      
      document.getElementById('prev').addEventListener('click', () => { 
        state.page = Math.max(1, state.page - 1); 
        render(); 
      });
      
      document.getElementById('next').addEventListener('click', () => {
        const total = state.filtered.length;
        const pages = Math.max(1, Math.ceil(total / state.pageSize));
        state.page = Math.min(pages, state.page + 1);
        render();
      });
  
      // Ordenamiento de columnas
      document.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
          const column = th.getAttribute('data-sort');
          if (column) setSortColumn(column);
        });
      });
  
      // Acciones en filas
      document.getElementById('rows').addEventListener('click', (e) => {
        // Click en evidencia
        const img = e.target.closest('img.thumb[data-action="evidence"]');
        if (img) {
          const idx = parseInt(img.getAttribute('data-idx'), 10);
          const realItem = state.filtered[idx];
          if (realItem) openImage(realItem);
          return;
        }
  
        // Click en botones
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        
        const action = btn.getAttribute('data-action');
        const idx = parseInt(btn.getAttribute('data-idx'), 10);
        const realItem = state.filtered[idx];
        if (!realItem) return;
  
        if (action === 'view') openView(realItem);
        if (action === 'edit' && canEdit(state.role)) openEdit(realItem);
        if (action === 'delete' && canDelete(state.role)) doDelete(realItem);
      });
  
      document.getElementById('saveEdit').addEventListener('click', saveEdit);
    }


        // Generar imagen de evidencia dinámicamente desde datos
        async function generateEvidenceFromData(r) {
          return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Dimensiones del canvas
            const width = 800;
            const padding = 20;
            const lineHeight = 24;
            const headerHeight = 60;
            
                        // Preparar campos a mostrar - TODOS los campos disponibles
                        const allFields = [];
            
                        // Campos prioritarios primero
                        const priorityFields = [
                          { label: 'Encuestador', value: r.encuestador_id },
                          { label: 'Fecha', value: fmtDate(r.ts) },
                          { label: 'Zona', value: r.zona },
                          { label: 'Edad', value: r.edad },
                          { label: 'Sexo', value: r.sexo },
                          { label: 'Ocupación', value: r.ocupacion },
                          { label: 'Intención (0-10)', value: r.intencion }
                        ];
                        
                        // Agregar todos los demás campos dinámicamente
                        const excludeFields = ['_firestoreId', '_createdAt', '_createdBy', '_createdEmail', '_origin', 'image_proof_png', 'geo_lat', 'geo_lng', 'geo_accuracy', 'geo_error'];
                        const fieldLabels = getFieldLabel; // Usar la función que ya existe
                        
                        Object.keys(r).forEach(key => {
                          if (excludeFields.includes(key)) return;
                          if (priorityFields.some(f => f.label.toLowerCase().includes(key.toLowerCase()))) return;
                          
                          const value = r[key];
                          if (value !== null && value !== undefined && value !== '') {
                            allFields.push({
                              label: getFieldLabel(key),
                              value: String(value).substring(0, 80) // Truncar valores largos
                            });
                          }
                        });
                        
                        // Combinar campos prioritarios + resto
                        const fields = [...priorityFields.filter(f => f.value), ...allFields];
            
            // Calcular altura necesaria
            const contentHeight = fields.length * lineHeight + headerHeight + padding * 3;
            canvas.width = width;
            canvas.height = contentHeight;
            
            // Fondo blanco
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, width, contentHeight);
            
            // Header con gradiente
            const gradient = ctx.createLinearGradient(0, 0, width, headerHeight);
            gradient.addColorStop(0, '#667eea');
            gradient.addColorStop(1, '#764ba2');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, width, headerHeight);
            
            // Título
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px Arial, sans-serif';
            ctx.fillText('ENCUESTA OMOMOBILITY', padding, 35);
            
            // Subtítulo
            ctx.font = '14px Arial, sans-serif';
            ctx.fillText('Estudio de Mercado - Villahermosa, Tabasco', padding, 52);
            
            // Contenido - campos
            let y = headerHeight + padding + 20;
            ctx.fillStyle = '#1e293b';
            
            fields.forEach((field, idx) => {
              // Fondo alternado
              if (idx % 2 === 0) {
                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(0, y - 18, width, lineHeight);
              }
              
              // Label
              ctx.fillStyle = '#64748b';
              ctx.font = 'bold 12px Arial, sans-serif';
              ctx.fillText(field.label + ':', padding, y);
              
              // Value
              ctx.fillStyle = '#1e293b';
              ctx.font = '12px Arial, sans-serif';
              const valueText = String(field.value).substring(0, 80); // Truncar si es muy largo
              ctx.fillText(valueText, padding + 180, y);
              
              y += lineHeight;
            });
            
            // Footer con metadatos
            const footerY = contentHeight - padding - 40;
            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            ctx.fillRect(0, footerY, width, 60);
            
            ctx.fillStyle = '#ffffff';
            ctx.font = '11px Arial, sans-serif';
            ctx.fillText(`Ubicación: Lat ${r.geo_lat || 'N/A'}, Lng ${r.geo_lng || 'N/A'} (±${r.geo_accuracy || 'N/A'}m)`, padding, footerY + 20);
            ctx.fillText(`Generado: ${new Date().toLocaleString('es-MX')}`, padding, footerY + 38);
            ctx.fillText(`ID: ${r._firestoreId || 'N/A'}`, width - padding - 200, footerY + 38);
            
            // Convertir a imagen
            resolve(canvas.toDataURL('image/jpeg', 0.85));
          });
        }
  
    // ==================== MODALES ====================
    function openView(r) {
      const box = document.getElementById('detail');
      const geoTxt = fmtGeo(r);
  
      // Campos a excluir del detalle (metadatos internos)
      const excludeFields = ['_firestoreId', '_createdAt', '_createdBy', '_createdEmail', '_origin', 'image_proof_png'];
      
      // Campos prioritarios que se muestran primero
      const priorityFields = ['ts', 'encuestador_id', 'zona', 'edad', 'sexo', 'ocupacion', 'intencion', 'usaMoto', 'moto_actual'];
      
      // Generar HTML para todos los campos
      let fieldsHTML = '';
      
      // 1. Campos prioritarios primero
      priorityFields.forEach(field => {
        if (r[field] !== undefined && r[field] !== null && r[field] !== '') {
          const label = getFieldLabel(field);
          const value = formatFieldValue(field, r[field]);
          fieldsHTML += `<div class="kv"><label>${label}</label><div class="val">${value}</div></div>`;
        }
      });
      
      // 2. Resto de campos alfabéticamente
      const remainingFields = Object.keys(r)
        .filter(key => !excludeFields.includes(key) && !priorityFields.includes(key))
        .sort();
      
      remainingFields.forEach(field => {
        const value = r[field];
        if (value !== undefined && value !== null && value !== '') {
          const label = getFieldLabel(field);
          const formattedValue = formatFieldValue(field, value);
          const isLong = String(value).length > 50;
          fieldsHTML += `<div class="kv ${isLong ? 'full' : ''}"><label>${label}</label><div class="val">${formattedValue}</div></div>`;
        }
      });
      
      // 3. Ubicación geográfica
      if (r.geo_lat || r.geo_lng) {
        fieldsHTML += `<div class="kv full"><label>Ubicación</label><div class="val mono">${geoTxt}</div></div>`;
      }
      
      // 4. Imagen de evidencia
      let evidenciaHTML = '';
      if (r.image_proof_png) {
        evidenciaHTML = `
          <div class="kv full">
            <label>Evidencia</label>
            <div class="img-wrap"><img src="${r.image_proof_png}" alt="evidencia"/></div>
          </div>
        `;
      } else {
        // Si no tiene imagen, mostrar botón para generarla
        evidenciaHTML = `
          <div class="kv full">
            <label>Evidencia</label>
            <div class="val">
              <button onclick="generarEvidencia('${r._firestoreId}')" class="btn-generate-evidence">
                🖼️ Generar Imagen de Evidencia
              </button>
              <div id="evidence-container-${r._firestoreId}" style="margin-top: 16px;"></div>
            </div>
          </div>
        `;
      }
  
      box.innerHTML = `
        <div class="detail">
          ${fieldsHTML}
          ${evidenciaHTML}
        </div>
      `;
      document.getElementById('viewModal').showModal();
    }
    
    // Función auxiliar para obtener etiquetas legibles
    function getFieldLabel(field) {
      const labels = {
        ts: 'Fecha',
        encuestador_id: 'Encuestador',
        zona: 'Zona',
        zona_otro: 'Zona (Otro)',
        edad: 'Edad',
        sexo: 'Sexo',
        ocupacion: 'Ocupación',
        ocupacion_otro: 'Ocupación (Otro)',
        intencion: 'Intención (0-10)',
        usaMoto: '¿Usa moto?',
        moto_actual: 'Moto actual',
        uso: 'Uso principal',
        frecuencia: 'Frecuencia de uso',
        km_dia: 'Km por día',
        barreras: 'Barreras',
        marca: 'Marca considerada',
        marca_espontanea: 'Marca (espontánea)',
        marca_asistida: 'Marca (asistida)',
        awareness_omo: 'Awareness Omomobility',
        favorabilidad_omo: 'Favorabilidad Omomobility',
        comentarios: 'Comentarios',
        pago: 'Disposición a pagar',
        pago_mensual: 'Pago mensual',
        financia: 'Financiamiento',
        plazo: 'Plazo',
        enganche: 'Enganche',
        horizonte: 'Horizonte de compra',
        can_compra: 'Canal de compra',
        can_test_ride: 'Test ride',
        hogar: 'Vehículos en hogar',
        vehiculos: 'Vehículos',
        ingreso: 'Ingreso mensual',
        posee_cargador: 'Posee cargador',
        canales_info: 'Canales de información',
        fuente_conocimiento: 'Fuente de conocimiento',
        asociacion: 'Asociación con marca',
        motivos_no_compra: 'Motivos de no compra',
        mejoras_esperadas: 'Mejoras esperadas',
        precio_objetivo: 'Precio objetivo',
        // Atributos
        atr_precio: 'Atributo: Precio',
        atr_autonomia: 'Atributo: Autonomía',
        atr_tiempo_carga: 'Atributo: Tiempo de carga',
        atr_desempeno: 'Atributo: Desempeño',
        atr_diseno: 'Atributo: Diseño',
        atr_seguridad: 'Atributo: Seguridad',
        atr_garantia: 'Atributo: Garantía',
        atr_servicio: 'Atributo: Servicio',
        atr_refacciones: 'Atributo: Refacciones',
        atr_conectividad: 'Atributo: Conectividad',
        // Servicios
        svc_red: 'Servicio: Red de carga',
        svc_coste: 'Servicio: Costo',
        svc_tiempo_rep: 'Servicio: Tiempo de reparación',
        svc_ext_garantia: 'Servicio: Extensión de garantía',
        // Ambientales
        amb_motiva: 'Ambiental: Motivación',
        amb_ruido: 'Ambiental: Ruido',
        amb_ansiedad_autonomia: 'Ambiental: Ansiedad de autonomía',
        // Barreras extendidas
        barreras_ext: 'Barreras extendidas',
        geo_lat: 'Latitud',
        geo_lng: 'Longitud',
        geo_accuracy: 'Precisión GPS',
        geo_error: 'Error GPS'
      };
      return labels[field] || field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    
    // Función auxiliar para formatear valores
    function formatFieldValue(field, value) {
      if (value === null || value === undefined || value === '') {
        return '<span class="muted">—</span>';
      }
      
      // Fechas
      if (field === 'ts') {
        return fmtDate(value);
      }
      
      // Valores booleanos
      if (typeof value === 'boolean') {
        return value ? 'Sí' : 'No';
      }
      
      // Arrays o strings con pipe
      if (typeof value === 'string' && value.includes('|')) {
        return value.split('|').join(', ');
      }
      
      // Números
      if (typeof value === 'number') {
        return value.toLocaleString('es-MX');
      }
      
      // Strings largos
      if (typeof value === 'string' && value.length > 100) {
        return `<div style="max-height: 200px; overflow-y: auto;">${value}</div>`;
      }
      
      return value.toString();
    }

       // Abrir evidencia mostrando la encuesta completa con sus estilos
       window.openEvidence = async function(idx) {
        const r = state.filtered[idx];
        if (!r) return;
        
        const wrap = document.getElementById('imageWrap');
        
        // Generar HTML de la encuesta completa con los datos llenados
        wrap.innerHTML = `
          <div class="phone-frame">
            <div class="phone-header">
              <div class="phone-notch"></div>
              <div class="phone-status">
                <span>📶 5G</span>
                <span>${new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                <span>🔋 85%</span>
              </div>
            </div>
            <div class="phone-content">
              <iframe id="survey-preview" style="width: 100%; height: 600px; border: none;"></iframe>
            </div>
            <div class="phone-footer">
              <div class="phone-button"></div>
            </div>
          </div>
          <div class="evidence-metadata">
            <div><strong>Encuestador:</strong> ${r.encuestador_id || '—'}</div>
            <div><strong>Fecha:</strong> ${fmtDate(r.ts)}</div>
            <div><strong>Ubicación:</strong> ${fmtGeo(r)}</div>
            <div><strong>ID:</strong> ${r._firestoreId || '—'}</div>
          </div>
        `;
    
        // Cargar encuesta.html en el iframe y llenar con datos
        const iframe = document.getElementById('survey-preview');
        iframe.onload = function() {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
          
          // Llenar todos los campos del formulario con los datos
          Object.keys(r).forEach(key => {
            const value = r[key];
            if (!value || key.startsWith('_') || key === 'image_proof_png') return;
            
            // Buscar el campo en el iframe
            const field = iframeDoc.querySelector(`[name="${key}"]`);
            if (!field) return;
            
            if (field.type === 'checkbox') {
              // Para checkboxes múltiples
              const values = String(value).split('|');
              iframeDoc.querySelectorAll(`[name="${key}"]`).forEach(cb => {
                if (values.includes(cb.value)) cb.checked = true;
              });
            } else if (field.type === 'radio') {
              // Para radios
              const radio = iframeDoc.querySelector(`[name="${key}"][value="${value}"]`);
              if (radio) radio.checked = true;
            } else {
              // Para inputs normales, selects, textareas
              field.value = value;
            }
          });
          
          // Deshabilitar todos los campos (solo lectura)
          iframeDoc.querySelectorAll('input, select, textarea, button').forEach(el => {
            el.disabled = true;
            el.style.pointerEvents = 'none';
          });
          
          // Agregar marca de agua
          const watermark = iframeDoc.createElement('div');
          watermark.style.cssText = 'position: fixed; top: 10px; right: 10px; background: rgba(102, 126, 234, 0.9); color: white; padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: bold; z-index: 9999;';
          watermark.textContent = '📋 EVIDENCIA - SOLO LECTURA';
          iframeDoc.body.appendChild(watermark);
        };
        
        iframe.src = 'encuesta.html';
    
        document.getElementById('img_encuestador').textContent = r.encuestador_id || '—';
        document.getElementById('img_fecha').textContent = fmtDate(r.ts);
        document.getElementById('img_geo').textContent = 
          (r.geo_lat != null && r.geo_lng != null)
            ? `${Number(r.geo_lat).toFixed(5)}, ${Number(r.geo_lng).toFixed(5)}${r.geo_accuracy != null ? ' ±' + Math.round(r.geo_accuracy) + 'm' : ''}`
            : 'N/A';
    
        document.getElementById('imageModal').showModal();
      }
    
       
      // Generar evidencia y mostrarla
      window.generateAndShowEvidence = async function(idx) {
        const r = state.filtered[idx];
        if (!r) return;
        
        try {
          // Generar imagen
          const imageDataUrl = await generateEvidenceFromData(r);
          
          // Guardar en Firestore si está disponible
          if (window.db && r._firestoreId) {
            await window.db.collection('surveys').doc(r._firestoreId).update({
              image_proof_png: imageDataUrl
            });
          }
          
          // Actualizar en memoria
          r.image_proof_png = imageDataUrl;
          const originalRecord = state.all.find(rec => rec._firestoreId === r._firestoreId);
          if (originalRecord) originalRecord.image_proof_png = imageDataUrl;
          
          // Refrescar tabla
          render();
          updateFirebaseStats();
          
          // Abrir modal
          openEvidence(idx);
        } catch (error) {
          console.error('Error generando evidencia:', error);
          alert('❌ Error al generar imagen: ' + error.message);
        }
      }
      
      // Función legacy (mantener por compatibilidad)
      function openImage(r) {
        const idx = state.filtered.indexOf(r);
        if (idx >= 0) openEvidence(idx);
      }


    function openEdit(r) {
      const idx = state.all.indexOf(r);
      state.editIndex = idx;
      document.getElementById('edit_edad').value = r.edad ?? '';
      document.getElementById('edit_intencion').value = r.intencion ?? '';
      document.getElementById('edit_zona').value = r.zona ?? '';
      document.getElementById('edit_comentarios').value = r.comentarios ?? '';
      document.getElementById('editModal').showModal();
    }
  
    // ==================== OPERACIONES CRUD ====================
  
    async function doDelete(r) {
      if (!confirm('¿Eliminar esta encuesta? Esta acción no se puede deshacer.')) return;
      
      console.group('🗑️ Intentando eliminar encuesta');
      console.log('Registro a eliminar:', r);
      
      let removedFromFirestore = false;
  
      if (window.db) {
        try {
          if (r._firestoreId) {
            console.log('Usando _firestoreId:', r._firestoreId);
            await window.db.collection('surveys').doc(r._firestoreId).delete();
            removedFromFirestore = true;
            console.log('✓ Eliminado de Firestore');
          } else if (r._createdAt) {
            const snap = await window.db.collection('surveys')
              .where('_createdAt', '==', r._createdAt)
              .limit(1)
              .get();
            
            if (!snap.empty) {
              await snap.docs[0].ref.delete();
              removedFromFirestore = true;
              console.log('✓ Eliminado de Firestore usando query');
            }
          }
        } catch (e) {
          console.error('Error eliminando:', e);
          alert(`Error al eliminar: ${e.message}`);
        }
      }
      
      console.groupEnd();
      
      if (removedFromFirestore) {
        loadData();
        alert('Encuesta eliminada exitosamente');
      } else {
        alert('No se pudo eliminar la encuesta.');
      }
    }
  
    async function saveEdit() {
      const idx = state.editIndex;
      if (idx == null || idx < 0) { 
        document.getElementById('editModal').close(); 
        return; 
      }
      
      const ref = state.all[idx];
      if (!ref || !ref._firestoreId) {
        alert('No se pudo identificar la encuesta para editar.');
        return;
      }
  
      try {
        const edad = Number(document.getElementById('edit_edad').value);
        const intencion = Number(document.getElementById('edit_intencion').value);
        const zona = document.getElementById('edit_zona').value;
        const comentarios = document.getElementById('edit_comentarios').value;
  
        if (!window.db) {
          throw new Error('Firebase no disponible');
        }
  
        await window.db.collection('surveys').doc(ref._firestoreId).update({
          edad: edad || ref.edad,
          intencion: intencion || ref.intencion,
          zona: zona || ref.zona,
          comentarios: comentarios || ref.comentarios,
          _updatedAt: new Date().toISOString()
        });
  
        console.log('✓ Encuesta actualizada en Firestore');
        document.getElementById('editModal').close();
        loadData();
        alert('Cambios guardados exitosamente.');
      } catch (err) {
        console.error('Error al actualizar:', err);
        alert(`Error al guardar cambios: ${err.message}`);
      }
    }
  
    // ==================== INICIALIZACIÓN ====================
  
    function watchRoleReady() {
      let tries = 0;
      const iv = setInterval(() => {
        const prev = state.role;
        loadSession();
        if (state.role !== prev) {
          render();
        }
        if (state.role === 'admin' || state.role === 'supervisor' || ++tries >= 10) {
          clearInterval(iv);
        }
      }, 300);
    }
  
    function init() {
        if (window.AuthSystem && typeof AuthSystem.checkAuthOnProtectedPages === 'function') {
          AuthSystem.checkAuthOnProtectedPages();
        }
    
        loadSession();
        loadData();
        wireEvents();
        watchRoleReady();
    
        if (!canView(state.role)) {
          alert('No tienes permisos para acceder.');
          window.location.href = 'login.html';
        }
      }
    
      // Exponer API pública para que otros scripts puedan acceder
      window.ListaEncuestas = {
        loadData,
        state
      };
    
      // Inicialización
      document.addEventListener('DOMContentLoaded', init);
    })();