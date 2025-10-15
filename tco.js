// TCO Calculator - Omomobility
class TCOCalculator {
    constructor() {
      this.charts = {};
      this.resultados = null;
      this.init();
    }
  
    init() {
      this.setupEventListeners();
      this.loadSavedValues();
    }
  
    setupEventListeners() {
      const btnCalcular = document.getElementById('btn-calcular');
      const btnReset = document.getElementById('btn-reset');
      const btnExportPDF = document.getElementById('btn-export-pdf');
      const btnExportExcel = document.getElementById('btn-export-excel');
      const btnShare = document.getElementById('btn-share');
  
      if (btnCalcular) {
        btnCalcular.addEventListener('click', () => this.calcularTCO());
      }
  
      if (btnReset) {
        btnReset.addEventListener('click', () => this.resetValues());
      }
  
      if (btnExportPDF) {
        btnExportPDF.addEventListener('click', () => this.exportPDF());
      }
  
      if (btnExportExcel) {
        btnExportExcel.addEventListener('click', () => this.exportExcel());
      }
  
      if (btnShare) {
        btnShare.addEventListener('click', () => this.shareResults());
      }
  
      // Auto-guardar valores al cambiar
      const inputs = document.querySelectorAll('input[type="number"]');
      inputs.forEach(input => {
        input.addEventListener('change', () => this.saveValues());
      });
    }
  
    loadSavedValues() {
      try {
        const saved = localStorage.getItem('tco_params');
        if (saved) {
          const params = JSON.parse(saved);
          Object.keys(params).forEach(key => {
            const input = document.getElementById(key);
            if (input) input.value = params[key];
          });
        }
      } catch (e) {
        console.error('Error cargando valores:', e);
      }
    }
  
    saveValues() {
      try {
        const params = this.getInputValues();
        localStorage.setItem('tco_params', JSON.stringify(params));
      } catch (e) {
        console.error('Error guardando valores:', e);
      }
    }
  
    getInputValues() {
      return {
        precio_electrica: parseFloat(document.getElementById('precio_electrica').value) || 0,
        autonomia_electrica: parseFloat(document.getElementById('autonomia_electrica').value) || 1,
        costo_carga: parseFloat(document.getElementById('costo_carga').value) || 0,
        mant_electrica: parseFloat(document.getElementById('mant_electrica').value) || 0,
        depreciacion_electrica: parseFloat(document.getElementById('depreciacion_electrica').value) || 0,
        precio_combustion: parseFloat(document.getElementById('precio_combustion').value) || 0,
        rendimiento_combustion: parseFloat(document.getElementById('rendimiento_combustion').value) || 1,
        precio_gasolina: parseFloat(document.getElementById('precio_gasolina').value) || 0,
        mant_combustion: parseFloat(document.getElementById('mant_combustion').value) || 0,
        depreciacion_combustion: parseFloat(document.getElementById('depreciacion_combustion').value) || 0,
        km_anuales: parseFloat(document.getElementById('km_anuales').value) || 0,
        años_uso: parseInt(document.getElementById('años_uso').value) || 1,
        tasa_descuento: parseFloat(document.getElementById('tasa_descuento').value) || 0
      };
    }
  
    resetValues() {
      const defaults = {
        precio_electrica: 45000,
        autonomia_electrica: 80,
        costo_carga: 8,
        mant_electrica: 1500,
        depreciacion_electrica: 15,
        precio_combustion: 35000,
        rendimiento_combustion: 35,
        precio_gasolina: 24,
        mant_combustion: 4500,
        depreciacion_combustion: 20,
        km_anuales: 12000,
        años_uso: 5,
        tasa_descuento: 8
      };
  
      Object.keys(defaults).forEach(key => {
        const input = document.getElementById(key);
        if (input) input.value = defaults[key];
      });
  
      localStorage.removeItem('tco_params');
      document.getElementById('resultados-section').style.display = 'none';
    }
  
    calcularTCO() {
      const params = this.getInputValues();
      
      // Calcular costos anuales
      const energiaElectricaAnual = (params.km_anuales / params.autonomia_electrica) * params.costo_carga;
      const combustibleAnual = (params.km_anuales / params.rendimiento_combustion) * params.precio_gasolina;
  
      // Arrays para almacenar datos anuales
      const datosElectrica = [];
      const datosCombustion = [];
      let acumElectrica = params.precio_electrica;
      let acumCombustion = params.precio_combustion;
  
      // Calcular año por año
      for (let año = 1; año <= params.años_uso; año++) {
        const costoAnualElectrica = energiaElectricaAnual + params.mant_electrica;
        const costoAnualCombustion = combustibleAnual + params.mant_combustion;
  
        acumElectrica += costoAnualElectrica;
        acumCombustion += costoAnualCombustion;
  
        datosElectrica.push({
          año,
          anual: costoAnualElectrica,
          acumulado: acumElectrica
        });
  
        datosCombustion.push({
          año,
          anual: costoAnualCombustion,
          acumulado: acumCombustion
        });
      }
  
      // Calcular depreciación
      const deprElectrica = params.precio_electrica * (params.depreciacion_electrica / 100) * params.años_uso;
      const deprCombustion = params.precio_combustion * (params.depreciacion_combustion / 100) * params.años_uso;
  
      // TCO Total
      const tcoElectrica = acumElectrica + deprElectrica;
      const tcoCombustion = acumCombustion + deprCombustion;
  
      // Ahorros
      const ahorroTotal = tcoCombustion - tcoElectrica;
      const ahorroAnual = ahorroTotal / params.años_uso;
      const ahorroMensual = ahorroAnual / 12;
  
      // Costo por km
      const kmTotales = params.km_anuales * params.años_uso;
      const costoKmElectrica = tcoElectrica / kmTotales;
      const costoKmCombustion = tcoCombustion / kmTotales;
  
      // ROI
      const inversionAdicional = params.precio_electrica - params.precio_combustion;
      const roi = inversionAdicional > 0 ? (ahorroTotal / inversionAdicional) * 100 : 0;
  
      // Punto de equilibrio
      const ahorroAnualOperativo = (combustibleAnual + params.mant_combustion) - (energiaElectricaAnual + params.mant_electrica);
      const breakEven = inversionAdicional > 0 && ahorroAnualOperativo > 0 
        ? (inversionAdicional / ahorroAnualOperativo).toFixed(1) 
        : 'N/A';
  
      this.resultados = {
        params,
        electrica: {
          tcoTotal: tcoElectrica,
          compra: params.precio_electrica,
          energia: energiaElectricaAnual * params.años_uso,
          mantenimiento: params.mant_electrica * params.años_uso,
          depreciacion: deprElectrica,
          costoKm: costoKmElectrica,
          datos: datosElectrica
        },
        combustion: {
          tcoTotal: tcoCombustion,
          compra: params.precio_combustion,
          combustible: combustibleAnual * params.años_uso,
          mantenimiento: params.mant_combustion * params.años_uso,
          depreciacion: deprCombustion,
          costoKm: costoKmCombustion,
          datos: datosCombustion
        },
        ahorro: {
          total: ahorroTotal,
          anual: ahorroAnual,
          mensual: ahorroMensual,
          roi: roi,
          breakEven: breakEven
        }
      };
  
      this.mostrarResultados();
      this.renderCharts();
      this.renderTable();
    }
  
    mostrarResultados() {
      const r = this.resultados;
      
      // Mostrar sección
      document.getElementById('resultados-section').style.display = 'block';
      
      // Scroll suave
      document.getElementById('resultados-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
  
      // Eléctrica
      document.getElementById('tco_total_electrica').textContent = this.formatMoney(r.electrica.tcoTotal);
      document.getElementById('compra_electrica').textContent = this.formatMoney(r.electrica.compra);
      document.getElementById('energia_electrica').textContent = this.formatMoney(r.electrica.energia);
      document.getElementById('mant_total_electrica').textContent = this.formatMoney(r.electrica.mantenimiento);
      document.getElementById('depr_electrica').textContent = this.formatMoney(r.electrica.depreciacion);
      document.getElementById('costo_km_electrica').textContent = `$${r.electrica.costoKm.toFixed(2)}`;
  
      // Combustión
      document.getElementById('tco_total_combustion').textContent = this.formatMoney(r.combustion.tcoTotal);
      document.getElementById('compra_combustion').textContent = this.formatMoney(r.combustion.compra);
      document.getElementById('combustible_combustion').textContent = this.formatMoney(r.combustion.combustible);
      document.getElementById('mant_total_combustion').textContent = this.formatMoney(r.combustion.mantenimiento);
      document.getElementById('depr_combustion').textContent = this.formatMoney(r.combustion.depreciacion);
      document.getElementById('costo_km_combustion').textContent = `$${r.combustion.costoKm.toFixed(2)}`;
  
      // Ahorro
      document.getElementById('ahorro_total').textContent = this.formatMoney(r.ahorro.total);
      document.getElementById('ahorro_anual').textContent = this.formatMoney(r.ahorro.anual);
      document.getElementById('ahorro_mensual').textContent = this.formatMoney(r.ahorro.mensual);
      document.getElementById('roi_porcentaje').textContent = `${r.ahorro.roi.toFixed(1)}%`;
      document.getElementById('break_even').textContent = r.ahorro.breakEven === 'N/A' ? 'N/A' : `${r.ahorro.breakEven} años`;
    }
  
    renderCharts() {
      this.destroyCharts();
      const r = this.resultados;
  
      // 1. Comparación Total
      const ctx1 = document.getElementById('chart-comparacion');
      if (ctx1) {
        this.charts.comparacion = new Chart(ctx1, {
          type: 'bar',
          data: {
            labels: ['Eléctrica', 'Combustión'],
            datasets: [{
              label: 'TCO Total (MXN)',
              data: [r.electrica.tcoTotal, r.combustion.tcoTotal],
              backgroundColor: ['#10b981', '#f59e0b']
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { display: false }
            }
          }
        });
      }
  
      // 2. Evolución Acumulada
      const ctx2 = document.getElementById('chart-evolucion');
      if (ctx2) {
        this.charts.evolucion = new Chart(ctx2, {
          type: 'line',
          data: {
            labels: r.electrica.datos.map(d => `Año ${d.año}`),
            datasets: [
              {
                label: 'Eléctrica',
                data: r.electrica.datos.map(d => d.acumulado),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                fill: true
              },
              {
                label: 'Combustión',
                data: r.combustion.datos.map(d => d.acumulado),
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                fill: true
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { position: 'top' }
            }
          }
        });
      }
  
      // 3. Desglose por Categoría
      const ctx3 = document.getElementById('chart-desglose');
      if (ctx3) {
        this.charts.desglose = new Chart(ctx3, {
          type: 'doughnut',
          data: {
            labels: ['Compra', 'Energía/Combustible', 'Mantenimiento', 'Depreciación'],
            datasets: [
              {
                label: 'Eléctrica',
                data: [
                  r.electrica.compra,
                  r.electrica.energia,
                  r.electrica.mantenimiento,
                  r.electrica.depreciacion
                ],
                backgroundColor: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0']
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { position: 'bottom' }
            }
          }
        });
      }
  
      // 4. Costo Anual
      const ctx4 = document.getElementById('chart-anual');
      if (ctx4) {
        this.charts.anual = new Chart(ctx4, {
          type: 'bar',
          data: {
            labels: r.electrica.datos.map(d => `Año ${d.año}`),
            datasets: [
              {
                label: 'Eléctrica',
                data: r.electrica.datos.map(d => d.anual),
                backgroundColor: '#10b981'
              },
              {
                label: 'Combustión',
                data: r.combustion.datos.map(d => d.anual),
                backgroundColor: '#f59e0b'
              }
            ]
          },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: { position: 'top' }
            }
          }
        });
      }
    }
  
    renderTable() {
      const r = this.resultados;
      const tbody = document.getElementById('tabla-body');
      if (!tbody) return;
  
      tbody.innerHTML = '';
  
      for (let i = 0; i < r.electrica.datos.length; i++) {
        const elec = r.electrica.datos[i];
        const comb = r.combustion.datos[i];
        const ahorro = comb.anual - elec.anual;
  
        const row = document.createElement('tr');
        row.innerHTML = `
          <td><strong>Año ${elec.año}</strong></td>
          <td>${this.formatMoney(elec.anual)}</td>
          <td>${this.formatMoney(elec.acumulado)}</td>
          <td>${this.formatMoney(comb.anual)}</td>
          <td>${this.formatMoney(comb.acumulado)}</td>
          <td style="color: ${ahorro > 0 ? '#10b981' : '#ef4444'}; font-weight: 600;">
            ${this.formatMoney(ahorro)}
          </td>
        `;
        tbody.appendChild(row);
      }
    }
  
    destroyCharts() {
      Object.values(this.charts).forEach(chart => {
        if (chart) chart.destroy();
      });
      this.charts = {};
    }
  
    formatMoney(value) {
      return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(value);
    }
  
    exportPDF() {
      alert('Exportación a PDF: Usa Ctrl+P o Cmd+P para imprimir/guardar como PDF');
      window.print();
    }
  
    exportExcel() {
      if (!this.resultados) {
        alert('Primero calcula el TCO');
        return;
      }
  
      const r = this.resultados;
      let csv = 'Año,Eléctrica Anual,Eléctrica Acumulado,Combustión Anual,Combustión Acumulado,Ahorro\n';
      
      for (let i = 0; i < r.electrica.datos.length; i++) {
        const elec = r.electrica.datos[i];
        const comb = r.combustion.datos[i];
        const ahorro = comb.anual - elec.anual;
        csv += `${elec.año},${elec.anual},${elec.acumulado},${comb.anual},${comb.acumulado},${ahorro}\n`;
      }
  
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tco_omomobility_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    }
  
    shareResults() {
      if (!this.resultados) {
        alert('Primero calcula el TCO');
        return;
      }
  
      const r = this.resultados;
      const text = `Modelo TCO Omomobility\n\n` +
        `⚡ Eléctrica: ${this.formatMoney(r.electrica.tcoTotal)}\n` +
        `⛽ Combustión: ${this.formatMoney(r.combustion.tcoTotal)}\n` +
        `💰 Ahorro: ${this.formatMoney(r.ahorro.total)}\n\n` +
        `Calcula tu TCO en: ${window.location.href}`;
  
      if (navigator.share) {
        navigator.share({
          title: 'Modelo TCO - Omomobility',
          text: text
        }).catch(err => console.log('Error compartiendo:', err));
      } else {
        navigator.clipboard.writeText(text).then(() => {
          alert('Resultados copiados al portapapeles');
        });
      }
    }
  }
  
  // Inicializar al cargar la página
  document.addEventListener('DOMContentLoaded', () => {
    new TCOCalculator();
  });