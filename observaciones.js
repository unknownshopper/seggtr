document.addEventListener('DOMContentLoaded', () => {
  // Print button
  const btnPrint = document.getElementById('btn-print');
  if (btnPrint) btnPrint.addEventListener('click', () => window.print());

  // Footer date
  const d = new Date();
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  const yyyy = d.getFullYear();
  const el = document.getElementById('generated');
  if (el) el.textContent = `${dd}/${mm}/${yyyy}`;

  // Lightbox / Carousel
  const grid = document.querySelector('.gallery-grid');
  const thumbs = grid ? Array.from(grid.querySelectorAll('.gallery-item img')) : [];
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbCaption = document.getElementById('lb-caption');
  const lbCur = document.getElementById('lb-current');
  const lbTot = document.getElementById('lb-total');
  let idx = 0;

  if (!lb || !lbImg || !lbCaption || !lbCur || !lbTot || thumbs.length === 0) return;
  lbTot.textContent = String(thumbs.length);

  const openAt = (i) => {
    idx = (i + thumbs.length) % thumbs.length;
    const t = thumbs[idx];
    lbImg.src = t.src; // resolved src
    lbCaption.textContent = t.closest('figure')?.querySelector('figcaption')?.textContent || '';
    lbCur.textContent = String(idx + 1);
    lb.classList.remove('hidden');
    lb.setAttribute('aria-hidden','false');
    document.body.style.overflow = 'hidden';
  };

  const close = () => {
    lb.classList.add('hidden');
    lb.setAttribute('aria-hidden','true');
    document.body.style.overflow = '';
  };

  const next = () => openAt(idx + 1);
  const prev = () => openAt(idx - 1);

  // Delegate click from grid (more robust)
  if (grid) {
    grid.addEventListener('click', (e) => {
      const img = e.target.closest('.gallery-item img');
      if (!img) return;
      const i = thumbs.indexOf(img);
      if (i >= 0) openAt(i);
    });
  }

  // Delegate buttons and backdrop
  lb.addEventListener('click', (e) => {
    const a = e.target.getAttribute('data-action');
    if (a === 'close') close();
    else if (a === 'next') next();
    else if (a === 'prev') prev();
  });

  // Keyboard navigation
  document.addEventListener('keydown', (e) => {
    if (lb.classList.contains('hidden')) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') next();
    else if (e.key === 'ArrowLeft') prev();
  });

  // Touch swipe
  let startX = 0, startY = 0, swiping = false;
  const onStart = (e) => {
    const t = e.touches ? e.touches[0] : e;
    startX = t.clientX; startY = t.clientY; swiping = true;
  };
  const onMove = (e) => { if (!swiping) return; };
  const onEnd = (e) => {
    if (!swiping) return; swiping = false;
    const t = e.changedTouches ? e.changedTouches[0] : e;
    const dx = t.clientX - startX; const dy = t.clientY - startY;
    if (Math.abs(dx) > 40 && Math.abs(dy) < 60) { dx < 0 ? next() : prev(); }
  };
  lb.addEventListener('touchstart', onStart, { passive:true });
  lb.addEventListener('touchmove', onMove, { passive:true });
  lb.addEventListener('touchend', onEnd, { passive:true });

  // ===== ROI Calculators =====
  const ROI1_STORE_KEY = 'observaciones_roi_basico_v1';
  const ROI2_STORE_KEY = 'observaciones_roi_completo_v1';

  // ROI Básico (Solo Ventas)
  function calculateROI1() {
    const params = {
      inversion: parseFloat(document.getElementById('roi1-inversion').value) || 500000,
      margen: parseFloat(document.getElementById('roi1-margen').value) || 8000,
      ventas: parseFloat(document.getElementById('roi1-ventas').value) || 5,
      fijos: parseFloat(document.getElementById('roi1-fijos').value) || 60000
    };
    
    localStorage.setItem(ROI1_STORE_KEY, JSON.stringify(params));
    
    const utilidad = (params.margen * params.ventas) - params.fijos;
    const equilibrio = params.margen > 0 ? (params.fijos / params.margen) : 0;
    const payback = utilidad > 0 ? (params.inversion / utilidad) : Infinity;

    document.getElementById('roi1-utilidad').textContent = `$${utilidad.toLocaleString('es-MX')}`;
    document.getElementById('roi1-equilibrio').textContent = `${equilibrio.toFixed(1)} motos`;
    document.getElementById('roi1-payback').textContent = 
      payback === Infinity ? "—" : `${payback.toFixed(1)} meses`;
  }

  // ROI Completo (Venta + Taller)
  function calculateROI2() {
    const params = {
      inversion: parseFloat(document.getElementById('roi2-inversion').value) || 700000,
      margen: parseFloat(document.getElementById('roi2-margen').value) || 8000,
      servicios: parseFloat(document.getElementById('roi2-servicios').value) || 15000,
      ventas: parseFloat(document.getElementById('roi2-ventas').value) || 5,
      fijos: parseFloat(document.getElementById('roi2-fijos').value) || 80000
    };
    
    localStorage.setItem(ROI2_STORE_KEY, JSON.stringify(params));
    
    const utilidad = (params.margen * params.ventas) + params.servicios - params.fijos;
    const payback = utilidad > 0 ? (params.inversion / utilidad) : Infinity;
    const roiAnual = utilidad > 0 ? ((utilidad * 12 / params.inversion) * 100) : 0;

    document.getElementById('roi2-utilidad').textContent = 
      utilidad > 0 ? `$${utilidad.toLocaleString('es-MX')}` : `-$${Math.abs(utilidad).toLocaleString('es-MX')}`;
    document.getElementById('roi2-payback').textContent = 
      payback === Infinity ? "—" : `${payback.toFixed(1)} meses`;
    document.getElementById('roi2-anual').textContent = 
      utilidad > 0 ? `${roiAnual.toFixed(1)}%` : `-${Math.abs(roiAnual).toFixed(1)}%`;
  }

  // Inicialización
  function initROIs() {
    // Cargar valores guardados
    const params1 = JSON.parse(localStorage.getItem(ROI1_STORE_KEY) || '{}');
    const params2 = JSON.parse(localStorage.getItem(ROI2_STORE_KEY) || '{}');
    
    // ROI Básico
    ['inversion', 'margen', 'ventas', 'fijos'].forEach(id => {
      const el = document.getElementById(`roi1-${id}`);
      if (el && params1[id]) el.value = params1[id];
      el?.addEventListener('input', calculateROI1);
    });
    
    // ROI Completo
    ['inversion', 'margen', 'servicios', 'ventas', 'fijos'].forEach(id => {
      const el = document.getElementById(`roi2-${id}`);
      if (el && params2[id]) el.value = params2[id];
      el?.addEventListener('input', calculateROI2);
    });
    
    // Calcular inicialmente
    calculateROI1();
    calculateROI2();
  }

  // Iniciar al cargar la página
  initROIs();
});
