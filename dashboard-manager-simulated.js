// Dashboard Manager para datos simulados
class DashboardManagerSimulated {
  constructor() {
    // Protección agresiva contra múltiples instancias
    if (window.dashboardSimulatedInstance) {
      console.warn('Dashboard simulado ya existe, abortando nueva instancia');
      return window.dashboardSimulatedInstance;
    }
    
    // Prevenir inicialización simultánea
    if (window.dashboardInitializing) {
      console.warn('Dashboard ya se está inicializando');
      return;
    }
    window.dashboardInitializing = true;
      
    this.data = [];
    this.charts = {};
    this.isRendering = false; // Flag para prevenir renderizado múltiple
    this.renderTimeout = null; // Para debounce
    this.maxDataPoints = 250; // Límite de datos
    window.dashboardSimulatedInstance = this;
    this.init();     
    }
    
    init() {
      // Verificar que Chart.js esté disponible
      if (typeof Chart === 'undefined') {
        console.error('Chart.js no está disponible');
        return;
      }
      
      this.loadSimulatedData();
      this.setupEventListeners();
      this.renderDashboard();
      this.updateLastUpdateTime();
      
      // Cleanup automático al cerrar página
      window.addEventListener('beforeunload', () => {
        this.cleanup();
      });
      
      // Marcar inicialización como completada
      window.dashboardInitializing = false;
    }
    
    loadSimulatedData() {
      try {
        // Generar las encuestas simuladas con límite
        this.data = SimulatedData.generateRealisticSurveys().slice(0, this.maxDataPoints);
        console.log(`Datos simulados cargados: ${this.data.length} encuestas`);
      } catch (error) {
        console.error('Error al cargar datos simulados:', error);
        this.data = [];
      }
    }
    
    setupEventListeners() {
      // Usar debounce para prevenir múltiples ejecuciones
      const refreshBtn = document.getElementById('refreshData');
      const exportBtn = document.getElementById('exportReport');
      const clearBtn = document.getElementById('clearAllData');
      
      if (refreshBtn) {
        refreshBtn.addEventListener('click', this.debounce(() => {
          if (this.isRendering) return;
          this.isRendering = true;
          this.refreshData().finally(() => {
            this.isRendering = false;
          });
        }, 1000));
      }
      
      if (exportBtn) {
        exportBtn.addEventListener('click', this.debounce(() => {
          this.exportReport();
        }, 500));
      }
      
      if (clearBtn) {
        clearBtn.addEventListener('click', this.debounce(() => {
          if (this.isRendering) return;
          this.isRendering = true;
          if (confirm('¿Regenerar datos simulados?')) {
            this.refreshData().finally(() => {
              this.isRendering = false;
            });
          }
        }, 500));
      }
    }
    
    // Función debounce para prevenir ejecuciones múltiples
    debounce(func, wait) {
      return (...args) => {
        clearTimeout(this.renderTimeout);
        this.renderTimeout = setTimeout(() => func.apply(this, args), wait);
      };
    }
    
    refreshData() {
      if (this.isRendering) {
        console.log('Renderizado en progreso, ignorando solicitud');
        return;
      }
      
      this.loadSimulatedData();
      this.renderDashboard();
      this.updateLastUpdateTime();
      this.showToast('Datos simulados regenerados', 'success');
    }
    
    renderDashboard() {
      if (this.data.length === 0) {
        document.getElementById('noDataMessage').style.display = 'block';
        document.querySelector('.stats-grid').style.display = 'none';
        document.querySelector('.dashboard-grid').style.display = 'none';
        return;
      }
      
      document.getElementById('noDataMessage').style.display = 'none';
      document.querySelector('.stats-grid').style.display = 'grid';
      document.querySelector('.dashboard-grid').style.display = 'grid';
      
      this.renderStats();
      this.renderCharts();
    }
    
    renderStats() {
      const total = this.data.length;
      const avgIntention = this.data.reduce((sum, item) => sum + (parseFloat(item.intencion) || 0), 0) / total;
      const avgAge = this.data.reduce((sum, item) => sum + (parseFloat(item.edad) || 0), 0) / total;
      const mobileUsers = this.data.filter(item => item.usaMoto === 'Sí').length;
      
      document.getElementById('totalResponses').textContent = total;
      document.getElementById('avgIntention').textContent = avgIntention.toFixed(1);
      document.getElementById('avgAge').textContent = Math.round(avgAge);
      document.getElementById('mobileUsers').textContent = `${Math.round((mobileUsers / total) * 100)}%`;
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
      try {
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
        
        const ageRanges = {
          '15-25': 0, '26-35': 0, '36-45': 0, '46-55': 0, '56+': 0
        };
        
        this.data.forEach(item => {
          const age = parseInt(item.edad);
          if (age <= 25) ageRanges['15-25']++;
          else if (age <= 35) ageRanges['26-35']++;
          else if (age <= 45) ageRanges['36-45']++;
          else if (age <= 55) ageRanges['46-55']++;
          else ageRanges['56+']++;
        });
        
        if (this.charts.age) {
          this.charts.age.destroy();
          this.charts.age = null;
        }
        
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
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: {
                beginAtZero: true,
                max: Math.max(...Object.values(ageRanges)) + 10
              }
            }
          }
        });
      } catch (error) {
        console.error('Error renderizando gráfica de edad:', error);
      }
    }
    
    renderIntentionChart() {
      try {
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
        
        const intentionRanges = {
          '0-2': 0, '3-4': 0, '5-6': 0, '7-8': 0, '9-10': 0
        };
        
        this.data.forEach(item => {
          const intention = parseInt(item.intencion);
          if (intention <= 2) intentionRanges['0-2']++;
          else if (intention <= 4) intentionRanges['3-4']++;
          else if (intention <= 6) intentionRanges['5-6']++;
          else if (intention <= 8) intentionRanges['7-8']++;
          else intentionRanges['9-10']++;
        });
        
        if (this.charts.intention) {
          this.charts.intention.destroy();
          this.charts.intention = null;
        }
        
        this.charts.intention = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: Object.keys(intentionRanges),
            datasets: [{
              data: Object.values(intentionRanges),
              backgroundColor: [
                '#e53e3e', '#fd7f28', '#fbbf24', '#34d399', '#10b981'
              ]
            }]
          },
          options: {
            responsive: false,
            maintainAspectRatio: false,
            animation: false
          }
        });
      } catch (error) {
        console.error('Error renderizando gráfica de intención:', error);
      }
    }
    
    renderZoneChart() {
      try {
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
          const zone = item.zona || 'Sin especificar';
          zoneCounts[zone] = (zoneCounts[zone] || 0) + 1;
        });
        
        if (this.charts.zone) {
          this.charts.zone.destroy();
          this.charts.zone = null;
        }
        
        this.charts.zone = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: Object.keys(zoneCounts),
            datasets: [{
              label: 'Encuestados por zona',
              data: Object.values(zoneCounts),
              backgroundColor: 'rgba(14, 165, 233, 0.8)',
              borderColor: 'rgba(14, 165, 233, 1)',
              borderWidth: 1
            }]
          },
          options: {
            responsive: false,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: {
                beginAtZero: true,
                max: Math.max(...Object.values(zoneCounts)) + 10
              }
            }
          }
        });
      } catch (error) {
        console.error('Error renderizando gráfica de zona:', error);
      }
    }
    
    renderOccupationChart() {
      try {
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
        
        if (this.charts.occupation) {
          this.charts.occupation.destroy();
          this.charts.occupation = null;
        }
        
        this.charts.occupation = new Chart(ctx, {
          type: 'pie',
          data: {
            labels: Object.keys(occupationCounts),
            datasets: [{
              data: Object.values(occupationCounts),
              backgroundColor: [
                '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'
              ]
            }]
          },
          options: {
            responsive: false,
            maintainAspectRatio: false,
            animation: false
          }
        });
      } catch (error) {
        console.error('Error renderizando gráfica de ocupación:', error);
      }
    }
    
    renderBarriersChart() {
      try {
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
          const barriers = (item.barreras || '').split('|').filter(b => b.trim());
          barriers.forEach(barrier => {
            barrierCounts[barrier] = (barrierCounts[barrier] || 0) + 1;
          });
        });
        
        const sortedBarriers = Object.entries(barrierCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 6);
        
        if (this.charts.barriers) {
          this.charts.barriers.destroy();
          this.charts.barriers = null;
        }
        
        this.charts.barriers = new Chart(ctx, {
          type: 'bar',
          data: {
            labels: sortedBarriers.map(([barrier]) => barrier),
            datasets: [{
              label: 'Frecuencia',
              data: sortedBarriers.map(([,count]) => count),
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
            plugins: {
              legend: { display: false }
            },
            scales: {
              x: {
                beginAtZero: true,
                max: Math.max(...sortedBarriers.map(([,count]) => count)) + 5
              }
            }
          }
        });
      } catch (error) {
        console.error('Error renderizando gráfica de barreras:', error);
      }
    }
    
    renderAwarenessChart() {
      try {
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
          const awareness = item.awareness_omo || 'Sin respuesta';
          awarenessCounts[awareness] = (awarenessCounts[awareness] || 0) + 1;
        });
        
        if (this.charts.awareness) {
          this.charts.awareness.destroy();
          this.charts.awareness = null;
        }
        
        this.charts.awareness = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: Object.keys(awarenessCounts),
            datasets: [{
              data: Object.values(awarenessCounts),
              backgroundColor: [
                '#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe'
              ]
            }]
          },
          options: {
            responsive: false,
            maintainAspectRatio: false,
            animation: false
          }
        });
      } catch (error) {
        console.error('Error renderizando gráfica de awareness:', error);
      }
    }
    
    
    exportReport() {
      if (this.data.length === 0) {
        this.showToast('No hay datos para exportar', 'error');
        return;
      }
      
      const csvData = DataManager.toCSV(this.data);
      const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `encuestas_simuladas_omomobility_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      this.showToast('Datos simulados exportados exitosamente', 'success');
    }
    
    updateLastUpdateTime() {
      document.getElementById('lastUpdate').textContent = 
        `Datos simulados generados: ${new Date().toLocaleTimeString()}`;
    }
    
    showToast(message, type = 'info') {
      const toast = document.createElement('div');
      toast.className = `toast ${type} show`;
      toast.textContent = message;
      toast.style.cssText = `
        position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
        background: ${type === 'success' ? '#38a169' : type === 'error' ? '#e53e3e' : '#1e88e5'};
        color: white; padding: 12px 20px; border-radius: 8px; font-size: 14px; z-index: 1000;
      `;
      document.body.appendChild(toast);
      
      setTimeout(() => {
        toast.remove();
      }, 3000);
    }
        
    // Método de cleanup para liberar recursos
    cleanup() {
      try {
        // Destruir todas las gráficas
        Object.values(this.charts).forEach(chart => {
          if (chart && typeof chart.destroy === 'function') {
            chart.destroy();
          }
        });
        this.charts = {};
        
        // Limpiar timeouts
        if (this.renderTimeout) {
          clearTimeout(this.renderTimeout);
          this.renderTimeout = null;
        }
        
        // Limpiar datos
        this.data = [];
        this.isRendering = false;
        
        console.log('Dashboard simulado limpiado correctamente');
      } catch (error) {
        console.error('Error durante cleanup:', error);
      }
    }
  }
  
  // Inicializar dashboard simulado
  document.addEventListener('DOMContentLoaded', () => {
    window.dashboardSimulated = new DashboardManagerSimulated();
  });