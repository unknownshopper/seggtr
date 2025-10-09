// Dashboard Manager
class DashboardManager {
  constructor() {
    this.data = [];
    this.charts = {};
    this.init();
  }

  init() {
    this.loadData();
    this.setupEventListeners();
    this.renderDashboard();
    this.updateLastUpdateTime();
  }

  loadData() {
    // Intenta Firestore primero
    if (window.db) {
      this.fetchFromFirestore().then(rows => {
        if (Array.isArray(rows) && rows.length) {
          this.data = this.preprocessData(rows);
        } else {
          // Fallback a localStorage si no hay datos en Firestore
          try {
            if (window.DataManager && typeof DataManager.readAll === 'function') {
              this.data = this.preprocessData(DataManager.readAll());
            } else {
              this.data = this.preprocessData(JSON.parse(localStorage.getItem('encuestas') || '[]'));
            }
          } catch (e) {
            this.data = [];
          }
        }
        // Render tras cargar
        this.renderDashboard();
        this.updateLastUpdateTime();
      }).catch(() => {
        // Si falla Firestore, fallback a localStorage
        try {
          if (window.DataManager && typeof DataManager.readAll === 'function') {
            this.data = this.preprocessData(DataManager.readAll());
          } else {
            this.data = this.preprocessData(JSON.parse(localStorage.getItem('encuestas') || '[]'));
          }
        } catch (e) {
          this.data = [];
        }
        this.renderDashboard();
        this.updateLastUpdateTime();
      });
    } else {
      // Sin Firestore disponible: localStorage
      try {
        if (window.DataManager && typeof DataManager.readAll === 'function') {
          this.data = this.preprocessData(DataManager.readAll());
        } else {
          this.data = this.preprocessData(JSON.parse(localStorage.getItem('encuestas') || '[]'));
        }
      } catch (e) {
        this.data = [];
      }
      this.renderDashboard();
      this.updateLastUpdateTime();
    }
  }

  async fetchFromFirestore() {
    try {
      const colRef = window.db.collection('surveys');
      // const snap = await colRef.orderBy('_createdAt', 'desc').limit(250).get();
      const snap = await colRef.limit(250).get();
      const rows = [];
      snap.forEach(doc => {
        const d = doc.data() || {};
        if (d._probe) return;
  
        rows.push({
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
      return rows;
    } catch (e) {
      console.warn('Firestore read failed:', e?.message || e);
      return [];
    }
  }

  preprocessData(rows) {
    return (rows || []).map(r => {
      // Coerciones numéricas seguras
      const edad = Number.parseInt(r.edad);
      const intencion = Number.parseInt(r.intencion);
  
      // Normalizaciones de texto
      const zona = (r.zona || 'Sin especificar').toString().trim();
      const ocupacion = (r.ocupacion || 'Sin especificar').toString().trim();
  
      // Normaliza usaMoto a 'Sí'/'No'
      let usaMoto = r.usaMoto;
      if (usaMoto === true) usaMoto = 'Sí';
      if (usaMoto === false) usaMoto = 'No';
      usaMoto = (usaMoto || '').toString().trim();
  
      // Barreras: asegurar string con separador |
      const barreras = String(r.barreras || '')
        .split('|')
        .map(b => b.trim())
        .filter(Boolean)
        .join('|');
  
      // Fecha ts ISO: intenta usar ts/_createdAt/when
      const ts = r.ts || r._createdAt || r.when || null;
  
      return {
        ...r,
        ts,
        edad: Number.isFinite(edad) ? edad : '',
        intencion: Number.isFinite(intencion) ? intencion : '',
        zona,
        ocupacion,
        usaMoto,
        barreras
      };
    });
  }

  setupEventListeners() {
    const btnRefresh = document.getElementById('refreshData');
    if (btnRefresh) {
      btnRefresh.addEventListener('click', () => {
        this.loadData();
        this.renderDashboard();
        this.updateLastUpdateTime();
        this.showToast('Datos actualizados', 'success');
      });
    }

    const btnExport = document.getElementById('exportReport');
    if (btnExport) {
      btnExport.addEventListener('click', () => this.exportReport());
    }

    const btnClear = document.getElementById('clearAllData');
    if (btnClear) {
      btnClear.addEventListener('click', () => {
        if (confirm('¿Estás seguro de que quieres eliminar todos los datos? Esta acción no se puede deshacer.')) {
          localStorage.removeItem('encuestas');
          this.data = [];
          this.renderDashboard();
          this.showToast('Todos los datos han sido eliminados', 'error');
        }
      });
    }
  }

  renderDashboard() {
    if (this.data.length === 0) {
      const noData = document.getElementById('noDataMessage');
      const stats = document.querySelector('.stats-grid');
      const grid = document.querySelector('.dashboard-grid');
      if (noData) noData.style.display = 'block';
      if (stats) stats.style.display = 'none';
      if (grid) grid.style.display = 'none';
      return;
    }

    const noData = document.getElementById('noDataMessage');
    const stats = document.querySelector('.stats-grid');
    const grid = document.querySelector('.dashboard-grid');
    if (noData) noData.style.display = 'none';
    if (stats) stats.style.display = 'grid';
    if (grid) grid.style.display = 'grid';

    this.renderStats();
    this.renderCharts();
  }

  renderStats() {
    const total = this.data.length;
    const avgIntention = this.data.reduce((sum, item) => sum + (parseFloat(item.intencion) || 0), 0) / total;
    const avgAge = this.data.reduce((sum, item) => sum + (parseFloat(item.edad) || 0), 0) / total;
    const mobileUsers = this.data.filter(item => item.usaMoto === 'Sí').length;

    const elTotal = document.getElementById('totalResponses');
    const elAvgInt = document.getElementById('avgIntention');
    const elAvgAge = document.getElementById('avgAge');
    const elMobile = document.getElementById('mobileUsers');

    if (elTotal) elTotal.textContent = total;
    if (elAvgInt) elAvgInt.textContent = isFinite(avgIntention) ? avgIntention.toFixed(1) : '0.0';
    if (elAvgAge) elAvgAge.textContent = isFinite(avgAge) ? Math.round(avgAge) : '0';
    if (elMobile) elMobile.textContent = `${total ? Math.round((mobileUsers / total) * 100) : 0}%`;
  }

  renderCharts() {
    this.renderAgeChart();
    this.renderIntentionChart();
    this.renderZoneChart();
    this.renderOccupationChart();
    this.renderBarriersChart();
    this.renderAwarenessChart();
  }

  renderAgeChart() {
    const canvas = document.getElementById('ageChart');
    if (!canvas) return;

    // Forzar tamaño fijo del canvas
    canvas.width = 400;
    canvas.height = 300;
    canvas.style.width = '400px';
    canvas.style.height = '300px';
    canvas.style.maxWidth = '400px';
    canvas.style.maxHeight = '300px';

    const ctx = canvas.getContext('2d');

    // Agrupar por rangos de edad
    const ageRanges = { '15-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '56+': 0 };

    this.data.forEach(item => {
      const age = parseInt(item.edad);
      if (Number.isNaN(age)) return; // ignora sin edad
      if (age <= 25) ageRanges['15-25']++;
      else if (age <= 35) ageRanges['26-35']++;
      else if (age <= 45) ageRanges['36-45']++;
      else if (age <= 55) ageRanges['46-55']++;
      else ageRanges['56+']++;
    });

    if (this.charts.age) this.charts.age.destroy();

    this.charts.age = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: Object.keys(ageRanges),
        datasets: [{
          label: 'Número de encuestados',
          data: Object.values(ageRanges),
          backgroundColor: 'rgba(30, 136, 229, 0.8)',
          borderColor: 'rgba(30, 136, 229, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  renderIntentionChart() {
    const canvas = document.getElementById('intentionChart');
    if (!canvas) return;

    // Forzar tamaño fijo del canvas
    canvas.width = 400;
    canvas.height = 300;
    canvas.style.width = '400px';
    canvas.style.height = '300px';
    canvas.style.maxWidth = '400px';
    canvas.style.maxHeight = '300px';

    const ctx = canvas.getContext('2d');

    const intentionRanges = { '0-2': 0, '3-4': 0, '5-6': 0, '7-8': 0, '9-10': 0 };

    this.data.forEach(item => {
      const intention = parseInt(item.intencion);
      if (Number.isNaN(intention)) return; // ignora sin intención
      if (intention <= 2) intentionRanges['0-2']++;
      else if (intention <= 4) intentionRanges['3-4']++;
      else if (intention <= 6) intentionRanges['5-6']++;
      else if (intention <= 8) intentionRanges['7-8']++;
      else intentionRanges['9-10']++;
    });

    if (this.charts.intention) this.charts.intention.destroy();

    this.charts.intention = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(intentionRanges),
        datasets: [{
          data: Object.values(intentionRanges),
          backgroundColor: ['#e53e3e', '#fd7f28', '#fbbf24', '#34d399', '#10b981']
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: false
      }
    });
  }

  renderZoneChart() {
    const canvas = document.getElementById('zoneChart');
    if (!canvas) return;

    // Forzar tamaño fijo del canvas
    canvas.width = 400;
    canvas.height = 300;
    canvas.style.width = '400px';
    canvas.style.height = '300px';
    canvas.style.maxWidth = '400px';
    canvas.style.maxHeight = '300px';

    const ctx = canvas.getContext('2d');

    const zoneCounts = {};
    this.data.forEach(item => {
      const zone = (item.zona || '').trim() || 'Sin especificar';
      zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
    });

    const sortedZones = Object.entries(zoneCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 8);

    if (this.charts.zone) this.charts.zone.destroy();

    this.charts.zone = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sortedZones.map(([zone]) => zone),
        datasets: [{
          label: 'Encuestados por zona',
          data: sortedZones.map(([, count]) => count),
          backgroundColor: 'rgba(14, 165, 233, 0.8)',
          borderColor: 'rgba(14, 165, 233, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { maxRotation: 45 } },
          y: { beginAtZero: true }
        }
      }
    });
  }

  renderOccupationChart() {
    const canvas = document.getElementById('occupationChart');
    if (!canvas) return;

    // Forzar tamaño fijo del canvas
    canvas.width = 400;
    canvas.height = 300;
    canvas.style.width = '400px';
    canvas.style.height = '300px';
    canvas.style.maxWidth = '400px';
    canvas.style.maxHeight = '300px';

    const ctx = canvas.getContext('2d');

    const occupationCounts = {};
    this.data.forEach(item => {
      const occupation = item.ocupacion || 'Sin especificar';
      occupationCounts[occupation] = (occupationCounts[occupation] || 0) + 1;
    });

    if (this.charts.occupation) this.charts.occupation.destroy();

    this.charts.occupation = new Chart(ctx, {
      type: 'pie',
      data: {
        labels: Object.keys(occupationCounts),
        datasets: [{
          data: Object.values(occupationCounts),
          backgroundColor: ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444']
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: false
      }
    });
  }

  renderBarriersChart() {
    const canvas = document.getElementById('barriersChart');
    if (!canvas) return;

    // Forzar tamaño fijo del canvas
    canvas.width = 400;
    canvas.height = 300;
    canvas.style.width = '400px';
    canvas.style.height = '300px';
    canvas.style.maxWidth = '400px';
    canvas.style.maxHeight = '300px';

    const ctx = canvas.getContext('2d');

    const barrierCounts = {};
    this.data.forEach(item => {
      const barriers = String(item.barreras || '')
        .split('|')
        .map(b => b.trim())
        .filter(Boolean);
      barriers.forEach(barrier => {
        barrierCounts[barrier] = (barrierCounts[barrier] || 0) + 1;
      });
    });

    const sortedBarriers = Object.entries(barrierCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 6);

    if (this.charts.barriers) this.charts.barriers.destroy();

    this.charts.barriers = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sortedBarriers.map(([barrier]) => barrier),
        datasets: [{
          label: 'Frecuencia',
          data: sortedBarriers.map(([, count]) => count),
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
          borderColor: 'rgba(239, 68, 68, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        indexAxis: 'y',
        plugins: { legend: { display: false } }
      }
    });
  }

  renderAwarenessChart() {
    const canvas = document.getElementById('awarenessChart');
    if (!canvas) return;

    // Forzar tamaño fijo del canvas
    canvas.width = 400;
    canvas.height = 300;
    canvas.style.width = '400px';
    canvas.style.height = '300px';
    canvas.style.maxWidth = '400px';
    canvas.style.maxHeight = '300px';

    const ctx = canvas.getContext('2d');

    const awarenessCounts = {};
    this.data.forEach(item => {
      const awareness = (item.awareness_omo || 'Sin respuesta').toString();
      awarenessCounts[awareness] = (awarenessCounts[awareness] || 0) + 1;
    });

    if (this.charts.awareness) this.charts.awareness.destroy();

    this.charts.awareness = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(awarenessCounts),
        datasets: [{
          data: Object.values(awarenessCounts),
          backgroundColor: ['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe']
        }]
      },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        animation: false
      }
    });
  }

  exportReport() {
    if (this.data.length === 0) {
      this.showToast('No hay datos para exportar', 'error');
      return;
    }

    // Generar reporte CSV con estadísticas
    const stats = this.generateStatsReport();
    const blob = new Blob([stats], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `reporte_omomobility_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    this.showToast('Reporte exportado exitosamente', 'success');
  }

  generateStatsReport() {
    const total = this.data.length;
    const avgIntention = this.data.reduce((sum, item) => sum + (parseFloat(item.intencion) || 0), 0) / total;
    const avgAge = this.data.reduce((sum, item) => sum + (parseFloat(item.edad) || 0), 0) / total;
    const mobileUsers = this.data.filter(item => item.usaMoto === 'Sí').length;

    return `Reporte Estadístico - Omomobility
Fecha de generación: ${new Date().toLocaleString()}
Total de encuestas: ${total}
Intención promedio: ${isFinite(avgIntention) ? avgIntention.toFixed(2) : '0.00'}
Edad promedio: ${isFinite(avgAge) ? Math.round(avgAge) : 0}
Usuarios actuales de moto: ${mobileUsers} (${total ? Math.round((mobileUsers / total) * 100) : 0}%)

Datos detallados disponibles en exportación CSV desde la encuesta.`;
  }

  updateLastUpdateTime() {
    const el = document.getElementById('lastUpdate');
    if (el) el.textContent = `Última actualización: ${new Date().toLocaleTimeString()}`;
  }

  showToast(message, type = 'info') {
    // Reutilizar la función de toast del mobile script si está disponible
    if (window.mobileSurvey) {
      window.mobileSurvey.showToast(message, type);
    } else {
      alert(message); // Fallback simple
    }
  }
}

// Inicializar dashboard
document.addEventListener('DOMContentLoaded', () => {
  window.dashboard = new DashboardManager();
});