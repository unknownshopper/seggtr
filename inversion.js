(function(){
  if (window.__inversion_init__) return; // singleton guard
  window.__inversion_init__ = true;

  const state = { data: [], zones: [], chart: null, quickChart: null };

  async function awaitFirebaseReady(timeoutMs=8000){
    if (window.firebaseReady) return true;
    return new Promise(resolve=>{
      const to = setTimeout(()=>resolve(false), timeoutMs);
      window.addEventListener('firebaseReady', ()=>{ clearTimeout(to); resolve(true); }, { once:true });
    });
  }

  async function ensureAnonSignIn(){
    if (!window.fbAuth) return false;
    try {
      if (!window.fbAuth.currentUser) {
        const cred = await window.fbAuth.signInAnonymously();
        const ok = !!(window.fbAuth.currentUser || cred?.user);
        if (!ok) console.warn('[inversion] Anonymous sign-in did not yield a user');
        return ok;
      }
      return true;
    } catch(e) {
      console.warn('[inversion] Anonymous sign-in failed:', e?.code || e);
      window.dispatchEvent(new CustomEvent('inversionAuthError', { detail: { code: e?.code || 'unknown' } }));
      return false;
    }
  }

  function showBlockedNotice(reason){
    try {
      const ds = document.getElementById('dataSource');
      const lu = document.getElementById('lastUpdated');
      if (ds) ds.textContent = 'Permisos requeridos';
      if (lu) lu.textContent = reason || 'Lecturas bloqueadas por reglas (habilita Anonymous en Firebase Auth)';
    } catch(_) {}
  }

  async function loadData() {
    // Prefer Firestore if available
    try {
      if (window.db) {
        const ready = await awaitFirebaseReady();
        let authed = !!(window.fbAuth && window.fbAuth.currentUser);
        if (!authed) {
          authed = await ensureAnonSignIn();
          if (!authed) {
            showBlockedNotice('No autenticado. Habilita Anonymous en Firebase Auth o inicia sesión.');
            return { src: 'Bloqueado', rows: [] };
          }
        }
        console.log('[inversion] Firestore read started', {
          projectId: (firebase?.app?.()?.options?.projectId) || 'unknown',
          authed: !!(window.fbAuth && window.fbAuth.currentUser),
          user: window.fbAuth?.currentUser?.email || window.fbAuth?.currentUser?.uid || null
        });
        const snap = await window.db.collection('surveys').limit(250).get();
        console.log('[inversion] Firestore snapshot size:', snap?.size ?? 'n/a');
        const rows = [];
        snap.forEach(doc=>{ const d=doc.data()||{}; rows.push({...d}); });
        if (rows && rows.length) return { src:'Firestore', rows };
        console.warn('[inversion] Firestore reachable pero sin documentos en \"surveys\"');
      }
    } catch(e) { console.warn('[inversion] Firestore fetch error:', e?.message || e); }

    // Fallbacks
    try {
      if (window.DataManager && typeof window.DataManager.readAll==='function') {
        const rows = window.DataManager.readAll();
        if (rows && rows.length) return { src:'DataManager', rows };
      }
    } catch(e) { /* ignore */ }
    try {
      const rows = JSON.parse(localStorage.getItem('encuestas')||'[]');
      if (rows && rows.length) return { src:'localStorage', rows };
    } catch(e) { /* ignore */ }
    return { src:'sin datos', rows: [] };
  }

  function valAwareness(v){ return v==='La conozco' || v==='Me suena'; }
  function valFavFavorable(v){ return v===5||v===6||v===7||v==='5'||v==='6'||v==='7'; }
  function valFavNeutral(v){ return v===3||v===4||v==='3'||v==='4'||v==='Neutral'; }
  function toZoneKey(z){ return (z||'Sin especificar').toString().trim(); }

  function preprocess(rows){
    return (rows||[]).map(r=>({
      zona: toZoneKey(r.zona),
      intencion: Number.parseFloat(r.intencion),
      awareness_omo: r.awareness_omo,
      favorabilidad_omo: r.favorabilidad_omo,
      usa_moto: r.usa_moto ?? r.usaMoto ?? '',
    }));
  }

  function loadSecurityMap(){
    try { return JSON.parse(localStorage.getItem('security_zone_scores')||'{}'); } catch(_) { return {}; }
  }
  function getSecurityScore(zone){
    const map = loadSecurityMap();
    const v = map[zone];
    const n = Number.parseFloat(v);
    if (Number.isFinite(n) && n>=0 && n<=1) return n;
    return 0.5;
  }

  function computeZones(data){
    const acc = {};
    for (const d of data){
      const z = toZoneKey(d.zona);
      if (!acc[z]) acc[z] = { zona:z, n:0, sumInt:0, aware:0, favGood:0, favNeutral:0, favBad:0, usa:0 };
      const a = acc[z];
      const inten = Number.isFinite(d.intencion)? d.intencion: NaN;
      if (!Number.isNaN(inten)) { a.sumInt += inten; a.n += 1; }
      if (valAwareness(d.awareness_omo)) a.aware += 1;
      const f = d.favorabilidad_omo;
      if (valFavFavorable(f)) a.favGood += 1; else if (valFavNeutral(f)) a.favNeutral += 1; else if (f!=null) a.favBad += 1;
      const use = (d.usa_moto===true||d.usa_moto==='Sí'||d.usa_moto==='Si'||d.usa_moto==='si'||d.usa_moto==='sí'||d.usa_moto==='SI')?1:0;
      a.usa += use;
    }
    const res = Object.values(acc).map(a=>{
      const avgInt = a.n? a.sumInt/a.n : 0;
      const sInt = Math.max(0, Math.min(1, avgInt/10));
      const sAware = a.n? a.aware/a.n : 0;
      const sFav = a.n? a.favGood/Math.max(1,(a.favGood+a.favNeutral+a.favBad)) : 0;
      const sSize = Math.min(a.n,50)/50;
      const sSec = getSecurityScore(a.zona);
      let score = 0.45*sInt + 0.18*sAware + 0.18*sFav + 0.07*sSize + 0.12*sSec;
      if (a.n<20) score *= 0.8;
      const usaPct = a.n? (a.usa/a.n) : 0;
      return { zona:a.zona, n:a.n, avgInt, awarePct:sAware, favPct:sFav, usaPct, sec:sSec, score };
    }).sort((x,y)=> y.score - x.score);
    return res;
  }

  function fmtPct(x){ return (x*100).toFixed(0)+'%'; }
  function fmt1(x){ return (Math.round(x*10)/10).toFixed(1); }

  function renderKpis(zones){
    const total = state.data.length;
    const z = zones.length;
    const best = zones[0];
    const el = document.getElementById('kpis');
    if (!el) return;
    el.innerHTML = '';
    const items = [
      `Total encuestas: ${total}`,
      `Zonas analizadas: ${z}`,
      best? `Mejor zona: ${best.zona}`: ''
    ].filter(Boolean);
    items.forEach(t=>{ const s=document.createElement('span'); s.textContent=t; el.appendChild(s); });
  }

  function renderRows(zones){
    const tbody = document.getElementById('rows');
    if (!tbody) return;
    tbody.innerHTML = '';
    zones.forEach((z,i)=>{
      const tr = document.createElement('tr');
      const badgeClass = z.n>=20? (z.score>=0.6? 'b-good':'b-mid') : 'b-warn';
      tr.innerHTML = `
        <td><span class="rank">${i+1}</span></td>
        <td>${z.zona}</td>
        <td><span class="badge ${badgeClass}">${fmt1(z.score)}</span></td>
        <td>${fmt1(z.avgInt)}</td>
        <td>${z.n}</td>
        <td>${fmtPct(z.awarePct)}</td>
        <td>${fmtPct(z.favPct)}</td>
        <td>${fmtPct(z.sec)}</td>
        <td>${fmtPct(z.usaPct)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderQuickChart(zones){
    const canvas = document.getElementById('chartQuick');
    if (!canvas || typeof Chart==='undefined') return;
    // fixed size to avoid layout thrash
    canvas.width = canvas.clientWidth || 600;
    canvas.height = 320;

    if (state.quickChart) { try { state.quickChart.destroy(); } catch(_){} state.quickChart=null; }
    const top = zones.slice(0,3);
    if (!top.length) return;
    const maxN = Math.max(...zones.map(z=>z.n||0), 1);

    const labels = ['Score','Intención','Awareness','Favorabilidad','Seguridad','n relativo'];
    const colors = ['#1d4ed8', '#059669', '#9333ea'];
    const datasets = top.map((z,idx)=>({
      label: z.zona,
      data: [
        Number.parseFloat(fmt1(z.score)),
        Math.max(0, Math.min(1, z.avgInt/10)),
        z.awarePct,
        z.favPct,
        z.sec,
        Math.max(0, Math.min(1, (z.n||0)/maxN))
      ],
      borderColor: colors[idx%colors.length],
      backgroundColor: colors[idx%colors.length]+'33',
      pointRadius: 3,
      fill: true
    }));

    state.quickChart = new Chart(canvas, {
      type: 'bar',
      data: { labels, datasets },
      options: {
        responsive: false,
        animation: false,
        maintainAspectRatio: false,
        indexAxis: 'x',
        scales: {
          y: { beginAtZero: true, min: 0, max: 1, ticks: { stepSize: 0.2 } },
          x: { stacked: false }
        },
        plugins: { legend: { position: 'top' } }
      }
    });
  }

  function renderExecReco(zones){
    const el = document.getElementById('execReco');
    if (!el) return;
    if (!zones || !zones.length) { el.textContent = 'Sin datos disponibles para recomendar ubicación.'; return; }
    const best = zones[0];

    // Exposición/flujo: usar n como proxy relativo al máximo de la muestra
    const maxN = Math.max(...zones.map(z => z.n || 0), 0) || 1;
    const exposureRatio = Math.max(0, Math.min(1, best.n / maxN));
    const exposureLabel = exposureRatio >= 0.7 ? 'alto flujo de personas (gran exposición)'
                        : exposureRatio >= 0.4 ? 'flujo medio de personas'
                        : 'flujo bajo de personas';

    const caveats = [];
    if (best.n < 20) caveats.push('reforzar muestra (n<20)');
    if (best.awarePct < 0.4) caveats.push('impulsar awareness local');
    if (best.favPct < 0.5) caveats.push('trabajar favorabilidad (postventa/garantía)');

    const kpis = [`Intención ${fmt1(best.avgInt)}`, `Awareness ${fmtPct(best.awarePct)}`, `Favorable ${fmtPct(best.favPct)}`, `n ${best.n}`].join(' · ');
    el.innerHTML = `Sugerimos priorizar <strong>${best.zona}</strong> para instalar tienda y taller, dado su <strong>score ${fmt1(best.score)}</strong> con ${kpis} y <strong>${exposureLabel}</strong> (según n). ${caveats.length? `Recomendación: ${caveats.join('; ')}.` : ''}`;
  }

  function renderChart(zones){
    const canvas = document.getElementById('chartTop');
    if (!canvas || typeof Chart==='undefined') return;
    // fixed size to avoid layout thrash
    canvas.width = canvas.clientWidth || 600;
    canvas.height = 320;

    if (state.chart) { try { state.chart.destroy(); } catch(_){} state.chart=null; }
    const top = zones.slice(0,5);
    state.chart = new Chart(canvas,{
      type:'bar',
      data:{
        labels: top.map(x=>x.zona),
        datasets:[{label:'Score',data:top.map(x=>Number.parseFloat(fmt1(x.score))), backgroundColor:'#4f46e5'}]
      },
      options:{
        responsive:false,
        animation:false,
        maintainAspectRatio:false,
        indexAxis:'y',
        scales:{ x:{ beginAtZero:true, max:1 } },
        plugins:{ legend:{display:false} }
      }
    });
  }

  function setMeta(src){
    const ds = document.getElementById('dataSource');
    const tr = document.getElementById('totalResp');
    const lu = document.getElementById('lastUpdated');
    if (ds) ds.textContent = `Fuente: ${src}`;
    if (tr) tr.textContent = `Encuestas: ${state.data.length}`;
    if (lu) lu.textContent = `Actualizado: ${new Date().toLocaleString()}`;
  }

  // ===== ROI helpers =====
  const ROI_STORE_KEY = 'inversion_roi_params_v1';
  const money = (n)=>{
    if (!Number.isFinite(n)) return '—';
    try { return new Intl.NumberFormat('es-MX', { style:'currency', currency:'MXN', maximumFractionDigits:0 }).format(n); } catch(_) { return `$${Math.round(n)}`; }
  };
  const num = (v, def=0)=>{ const n = Number.parseFloat(v); return Number.isFinite(n)? n : def; };

  function loadRoiParams(){
    try { return JSON.parse(localStorage.getItem(ROI_STORE_KEY)||'{}'); } catch(_) { return {}; }
  }
  function saveRoiParams(p){
    try { localStorage.setItem(ROI_STORE_KEY, JSON.stringify(p||{})); } catch(_) {}
  }

  function readInputs(){
    const p = loadRoiParams();
    const get = (id, fallback)=>{
      const el = document.getElementById(id);
      if (!el) return num(p[id], fallback);
      const v = el.value?.trim();
      return v===''? num(p[id], fallback) : num(v, fallback);
    };
    return {
      'inp-precio': get('inp-precio', 35000),
      'inp-cogs': get('inp-cogs', 26000),
      'inp-cac': get('inp-cac', 1500),
      'inp-volumen': get('inp-volumen', 10),
      'inp-fijos': get('inp-fijos', 30000),
      'inp-inversion': get('inp-inversion', 300000),
    };
  }

  function writeInputs(p){
    const set = (id, val)=>{ const el=document.getElementById(id); if (el && (el.value===''||el.value==null)) el.value = String(val); };
    set('inp-precio', p['inp-precio']);
    set('inp-cogs', p['inp-cogs']);
    set('inp-cac', p['inp-cac']);
    set('inp-volumen', p['inp-volumen']);
    set('inp-fijos', p['inp-fijos']);
    set('inp-inversion', p['inp-inversion']);
  }

  function calcAndRenderROI(){
    const p = readInputs();
    // persist current values
    saveRoiParams(p);

    const precio = p['inp-precio'];
    const cogs = p['inp-cogs'];
    const cac = p['inp-cac'];
    const volumen = p['inp-volumen'];
    const fijos = p['inp-fijos'];
    const inversion = p['inp-inversion'];

    const margenUnit = Math.max(0, precio - cogs - cac);
    const contribMes = margenUnit * volumen - fijos;
    const eps = 1e-6;
    const bepUnits = margenUnit>eps ? (fijos / margenUnit) : Infinity;
    const paybackMeses = contribMes>eps ? (inversion / contribMes) : Infinity;
    const roiAnual = inversion>eps ? ((contribMes*12) / inversion) : NaN;

    const setTxt = (id, txt)=>{ const el=document.getElementById(id); if (el) el.textContent = txt; };
    setTxt('roi-margen-unit', money(margenUnit));
    setTxt('roi-contrib-mes', money(contribMes));
    setTxt('roi-bep-units', Number.isFinite(bepUnits)? bepUnits.toFixed(1)+' u/mes' : '—');
    setTxt('roi-payback', Number.isFinite(paybackMeses)? paybackMeses.toFixed(1)+' meses' : '—');
    setTxt('roi-annual', Number.isFinite(roiAnual)? (roiAnual*100).toFixed(0)+'%' : '—');
  }

  function bindRoiInputs(){
    const ids = ['inp-precio','inp-cogs','inp-cac','inp-volumen','inp-fijos','inp-inversion'];
    ids.forEach(id=>{
      const el = document.getElementById(id);
      if (!el) return;
      const handler = ()=> calcAndRenderROI();
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    });
  }

  async function init(){
    try {
      const {src, rows} = await loadData();
      state.data = preprocess(rows);
      setMeta(src);
      state.zones = computeZones(state.data);
      // slight defer to allow layout to settle
      renderKpis(state.zones);
      renderRows(state.zones);
      renderExecReco(state.zones);
      setTimeout(()=>{
        renderChart(state.zones);
        renderQuickChart(state.zones);
      }, 0);

      // ROI: inicializar inputs desde storage, enlazar y calcular
      writeInputs(readInputs());
      bindRoiInputs();
      calcAndRenderROI();
    } catch (e) {
      console.error('Init error (inversion):', e);
    }
  }

  window.addEventListener('DOMContentLoaded', init, { once:true });
  window.addEventListener('beforeunload', ()=>{
    if (state.chart) { try{ state.chart.destroy(); }catch(_){} }
    if (state.quickChart) { try{ state.quickChart.destroy(); }catch(_){} }
  });
})();
