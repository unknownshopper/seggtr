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
});
