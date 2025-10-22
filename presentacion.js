// Presentación Manager - Omomobility
class PresentacionManager {
    constructor() {
      this.currentSlide = 1;
      this.totalSlides = 0; // será calculado dinámicamente
      this.charts = {};
      this.data = [];
      this.init();
    }
  

    async init() {
        await this.loadData(); // Esperar a que carguen los datos
        this.computeTotalSlides();
        this.updateTotalCountersUI();
        this.setupNavigation();
        this.setupKeyboardNav();
        this.updateProgressDots();
        this.setDate();
        this.renderCurrentSlide();
      }
    
      // Cargar datos de encuestas
     // Cargar datos de encuestas
  async loadData() {
    console.log('[Presentación] Iniciando carga de datos...');
    
    try {
      // 1. Intentar desde Firestore primero (si está disponible)
      if (window.db) {
        console.log('[Presentación] Firestore detectado, intentando cargar...');
        try {
          const snapshot = await window.db.collection('surveys').limit(250).get();
          console.log(`[Presentación] Firestore respondió con ${snapshot.size} documentos`);
          
          const firestoreData = [];
          
          snapshot.forEach(doc => {
            const d = doc.data();
            firestoreData.push({
              id: doc.id,
              ts: d.ts || d._createdAt || d.when || null,
              encuestador_id: d.encuestador_id || '',
              zona: d.zona || 'Sin especificar',
              edad: d.edad || '',
              intencion: d.intencion || 0,
              barreras: d.barreras || [],
              ocupacion: d.ocupacion || '',
              usa_moto: d.usa_moto || '',
              conoce_marca: d.conoce_marca || '',
              ...d
            });
          });

          if (firestoreData.length > 0) {
            this.data = firestoreData;
            console.log(`✅ [Presentación] ${this.data.length} encuestas cargadas desde Firestore`);
            return;
          } else {
            console.warn('[Presentación] Firestore no devolvió datos válidos');
          }
        } catch (err) {
          console.error('[Presentación] Error cargando desde Firestore:', err);
        }
      } else {
        console.log('[Presentación] Firestore no disponible (window.db no existe)');
      }

      // 2. Fallback a DataManager (si existe)
      if (window.DataManager && typeof DataManager.readAll === 'function') {
        console.log('[Presentación] Intentando DataManager...');
        const dmData = DataManager.readAll();
        if (dmData && dmData.length > 0) {
          this.data = dmData;
          console.log(`✅ [Presentación] ${this.data.length} encuestas cargadas desde DataManager`);
          return;
        }
      } else {
        console.log('[Presentación] DataManager no disponible');
      }

      // 3. Fallback a localStorage
      console.log('[Presentación] Intentando localStorage...');
      const stored = localStorage.getItem('encuestas');
      if (stored) {
        const localData = JSON.parse(stored);
        if (localData && localData.length > 0) {
          this.data = localData;
          console.log(`✅ [Presentación] ${this.data.length} encuestas cargadas desde localStorage`);
          return;
        }
      } else {
        console.log('[Presentación] localStorage "encuestas" está vacío');
      }

      // 4. Sin datos
      console.warn('⚠️ [Presentación] No se encontraron datos de encuestas en ninguna fuente');
      console.log('[Presentación] Fuentes verificadas: Firestore, DataManager, localStorage');
      this.data = [];
      
    } catch (e) {
      console.error('❌ [Presentación] Error crítico cargando datos:', e);
      this.data = [];
    }
  }


    // Configurar navegación
    setupNavigation() {
      // Los botones ya tienen onclick en el HTML
      // Aquí solo actualizamos el estado
    }
  
    // Navegación con teclado
    setupKeyboardNav() {
      document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === ' ') {
          e.preventDefault();
          this.nextSlide();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.prevSlide();
        } else if (e.key === 'Escape') {
          window.location.href = 'index.html';
        }
      });
    }
  
    // Navegar al siguiente slide
    nextSlide() {
      if (this.currentSlide < this.totalSlides) {
        this.currentSlide++;
        this.showSlide(this.currentSlide);
      }
    }
  
    // Navegar al slide anterior
    prevSlide() {
      if (this.currentSlide > 1) {
        this.currentSlide--;
        this.showSlide(this.currentSlide);
      }
    }
  
    // Mostrar slide específico
    showSlide(slideNumber) {
      // Recalcular total por si el DOM cambió
      this.computeTotalSlides();
      this.updateTotalCountersUI();

      // Limitar slideNumber al rango válido
      if (slideNumber < 1) slideNumber = 1;
      if (slideNumber > this.totalSlides) slideNumber = this.totalSlides;
      this.currentSlide = slideNumber;

      // Ocultar todos los slides
      document.querySelectorAll('.slide').forEach(slide => {
        slide.classList.remove('active');
      });

      // Mostrar slide actual
      const targetSlide = document.querySelector(`.slide[data-slide="${slideNumber}"]`);
      if (targetSlide) {
        targetSlide.classList.add('active');
      }

      // Actualizar contadores
      document.querySelectorAll('.slide-counter .current').forEach(el => {
        el.textContent = slideNumber;
      });

      // Actualizar botones
      this.updateNavButtons();

      // Actualizar progress dots
      this.updateProgressDots();

      // Renderizar contenido del slide
      this.renderCurrentSlide();
    }
  
    // Actualizar botones de navegación
    updateNavButtons() {
      document.querySelectorAll('.nav-btn').forEach(btn => {
        const isPrev = btn.textContent.includes('Anterior');
        const isNext = btn.textContent.includes('Siguiente');
  
        if (isPrev) {
          btn.disabled = this.currentSlide === 1;
        } else if (isNext) {
          btn.disabled = this.currentSlide === this.totalSlides;
        }
      });
    }
  
    // Actualizar indicadores de progreso
    updateProgressDots() {
      document.querySelectorAll('.progress-dots').forEach(container => {
        container.innerHTML = '';
        for (let i = 1; i <= this.totalSlides; i++) {
          const dot = document.createElement('div');
          dot.className = 'dot';
          if (i === this.currentSlide) {
            dot.classList.add('active');
          }
          container.appendChild(dot);
        }
      });
    }

    // Calcular total de slides desde el DOM
    computeTotalSlides() {
      const slides = document.querySelectorAll('.slide');
      this.totalSlides = slides ? slides.length : 0;
    }

    // Actualizar el número total en los contadores UI
    updateTotalCountersUI() {
      document.querySelectorAll('.slide-counter .total').forEach(el => {
        el.textContent = this.totalSlides;
      });
    }
  
    // Establecer fecha actual
    setDate() {
      const dateEl = document.getElementById('presentation-date');
      if (dateEl) {
        const now = new Date();
        const options = { year: 'numeric', month: 'long' };
        dateEl.textContent = now.toLocaleDateString('es-MX', options);
      }
    }
  
    // Renderizar contenido del slide actual
    renderCurrentSlide() {
      switch (this.currentSlide) {
        case 2:
          this.renderResumenEjecutivo();
          break;
        case 4:
          this.renderPerfilEncuestados();
          break;
        case 5:
          this.renderIntencionCompra();
          break;
        case 6:
          this.renderModeloTCO();
          break;
        case 7:
          this.renderBarreras();
          break;
        // Contenidos reordenados
        case 8:
          this.renderZonasTop();
          break;
        case 9:
          this.renderIntencionPorZona();
          break;
        case 10:
          this.renderAwarenessYFavorabilidad();
          break;
        case 12:
          this.renderRecomendacionesClave();
          break;
        // 15 es "Cierre" y no requiere render específico
      }
    }
  
    // Slide 2: Resumen Ejecutivo
    renderResumenEjecutivo() {
      const totalEl = document.getElementById('total-encuestas');
      const interesEl = document.getElementById('interes-promedio');
  
      if (totalEl) {
        totalEl.textContent = this.data.length;
      }
  
      if (interesEl && this.data.length > 0) {
        const intenciones = this.data
          .map(d => parseFloat(d.intencion))
          .filter(n => !isNaN(n));
        
        if (intenciones.length > 0) {
          const promedio = intenciones.reduce((a, b) => a + b, 0) / intenciones.length;
          interesEl.textContent = `${Math.round(promedio * 10)}%`;
        }
      }
    }
  
    // Slide 4: Perfil de Encuestados
    renderPerfilEncuestados() {
      this.renderChartEdad();
      this.renderChartZona();
    }
  
    renderChartEdad() {
      const ctx = document.getElementById('chart-edad');
      if (!ctx || this.data.length === 0) return;
  
      // Destruir gráfica anterior
      if (this.charts.edad) {
        this.charts.edad.destroy();
      }
  
      // Contar por edad
      const edadCounts = {};
      this.data.forEach(d => {
        const edad = d.edad || 'Sin especificar';
        edadCounts[edad] = (edadCounts[edad] || 0) + 1;
      });
  
      this.charts.edad = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: Object.keys(edadCounts),
          datasets: [{
            label: 'Encuestados',
            data: Object.values(edadCounts),
            backgroundColor: '#2563eb'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          }
        }
      });
    }
  
    renderChartZona() {
      const ctx = document.getElementById('chart-zona');
      if (!ctx || this.data.length === 0) return;
  
      if (this.charts.zona) {
        this.charts.zona.destroy();
      }
  
      const zonaCounts = {};
      this.data.forEach(d => {
        const zona = d.zona || 'Sin especificar';
        zonaCounts[zona] = (zonaCounts[zona] || 0) + 1;
      });
  
      this.charts.zona = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: Object.keys(zonaCounts),
          datasets: [{
            data: Object.values(zonaCounts),
            backgroundColor: ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899', '#f97316', '#84cc16', '#a855f7', '#14b8a6', '#f43f5e']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          aspectRatio: 1,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                boxWidth: 12,
                padding: 8,
                font: { size: 11 },
                generateLabels: (chart) => {
                  const data = chart.data;
                  return data.labels.map((label, i) => ({
                    text: label.length > 20 ? label.substring(0, 18) + '...' : label,
                    fillStyle: data.datasets[0].backgroundColor[i],
                    hidden: false,
                    index: i
                  }));
                }
              }
            },
            tooltip: {
              callbacks: {
                label: (ctx) => `${ctx.label}: ${ctx.parsed}`
              }
            }
          }
        }
      });
    }
  
    // Slide 5: Intención de Compra
    renderIntencionCompra() {
      const ctx = document.getElementById('chart-intencion');
      if (!ctx || this.data.length === 0) return;
  
      if (this.charts.intencion) {
        this.charts.intencion.destroy();
      }
  
      // Agrupar por rangos de intención
      const rangos = {
        '0-2': 0,
        '3-4': 0,
        '5-6': 0,
        '7-8': 0,
        '9-10': 0
      };
  
      this.data.forEach(d => {
        const int = parseFloat(d.intencion);
        if (!isNaN(int)) {
          if (int <= 2) rangos['0-2']++;
          else if (int <= 4) rangos['3-4']++;
          else if (int <= 6) rangos['5-6']++;
          else if (int <= 8) rangos['7-8']++;
          else rangos['9-10']++;
        }
      });
  
      this.charts.intencion = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: Object.keys(rangos),
          datasets: [{
            label: 'Número de encuestados',
            data: Object.values(rangos),
            backgroundColor: ['#ef4444', '#f59e0b', '#fbbf24', '#10b981', '#059669']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: {
              display: true,
              text: 'Distribución de Intención de Compra (0-10)'
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1 }
            }
          }
        }
      });
    }
  
    // Slide 6: Modelo TCO
    renderModeloTCO() {
      const ctx = document.getElementById('chart-tco');
      if (!ctx) return;
  
      if (this.charts.tco) {
        this.charts.tco.destroy();
      }
  
      // Datos de ejemplo (pueden venir del modelo TCO real)
      const años = ['Año 1', 'Año 2', 'Año 3', 'Año 4', 'Año 5'];
      const electrica = [45000, 51500, 58000, 64500, 71000];
      const combustion = [35000, 47000, 59000, 71000, 83000];
  
      this.charts.tco = new Chart(ctx, {
        type: 'line',
        data: {
          labels: años,
          datasets: [
            {
              label: 'Moto Eléctrica',
              data: electrica,
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              fill: true
            },
            {
              label: 'Moto Combustión',
              data: combustion,
              borderColor: '#f59e0b',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              fill: true
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
            title: {
              display: true,
              text: 'Costo Total de Propiedad Acumulado'
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: (value) => `$${(value / 1000).toFixed(0)}K`
              }
            }
          }
        }
      });
    }
  
  // Slide 7: Barreras
  renderBarreras() {
    const ctx = document.getElementById('chart-barreras');
    if (!ctx) {
      console.log('[Presentación] Canvas chart-barreras no encontrado');
      return;
    }
    
    if (this.data.length === 0) {
      console.log('[Presentación] No hay datos para renderizar barreras');
      return;
    }

    // Destruir gráfica anterior
    if (this.charts.barreras) {
      this.charts.barreras.destroy();
    }

    // Contar barreras mencionadas
    const barreras = {};
    this.data.forEach(d => {
      if (d.barreras) {
        const lista = Array.isArray(d.barreras) ? d.barreras : [d.barreras];
        lista.forEach(b => {
          if (b && typeof b === 'string' && b.trim()) {
            const barrera = b.trim();
            barreras[barrera] = (barreras[barrera] || 0) + 1;
          }
        });
      }
    });

    // Verificar si hay datos
    if (Object.keys(barreras).length === 0) {
      console.warn('[Presentación] No se encontraron barreras en los datos');
      // Mostrar mensaje en el canvas
      ctx.getContext('2d').font = '16px Inter';
      ctx.getContext('2d').fillText('No hay datos de barreras disponibles', 50, 200);
      return;
    }

    // Ordenar por frecuencia y tomar top 5
    const sorted = Object.entries(barreras)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    console.log('[Presentación] Barreras encontradas:', sorted);

    this.charts.barreras = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sorted.map(s => s[0]),
        datasets: [{
          label: 'Menciones',
          data: sorted.map(s => s[1]),
          backgroundColor: '#ef4444'
        }]
      },
      options: {
        indexAxis: 'y', // Esto hace que sea horizontal
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: {
            display: true,
            text: 'Top 5 Barreras de Adopción'
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });
  }

  // Slide 10: Zonas con mayor cobertura
  renderZonasTop() {
    const ctx = document.getElementById('chart-zonas-top');
    if (!ctx || this.data.length === 0) return;

    if (this.charts.zonasTop) {
      this.charts.zonasTop.destroy();
    }

    const zonaCounts = {};
    this.data.forEach(d => {
      const zona = d.zona || 'Sin especificar';
      zonaCounts[zona] = (zonaCounts[zona] || 0) + 1;
    });

    const sorted = Object.entries(zonaCounts).sort((a,b) => b[1]-a[1]).slice(0, 10);

    this.charts.zonasTop = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: sorted.map(s => s[0]),
        datasets: [{
          label: 'Encuestas',
          data: sorted.map(s => s[1]),
          backgroundColor: '#2563eb'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Top Zonas por número de encuestas' }
        },
        scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
      }
    });
  }


  // Slide 12: Intención por Zona
  renderIntencionPorZona() {
    const ctx = document.getElementById('chart-intencion-zona');
    if (!ctx || this.data.length === 0) return;

    if (this.charts.intencionZona) {
      this.charts.intencionZona.destroy();
    }

    const acumulados = {};
    const cantidades = {};
    this.data.forEach(d => {
      const zona = d.zona || 'Sin especificar';
      const int = parseFloat(d.intencion);
      if (!isNaN(int)) {
        acumulados[zona] = (acumulados[zona] || 0) + int;
        cantidades[zona] = (cantidades[zona] || 0) + 1;
      }
    });

    const zonas = Object.keys(acumulados);
    const promedios = zonas.map(z => acumulados[z] / (cantidades[z] || 1));

    this.charts.intencionZona = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: zonas,
        datasets: [{
          label: 'Intención promedio (0–10)',
          data: promedios,
          backgroundColor: '#8b5cf6'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          title: { display: true, text: 'Intención promedio por zona' }
        },
        scales: { y: { beginAtZero: true, suggestedMax: 10 } }
      }
    });
  }

  // Slide 13: Awareness y Favorabilidad
  renderAwarenessYFavorabilidad() {
    const awarenessCanvas = document.getElementById('chart-awareness-pres');
    const favCanvas = document.getElementById('chart-favorabilidad');
    
    if (!awarenessCanvas) return;

    // Awareness - valores reales: 'La conozco', 'Me suena', 'No la conozco'
    const conocen = this.data.filter(d => {
      const val = d.awareness_omo || '';
      return val === 'La conozco' || val === 'Me suena';
    }).length;
    const noConocen = this.data.filter(d => {
      const val = d.awareness_omo || '';
      return val === 'No la conozco' || val === '';
    }).length;
    const total = this.data.length;
    const pctConocen = total > 0 ? ((conocen / total) * 100).toFixed(1) : 0;
    const pctNoConocen = total > 0 ? ((noConocen / total) * 100).toFixed(1) : 0;

    if (this.charts['awareness-pres']) this.charts['awareness-pres'].destroy();
    this.charts['awareness-pres'] = new Chart(awarenessCanvas, {
      type: 'doughnut',
      data: {
        labels: ['Conocen', 'No conocen'],
        datasets: [{
          data: [conocen, noConocen],
          backgroundColor: ['#10b981', '#ef4444']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const total = conocen + noConocen;
                const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(1) : 0;
                return `${ctx.label}: ${ctx.parsed} (${pct}%)`;
              }
            }
          }
        }
      }
    });

    // Favorabilidad - valores numéricos 1-7 y 'Neutral'
    if (favCanvas) {
      const favField = this.data.find(d => d.favorabilidad_omo !== undefined);
      if (!favField) {
        console.warn('[Presentación] Campo de favorabilidad no encontrado en datos; ocultando tarjeta');
        const card = favCanvas.closest('.chart-card');
        if (card) card.style.display = 'none';
      } else {
        // Agrupar: Favorable (5-7), Neutral (3-4 o 'Neutral'), Desfavorable (1-2)
        const favorable = this.data.filter(d => {
          const val = d.favorabilidad_omo;
          return val === 5 || val === 6 || val === 7 || val === '5' || val === '6' || val === '7';
        }).length;
        const neutral = this.data.filter(d => {
          const val = d.favorabilidad_omo;
          return val === 3 || val === 4 || val === '3' || val === '4' || val === 'Neutral';
        }).length;
        const desfavorable = this.data.filter(d => {
          const val = d.favorabilidad_omo;
          return val === 1 || val === 2 || val === '1' || val === '2';
        }).length;

        if (this.charts['favorabilidad']) this.charts['favorabilidad'].destroy();
        this.charts['favorabilidad'] = new Chart(favCanvas, {
          type: 'pie',
          data: {
            labels: ['Favorable', 'Neutral', 'Desfavorable'],
            datasets: [{
              data: [favorable, neutral, desfavorable],
              backgroundColor: ['#10b981', '#fbbf24', '#ef4444']
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom' }
            }
          }
        });
      }
    }

    // Top 5 zonas con mayor intención de compra (siempre se ejecuta)
    this.renderTopIntencionZonas();
  }

  renderTopIntencionZonas() {
    const canvas = document.getElementById('chart-top-intencion-zonas');
    if (!canvas) return;

    // Calcular promedio de intención por zona
    const zonaMap = {};
    this.data.forEach(d => {
      const zona = d.zona || 'Sin especificar';
      const intencion = parseFloat(d.intencion) || 0;
      if (!zonaMap[zona]) {
        zonaMap[zona] = { sum: 0, count: 0 };
      }
      zonaMap[zona].sum += intencion;
      zonaMap[zona].count += 1;
    });

    // Calcular promedio y ordenar
    const zonasConPromedio = Object.keys(zonaMap).map(zona => ({
      zona,
      promedio: zonaMap[zona].sum / zonaMap[zona].count
    })).sort((a, b) => b.promedio - a.promedio);

    // Top 5
    const top5 = zonasConPromedio.slice(0, 5);
    const labels = top5.map(z => z.zona);
    const valores = top5.map(z => z.promedio.toFixed(1));

    if (this.charts['top-intencion-zonas']) this.charts['top-intencion-zonas'].destroy();
    this.charts['top-intencion-zonas'] = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Intención promedio (0-10)',
          data: valores,
          backgroundColor: '#3b82f6'
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            beginAtZero: true,
            max: 10,
            title: { display: true, text: 'Intención promedio' }
          }
        },
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  // Slide 14: Recomendaciones Clave
  renderRecomendacionesClave() {
    const list = document.getElementById('reco-list');
    if (!list) return;
    list.innerHTML = '';

    const total = this.data.length;

    const recomendaciones = [
      'Priorizar zonas con mayor densidad de encuestas y alta intención promedio',
      'Comunicar ahorro operativo y sustentabilidad como ejes de marketing',
      'Diseñar plan de financiamiento accesible (12–24 meses)',
      'Asegurar red de servicio y puntos de carga en zonas prioritarias',
      'Programa piloto con 20–30 unidades y medición mensual de KPIs'
    ];

    recomendaciones.forEach(txt => {
      const li = document.createElement('li');
      li.textContent = txt;
      list.appendChild(li);
    });

    const footer = document.createElement('p');
    footer.style.marginTop = '12px';
    footer.style.color = 'var(--muted)';
    footer.style.fontSize = '13px';
    footer.textContent = `Base de datos analizada: ${total} encuestas`;
    list.parentElement.appendChild(footer);
  }
  
    // Métodos estáticos para llamar desde HTML
    static nextSlide() {
      if (window.presentacionInstance) {
        window.presentacionInstance.nextSlide();
      }
    }

    static prevSlide() {
      if (window.presentacionInstance) {
        window.presentacionInstance.prevSlide();
      }
    }

    static toggleFullscreen() {
      const docEl = document.documentElement;
      if (!document.fullscreenElement) {
        if (docEl.requestFullscreen) docEl.requestFullscreen();
      } else {
        if (document.exitFullscreen) document.exitFullscreen();
      }
    }
  }

  // Inicializar al cargar la página
  document.addEventListener('DOMContentLoaded', () => {
    window.presentacionInstance = new PresentacionManager();
    window.PresentacionManager = PresentacionManager;
  });