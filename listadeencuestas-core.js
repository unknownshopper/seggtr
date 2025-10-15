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
          if (d._probe) return; // omitir registros de prueba
  
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
      
      const withImages = state.all.filter(r => r.image_proof_png).length;
      
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
      surveyBar.style.width = `${surveyPercent}%`;
      surveyBar.className = 'progress-fill';
      if (surveyPercent > 80) surveyBar.classList.add('danger');
      else if (surveyPercent > 60) surveyBar.classList.add('warning');
      
      const storageBar = document.getElementById('progress-storage');
      storageBar.style.width = `${Math.min(storagePercent, 100)}%`;
      storageBar.className = 'progress-fill';
      if (storagePercent > 80) storageBar.classList.add('danger');
      else if (storagePercent > 60) storageBar.classList.add('warning');
      
      console.log(`[Stats] Total: ${total}, Storage: ${estimatedMB}MB, Images: ${withImages}`);
    }
  
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
              ? `<img class="thumb" src="${r.image_proof_png}" alt="evidencia" data-action="evidence" data-idx="${idx}" />`
              : `<span class="muted">Sin imagen</span>`}
          </td>
          <td><div class="actions">${actions.join('')}</div></td>
        `;
        tbody.appendChild(tr);
      });
  
      document.getElementById('pageInfo').textContent = `Página ${state.page} de ${pages}`;
      document.getElementById('countInfo').textContent = `${total} encuestas (mostrando máx. ${MAX})`;
      document.getElementById('prev').disabled = state.page <= 1;
      document.getElementById('next').disabled = state.page >= pages;
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
  
    // ==================== MODALES ====================
  
    function openView(r) {
      const box = document.getElementById('detail');
      const geoTxt = fmtGeo(r);
  
      box.innerHTML = `
        <div class="detail">
          <div class="kv"><label>Fecha</label><div class="val">${fmtDate(r.ts)}</div></div>
          <div class="kv"><label>Encuestador</label><div class="val">${r.encuestador_id || '<span class="muted">N/A</span>'}</div></div>
          <div class="kv"><label>Zona</label><div class="val">${r.zona || '<span class="muted">N/A</span>'}</div></div>
          <div class="kv"><label>Edad</label><div class="val">${r.edad ?? ''}</div></div>
          <div class="kv"><label>Intención (0–10)</label><div class="val">${r.intencion ?? ''}</div></div>
          <div class="kv"><label>Ubicación</label><div class="val mono">${geoTxt}</div></div>
          <div class="kv full"><label>Comentarios</label><div class="val">${(r.comentarios || '').toString() || '<span class="muted">—</span>'}</div></div>
          <div class="kv full"><label>Barreras</label><div class="val">${(r.barreras || '').toString() || '<span class="muted">—</span>'}</div></div>
          <div class="kv"><label>Marca considerada</label><div class="val">${(r.marca || '').toString() || '<span class="muted">—</span>'}</div></div>
          <div class="kv"><label>Awareness OMO</label><div class="val">${(r.awareness_omo || '').toString() || '<span class="muted">—</span>'}</div></div>
          ${r.image_proof_png ? `
            <div class="kv full">
              <label>Evidencia</label>
              <div class="img-wrap"><img src="${r.image_proof_png}" alt="evidencia"/></div>
            </div>
          ` : ''}
        </div>
      `;
      document.getElementById('viewModal').showModal();
    }
  
    function openImage(r) {
      const wrap = document.getElementById('imageWrap');
      wrap.innerHTML = r.image_proof_png
        ? `<img src="${r.image_proof_png}" alt="Evidencia"/>`
        : '<div class="muted">Sin imagen</div>';
  
      document.getElementById('img_encuestador').textContent = r.encuestador_id || '—';
      document.getElementById('img_fecha').textContent = fmtDate(r.ts);
      document.getElementById('img_geo').textContent =
        (r.geo_lat != null && r.geo_lng != null)
          ? `${Number(r.geo_lat).toFixed(5)}, ${Number(r.geo_lng).toFixed(5)}${r.geo_accuracy != null ? ' ±' + Math.round(r.geo_accuracy) + 'm' : ''}`
          : 'N/A';
  
      document.getElementById('imageModal').showModal();
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