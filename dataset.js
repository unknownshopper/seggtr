// ============================================
// DATASET Y TABULADOS - JAVASCRIPT
// Sistema de exportación y análisis de datos
// ============================================

// Estado global
const DatasetManager = {
    surveys: [],
    filteredSurveys: [],
    currentFilters: {},
    
    // Inicialización
    async init() {
      console.log('[Dataset] Inicializando...');
      await this.loadSurveys();
      this.setupEventListeners();
      this.renderSummaryStats();
      this.renderFieldsList();
      this.populateZoneFilter();
      this.renderDescriptiveStats();
      this.renderBarriersAnalysis();
      this.renderBrandsAnalysis();
      this.renderCorrelations();
      console.log('[Dataset] Inicialización completa');
    },
  
    // Cargar encuestas desde Firebase
    async loadSurveys() {
      try {
        // Intentar cargar desde Firebase primero
        if (window.db) {
          console.log('[Dataset] Cargando desde Firebase...');
          const snapshot = await window.db.collection('surveys').get();
          this.surveys = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          console.log(`[Dataset] ${this.surveys.length} encuestas cargadas desde Firebase`);
        } else {
          console.warn('[Dataset] Firebase no disponible, usando localStorage');
          this.surveys = JSON.parse(localStorage.getItem('surveys') || '[]');
          console.log(`[Dataset] ${this.surveys.length} encuestas cargadas desde localStorage`);
        }
  
        this.filteredSurveys = [...this.surveys];
        
        if (this.surveys.length === 0) {
          console.warn('[Dataset] ⚠️ No hay encuestas disponibles');
          this.showToast('No hay encuestas disponibles. Completa algunas encuestas primero.', 'warning');
        }
      } catch (error) {
        console.error('[Dataset] Error cargando encuestas:', error);
        this.showToast('Error al cargar datos: ' + error.message, 'error');
        // Intentar con localStorage como fallback
        this.surveys = JSON.parse(localStorage.getItem('surveys') || '[]');
        this.filteredSurveys = [...this.surveys];
      }
    },
  
    // Configurar event listeners
    setupEventListeners() {
      // Exportación
      const btnCSVFull = document.getElementById('btn-export-csv-full');
      const btnCSVSummary = document.getElementById('btn-export-csv-summary');
      const btnJSON = document.getElementById('btn-export-json');
      const btnPDF = document.getElementById('btn-export-pdf');
  
      if (btnCSVFull) btnCSVFull.addEventListener('click', () => {
        console.log('[Dataset] Exportando CSV completo...');
        this.exportCSV('full');
      });
      
      if (btnCSVSummary) btnCSVSummary.addEventListener('click', () => {
        console.log('[Dataset] Exportando CSV resumido...');
        this.exportCSV('summary');
      });
      
      if (btnJSON) btnJSON.addEventListener('click', () => {
        console.log('[Dataset] Exportando JSON...');
        this.exportJSON();
      });
      
      if (btnPDF) btnPDF.addEventListener('click', () => {
        console.log('[Dataset] Generando PDF...');
        this.exportPDF(false); // false = descargar
      });
      
      // Agregar botón de preview
      const btnPreviewPDF = document.getElementById('btn-preview-pdf');
      if (btnPreviewPDF) btnPreviewPDF.addEventListener('click', () => {
        console.log('[Dataset] Generando preview PDF...');
        this.exportPDF(true); // true = preview
      });
  
      // Tabulados
      document.getElementById('btn-generate-table')?.addEventListener('click', () => this.generateCrosstab());
      document.getElementById('btn-export-table')?.addEventListener('click', () => this.exportCrosstab());
  
      // Filtros
      document.getElementById('btn-apply-filters')?.addEventListener('click', () => this.applyFilters());
      document.getElementById('btn-clear-filters')?.addEventListener('click', () => this.clearFilters());
  
      // Tabs
      document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
      });
  
      console.log('[Dataset] Event listeners configurados');
    },
  
    // ============================================
    // ESTADÍSTICAS RESUMEN
    // ============================================
    renderSummaryStats() {
      const surveys = this.filteredSurveys;
      
      // Total de encuestas
      document.getElementById('total-surveys').textContent = surveys.length;
  
      // Rango de fechas
      if (surveys.length > 0) {
        const dates = surveys.map(s => new Date(s.timestamp || Date.now())).sort((a, b) => a - b);
        const minDate = dates[0].toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
        const maxDate = dates[dates.length - 1].toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
        document.getElementById('date-range').textContent = `${minDate} - ${maxDate}`;
      }
  
      // Zonas únicas
      const uniqueZones = new Set(surveys.map(s => s.zona).filter(Boolean));
      document.getElementById('unique-zones').textContent = uniqueZones.size;
  
      // Intención promedio
      const intentions = surveys.map(s => parseFloat(s.intencion)).filter(n => !isNaN(n));
      const avgIntention = intentions.length > 0 
        ? (intentions.reduce((a, b) => a + b, 0) / intentions.length).toFixed(1)
        : '0.0';
      document.getElementById('avg-intention').textContent = avgIntention;
    },
  
    // ============================================
    // EXPORTACIÓN CSV
    // ============================================
    exportCSV(type = 'full') {
        console.log(`[Dataset] Iniciando exportación CSV ${type}...`);
        const surveys = this.filteredSurveys;
        
        if (surveys.length === 0) {
          console.warn('[Dataset] No hay datos para exportar');
          this.showToast('No hay datos para exportar. Completa algunas encuestas primero.', 'warning');
          return;
        }
      
        try {
          let headers, rows;
      
          if (type === 'summary') {
            // CSV Resumido
            headers = ['ID', 'Fecha', 'Encuestador', 'Edad', 'Zona', 'Ocupación', 'Uso', 'Usa Moto', 'Intención', 'Barreras', 'Marca', 'Disp. Pagar'];
            rows = surveys.map(s => [
              s.id || '',
              new Date(s.timestamp || Date.now()).toLocaleDateString('es-MX'),
              s.encuestador_id || s.encuestador || '',
              s.edad || '',
              s.zona || '',
              s.ocupacion || '',
              s.uso || '',
              s.usaMoto || '',
              s.intencion || '',
              Array.isArray(s.barreras) ? s.barreras.join('; ') : (s.barreras || ''),
              s.marca || '',
              s.pago || ''
            ]);
          } else {
            // CSV Completo - todos los campos
            const allKeys = new Set();
            surveys.forEach(s => Object.keys(s).forEach(k => allKeys.add(k)));
            headers = Array.from(allKeys);
            
            rows = surveys.map(s => 
              headers.map(h => {
                const val = s[h];
                if (Array.isArray(val)) return val.join('; ');
                if (typeof val === 'object' && val !== null) return JSON.stringify(val);
                return val || '';
              })
            );
          }
      
          console.log(`[Dataset] Generando CSV con ${rows.length} filas y ${headers.length} columnas`);
      
          // Agregar metadata al inicio
          const metadata = [
            ['# Omomobility - Estudio de Mercado'],
            [`# Generado: ${new Date().toLocaleString('es-MX')}`],
            [`# Total de registros: ${rows.length}`],
            ['# Desarrollado por The Unknown Shopper'],
            ['# www.unknownshoppers.com'],
            ['']
          ];
      
          // Generar CSV
          const csvContent = [
            ...metadata.map(row => row.join(',')),
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
          ].join('\n');
      
          // Descargar
          const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          const filename = `omomobility_dataset_${type}_${new Date().toISOString().split('T')[0]}.csv`;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
      
          console.log(`[Dataset] ✅ CSV exportado: ${filename}`);
          this.showToast(`CSV ${type === 'full' ? 'completo' : 'resumido'} exportado exitosamente`, 'success');
        } catch (error) {
          console.error('[Dataset] Error exportando CSV:', error);
          this.showToast('Error al exportar CSV: ' + error.message, 'error');
        }
      },
  
    // ============================================
    // EXPORTACIÓN JSON
    // ============================================
    exportJSON() {
        console.log('[Dataset] Iniciando exportación JSON...');
        const surveys = this.filteredSurveys;
        
        if (surveys.length === 0) {
          this.showToast('No hay datos para exportar', 'warning');
          return;
        }
      
        try {
          const jsonData = {
            metadata: {
              proyecto: 'Omomobility - Estudio de Mercado',
              total: surveys.length,
              exportDate: new Date().toISOString(),
              generatedBy: 'The Unknown Shopper',
              website: 'www.unknownshoppers.com',
              filters: this.currentFilters
            },
            data: surveys
          };
      
          const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          const filename = `omomobility_dataset_${new Date().toISOString().split('T')[0]}.json`;
          link.download = filename;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
      
          console.log(`[Dataset] ✅ JSON exportado: ${filename}`);
          this.showToast('JSON exportado exitosamente', 'success');
        } catch (error) {
          console.error('[Dataset] Error exportando JSON:', error);
          this.showToast('Error al exportar JSON: ' + error.message, 'error');
        }
      },
  
    // ============================================
    // EXPORTACIÓN PDF
    // ============================================
  
    async exportPDF(preview = false) {
        console.log(`[Dataset] ${preview ? 'Generando preview' : 'Exportando'} PDF completo...`);
        
        if (this.filteredSurveys.length === 0) {
          this.showToast('No hay datos para exportar', 'warning');
          return;
        }
      
        try {
          if (typeof window.jspdf === 'undefined') {
            console.error('[Dataset] jsPDF no está cargado');
            this.showToast('Librería PDF no disponible. Recarga la página.', 'error');
            return;
          }
      
          const { jsPDF } = window.jspdf;
          const doc = new jsPDF();
          let currentY = 20;
          const pageHeight = 280; // Altura útil de la página
          const margin = 14;
      
          // Función helper para verificar espacio y agregar página si es necesario
          const checkPageBreak = (neededSpace) => {
            if (currentY + neededSpace > pageHeight) {
              doc.addPage();
              currentY = 20;
              return true;
            }
            return false;
          };
      
       // ============================================
        // PORTADA
        // ============================================
        doc.setFontSize(24);
        doc.setTextColor(30, 136, 229);
        doc.text('Reporte de Dataset', 105, currentY, { align: 'center' });

        currentY += 10;
        doc.setFontSize(18);
        doc.text('Omomobility - Estudio de Mercado', 105, currentY, { align: 'center' });

        currentY += 15;
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(`Fecha de generación: ${new Date().toLocaleDateString('es-MX', { 
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
        })}`, 105, currentY, { align: 'center' });

        currentY += 6;
        doc.text(`Total de encuestas analizadas: ${this.filteredSurveys.length}`, 105, currentY, { align: 'center' });

        if (this.filteredSurveys.length > 0) {
        const dates = this.filteredSurveys.map(s => new Date(s.timestamp || Date.now())).sort((a, b) => a - b);
        const minDate = dates[0].toLocaleDateString('es-MX');
        const maxDate = dates[dates.length - 1].toLocaleDateString('es-MX');
        currentY += 6;
        doc.text(`Período: ${minDate} - ${maxDate}`, 105, currentY, { align: 'center' });
        }

        // BRANDING - The Unknown Shopper
        currentY += 30;
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text('_______________________________________________', 105, currentY, { align: 'center' });
        currentY += 8;
        doc.setFontSize(12);
        doc.setTextColor(30, 136, 229);
        doc.setFont(undefined, 'bold');
        doc.text('Desarrollado por The Unknown Shopper', 105, currentY, { align: 'center' });
        currentY += 6;
        doc.setFontSize(9);
        doc.setTextColor(100, 100, 100);
        doc.setFont(undefined, 'normal');
        doc.text('Investigación de Mercados y Estudios de Consumidor', 105, currentY, { align: 'center' });
      
          // ============================================
          // RESUMEN EJECUTIVO
          // ============================================
          doc.addPage();
          currentY = 20;
          
          doc.setFontSize(16);
          doc.setTextColor(30, 136, 229);
          doc.text('1. Resumen Ejecutivo', margin, currentY);
          currentY += 10;
      
          const intentions = this.filteredSurveys.map(s => parseFloat(s.intencion)).filter(n => !isNaN(n));
          const avgIntention = intentions.length > 0 
            ? (intentions.reduce((a, b) => a + b, 0) / intentions.length).toFixed(1)
            : '0.0';
          
          const uniqueZones = new Set(this.filteredSurveys.map(s => s.zona).filter(Boolean));
          const avgAge = this.filteredSurveys.map(s => parseFloat(s.edad)).filter(n => !isNaN(n));
          const avgAgeValue = avgAge.length > 0 
            ? (avgAge.reduce((a, b) => a + b, 0) / avgAge.length).toFixed(1)
            : '0';
      
          const kpiData = [
            ['KPI', 'Valor'],
            ['Total de encuestas', this.filteredSurveys.length.toString()],
            ['Zonas cubiertas', uniqueZones.size.toString()],
            ['Intención de compra promedio', `${avgIntention}/10`],
            ['Edad promedio', `${avgAgeValue} años`],
            ['Encuestas con alta intención (7-10)', intentions.filter(i => i >= 7).length.toString()],
            ['Tasa de conversión potencial', `${((intentions.filter(i => i >= 7).length / intentions.length) * 100).toFixed(1)}%`]
          ];
      
          if (doc.autoTable) {
            doc.autoTable({
              startY: currentY,
              head: [kpiData[0]],
              body: kpiData.slice(1),
              theme: 'grid',
              headStyles: { fillColor: [30, 136, 229], fontSize: 10, fontStyle: 'bold' },
              styles: { fontSize: 9 },
              margin: { left: margin, right: margin }
            });
            currentY = doc.lastAutoTable.finalY + 10;
          }
      
          // ============================================
          // ESTADÍSTICA DESCRIPTIVA
          // ============================================
          checkPageBreak(40);
          
          doc.setFontSize(16);
          doc.setTextColor(30, 136, 229);
          doc.text('2. Estadística Descriptiva', margin, currentY);
          currentY += 10;
      
          const summaryData = this.getDescriptiveStatsData();
          
          if (doc.autoTable) {
            doc.autoTable({
              startY: currentY,
              head: [['Variable', 'n', 'Media', 'Mediana', 'Desv. Est.', 'Mín', 'Máx']],
              body: summaryData.map(row => [row.variable, row.n, row.mean, row.median, row.std, row.min, row.max]),
              theme: 'striped',
              headStyles: { fillColor: [30, 136, 229], fontSize: 9 },
              styles: { fontSize: 8 },
              margin: { left: margin, right: margin }
            });
            currentY = doc.lastAutoTable.finalY + 10;
          }
      
            // ============================================
            // DISTRIBUCIÓN POR ZONA
            // ============================================

            const zoneCounts = {};
            this.filteredSurveys.forEach(s => {
            const zona = s.zona || 'No especificada';
            zoneCounts[zona] = (zoneCounts[zona] || 0) + 1;
            });

            const zoneData = Object.entries(zoneCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([zona, count]) => [zona, count, `${((count / this.filteredSurveys.length) * 100).toFixed(1)}%`]);

            // Calcular espacio necesario: header (10) + título (20) + filas (zoneData.length * 8) + margen (20)
            const neededSpace = 50 + (zoneData.length * 8);

            // Si no hay suficiente espacio, forzar nueva página
            if (currentY + neededSpace > pageHeight) {
            doc.addPage();
            currentY = 20;
            }

            doc.setFontSize(16);
            doc.setTextColor(30, 136, 229);
            doc.text('3. Distribución por Zona', margin, currentY);
            currentY += 10;

            if (doc.autoTable) {
            doc.autoTable({
                startY: currentY,
                head: [['Zona', 'Frecuencia', 'Porcentaje']],
                body: zoneData,
                theme: 'striped',
                headStyles: { fillColor: [30, 136, 229], fontSize: 9 },
                styles: { fontSize: 8 },
                margin: { left: margin, right: margin }
            });
            currentY = doc.lastAutoTable.finalY + 10;
            }
      
          // ============================================
            // DISTRIBUCIÓN POR OCUPACIÓN
            // ============================================

            const occupationCounts = {};
            this.filteredSurveys.forEach(s => {
            const occ = s.ocupacion || 'No especificada';
            occupationCounts[occ] = (occupationCounts[occ] || 0) + 1;
            });

            const occupationData = Object.entries(occupationCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([occ, count]) => [occ, count, `${((count / this.filteredSurveys.length) * 100).toFixed(1)}%`]);

            // Calcular espacio necesario
            const neededSpaceOcc = 50 + (occupationData.length * 8);

            // Si no hay suficiente espacio, forzar nueva página
            if (currentY + neededSpaceOcc > pageHeight) {
            doc.addPage();
            currentY = 20;
            }

            doc.setFontSize(16);
            doc.setTextColor(30, 136, 229);
            doc.text('4. Distribución por Ocupación', margin, currentY);
            currentY += 10;

            if (doc.autoTable) {
            doc.autoTable({
                startY: currentY,
                head: [['Ocupación', 'Frecuencia', 'Porcentaje']],
                body: occupationData,
                theme: 'striped',
                headStyles: { fillColor: [30, 136, 229], fontSize: 9 },
                styles: { fontSize: 8 },
                margin: { left: margin, right: margin }
            });
            currentY = doc.lastAutoTable.finalY + 10;
            }
      
          // ============================================
          // ANÁLISIS DE BARRERAS
          // ============================================
          doc.addPage();
          currentY = 20;
      
          doc.setFontSize(16);
          doc.setTextColor(30, 136, 229);
          doc.text('5. Principales Barreras de Compra', margin, currentY);
          currentY += 10;
      
          const barrierCounts = {};
          this.filteredSurveys.forEach(s => {
            let barriers = s.barreras || [];
            if (!Array.isArray(barriers)) {
              barriers = typeof barriers === 'string' ? barriers.split(',').map(b => b.trim()) : [];
            }
            barriers.forEach(b => {
              if (b && b.trim()) {
                barrierCounts[b] = (barrierCounts[b] || 0) + 1;
              }
            });
          });
      
          const barrierData = Object.entries(barrierCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([barrier, count]) => [barrier, count, `${((count / this.filteredSurveys.length) * 100).toFixed(1)}%`]);
      
          if (doc.autoTable && barrierData.length > 0) {
            doc.autoTable({
              startY: currentY,
              head: [['Barrera', 'Menciones', '% del Total']],
              body: barrierData,
              theme: 'striped',
              headStyles: { fillColor: [239, 68, 68], fontSize: 9 },
              styles: { fontSize: 8 },
              margin: { left: margin, right: margin }
            });
            currentY = doc.lastAutoTable.finalY + 10;
          }
      
          // ============================================
            // PIE DE PÁGINA EN TODAS LAS PÁGINAS
            // ============================================
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(8);
            doc.setTextColor(150, 150, 150);
            doc.text(
                `Página ${i} de ${pageCount} | Generado: ${new Date().toLocaleDateString('es-MX')}`,
                105,
                287,
                { align: 'center' }
            );
            doc.setFontSize(7);
            doc.setTextColor(100, 100, 100);
            doc.text(
                'Desarrollado por The Unknown Shopper | www.unknownshoppers.com',
                105,
                292,
                { align: 'center' }
            );
            }
      
          // Preview o descarga
          if (preview) {
            const pdfBlob = doc.output('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);
            this.showPDFPreview(pdfUrl);
          } else {
            const filename = `omomobility_reporte_${new Date().toISOString().split('T')[0]}.pdf`;
            doc.save(filename);
            console.log(`[Dataset] ✅ PDF generado: ${filename}`);
            this.showToast('PDF generado exitosamente con ' + pageCount + ' páginas', 'success');
          }
        } catch (error) {
          console.error('[Dataset] Error generando PDF:', error);
          this.showToast('Error al generar PDF: ' + error.message, 'error');
        }
      },
      
      showPDFPreview(pdfUrl) {
        // Crear modal si no existe
        let modal = document.getElementById('pdf-preview-modal');
        if (!modal) {
          modal = document.createElement('div');
          modal.id = 'pdf-preview-modal';
          modal.className = 'pdf-preview-modal';
          modal.innerHTML = `
            <div class="pdf-preview-content">
              <div class="pdf-preview-header">
                <h3 style="margin: 0;">Vista Previa del Reporte PDF</h3>
                <div>
                  <button class="btn" id="btn-download-from-preview">Descargar PDF</button>
                  <button class="btn outline" id="btn-close-preview" style="margin-left: 8px;">Cerrar</button>
                </div>
              </div>
              <div class="pdf-preview-body">
                <iframe id="pdf-iframe"></iframe>           
              </div>
            </div>
          `;
          document.body.appendChild(modal);
      
          // Event listeners
          document.getElementById('btn-close-preview').addEventListener('click', () => {
            modal.classList.remove('active');
            const iframe = document.getElementById('pdf-iframe');
            iframe.src = ''; // Limpiar iframe
          });
      
          document.getElementById('btn-download-from-preview').addEventListener('click', () => {
            const iframe = document.getElementById('pdf-iframe');
            const currentUrl = iframe.src;
            const link = document.createElement('a');
            link.href = currentUrl;
            link.download = `omomobility_reporte_${new Date().toISOString().split('T')[0]}.pdf`;
            link.click();
            this.showToast('PDF descargado', 'success');
          });
      
          // Cerrar al hacer clic fuera del modal
          modal.addEventListener('click', (e) => {
            if (e.target === modal) {
              modal.classList.remove('active');
              const iframe = document.getElementById('pdf-iframe');
              iframe.src = '';
            }
          });
        }
      
        // Mostrar modal con PDF
        const iframe = document.getElementById('pdf-iframe');
        iframe.src = pdfUrl;
        modal.classList.add('active');
        
        console.log('[Dataset] Preview PDF abierto:', pdfUrl);
      },


    // ============================================
    // TABULADOS CRUZADOS
    // ============================================
    generateCrosstab() {
      const rowVar = document.getElementById('var-rows').value;
      const colVar = document.getElementById('var-cols').value;
      const displayMode = document.getElementById('display-mode').value;
  
      const surveys = this.filteredSurveys;
      if (surveys.length === 0) {
        this.showToast('No hay datos para tabular', 'warning');
        return;
      }
  
      // Procesar variables
      const processedData = surveys.map(s => ({
        row: this.getGroupedValue(s, rowVar),
        col: this.getGroupedValue(s, colVar)
      })).filter(d => d.row && d.col);
  
      // Crear matriz de frecuencias
      const rowValues = [...new Set(processedData.map(d => d.row))].sort();
      const colValues = [...new Set(processedData.map(d => d.col))].sort();
      
      const matrix = {};
      rowValues.forEach(r => {
        matrix[r] = {};
        colValues.forEach(c => {
          matrix[r][c] = 0;
        });
      });
  
      processedData.forEach(d => {
        matrix[d.row][d.col]++;
      });
  
      // Calcular totales
      const rowTotals = {};
      const colTotals = {};
      let grandTotal = 0;
  
      rowValues.forEach(r => {
        rowTotals[r] = Object.values(matrix[r]).reduce((a, b) => a + b, 0);
        grandTotal += rowTotals[r];
      });
  
      colValues.forEach(c => {
        colTotals[c] = rowValues.reduce((sum, r) => sum + matrix[r][c], 0);
      });
  
      // Renderizar tabla
      this.renderCrosstabTable(matrix, rowValues, colValues, rowTotals, colTotals, grandTotal, displayMode);
    },
  
    renderCrosstabTable(matrix, rowValues, colValues, rowTotals, colTotals, grandTotal, displayMode) {
      const container = document.getElementById('tabulation-result');
      
      let html = '<table class="crosstab-table"><thead><tr><th></th>';
      colValues.forEach(c => html += `<th>${c}</th>`);
      html += '<th>Total</th></tr></thead><tbody>';
  
      rowValues.forEach(r => {
        html += `<tr><th>${r}</th>`;
        colValues.forEach(c => {
          const count = matrix[r][c];
          let displayValue = count;
  
          if (displayMode === 'percent-row') {
            displayValue = rowTotals[r] > 0 ? ((count / rowTotals[r]) * 100).toFixed(1) + '%' : '0%';
          } else if (displayMode === 'percent-col') {
            displayValue = colTotals[c] > 0 ? ((count / colTotals[c]) * 100).toFixed(1) + '%' : '0%';
          } else if (displayMode === 'percent-total') {
            displayValue = grandTotal > 0 ? ((count / grandTotal) * 100).toFixed(1) + '%' : '0%';
          }
  
          html += `<td>${displayValue}</td>`;
        });
        html += `<td><strong>${rowTotals[r]}</strong></td></tr>`;
      });
  
      // Fila de totales
      html += '<tr class="total-row"><th>Total</th>';
      colValues.forEach(c => html += `<td><strong>${colTotals[c]}</strong></td>`);
      html += `<td><strong>${grandTotal}</strong></td></tr>`;
      html += '</tbody></table>';
  
      container.innerHTML = html;
    },
  
    exportCrosstab() {
      const table = document.querySelector('.crosstab-table');
      if (!table) {
        this.showToast('Genera una tabla primero', 'warning');
        return;
      }
  
      // Convertir tabla a CSV
      const rows = Array.from(table.querySelectorAll('tr'));
      const csv = rows.map(row => 
        Array.from(row.querySelectorAll('th, td'))
          .map(cell => `"${cell.textContent.trim()}"`)
          .join(',')
      ).join('\n');
  
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `tabulado_cruzado_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
  
      this.showToast('Tabulado exportado exitosamente', 'success');
    },
  
    // Obtener valor agrupado de una variable
    getGroupedValue(survey, varName) {
      if (varName === 'edad_grupo') {
        const edad = parseInt(survey.edad);
        if (isNaN(edad)) return 'N/A';
        if (edad < 25) return '15-24';
        if (edad < 35) return '25-34';
        if (edad < 45) return '35-44';
        if (edad < 55) return '45-54';
        return '55+';
      }
  
      if (varName === 'intencion_grupo') {
        const int = parseInt(survey.intencion);
        if (isNaN(int)) return 'N/A';
        if (int <= 3) return 'Baja (0-3)';
        if (int <= 6) return 'Media (4-6)';
        return 'Alta (7-10)';
      }
  
      return survey[varName] || 'N/A';
    },
  
    // ============================================
    // ESTADÍSTICA DESCRIPTIVA
    // ============================================
    renderDescriptiveStats() {
      const data = this.getDescriptiveStatsData();
      const tbody = document.querySelector('#descriptive-table tbody');
      
      if (!tbody) return;
      
      tbody.innerHTML = data.map(row => `
        <tr>
          <td>${row.variable}</td>
          <td>${row.n}</td>
          <td>${row.mean}</td>
          <td>${row.median}</td>
          <td>${row.std}</td>
          <td>${row.min}</td>
          <td>${row.max}</td>
        </tr>
      `).join('');
  
      // Variables categóricas
      this.renderCategoricalStats();
    },
  
    getDescriptiveStatsData() {
      const surveys = this.filteredSurveys;
      const numericVars = ['edad', 'intencion', 'pago', 'favorabilidad_omo'];
      
      return numericVars.map(varName => {
        const values = surveys.map(s => parseFloat(s[varName])).filter(n => !isNaN(n));
        
        if (values.length === 0) {
          return { variable: varName, n: 0, mean: '-', median: '-', std: '-', min: '-', max: '-' };
        }
  
        const sorted = values.sort((a, b) => a - b);
        const mean = (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2);
        const median = sorted[Math.floor(sorted.length / 2)].toFixed(2);
        const variance = values.reduce((sum, val) => sum + Math.pow(val - parseFloat(mean), 2), 0) / values.length;
        const std = Math.sqrt(variance).toFixed(2);
        const min = Math.min(...values).toFixed(2);
        const max = Math.max(...values).toFixed(2);
  
        return { variable: varName, n: values.length, mean, median, std, min, max };
      });
    },
  
    renderCategoricalStats() {
      const surveys = this.filteredSurveys;
      const catVars = ['zona', 'ocupacion', 'sexo', 'uso', 'usaMoto'];
      const tbody = document.querySelector('#categorical-table tbody');
      
      if (!tbody) return;
      
      let html = '';
      catVars.forEach(varName => {
        const counts = {};
        surveys.forEach(s => {
          const val = s[varName] || 'N/A';
          counts[val] = (counts[val] || 0) + 1;
        });
  
        Object.entries(counts).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
          const pct = ((count / surveys.length) * 100).toFixed(1);
          html += `<tr>
            <td>${varName}</td>
            <td>${cat}</td>
            <td>${count}</td>
            <td>${pct}%</td>
          </tr>`;
        });
      });
  
      tbody.innerHTML = html;
    },
  
    // ============================================
    // ANÁLISIS DE BARRERAS
    // ============================================
    renderBarriersAnalysis() {
        const surveys = this.filteredSurveys;
        const barrierCounts = {};
      
        surveys.forEach(s => {
          let barriers = s.barreras || [];
          // Asegurar que sea un array
          if (!Array.isArray(barriers)) {
            barriers = typeof barriers === 'string' ? barriers.split(',').map(b => b.trim()) : [];
          }
          barriers.forEach(b => {
            if (b && b.trim()) {
              barrierCounts[b] = (barrierCounts[b] || 0) + 1;
            }
          });
        });
      
        const sorted = Object.entries(barrierCounts).sort((a, b) => b[1] - a[1]);
        const tbody = document.querySelector('#barriers-table tbody');
      
        if (!tbody) return;
      
        tbody.innerHTML = sorted.map(([barrier, count]) => {
          const pct = ((count / surveys.length) * 100).toFixed(1);
          const barWidth = Math.min(100, (count / surveys.length) * 200);
          
          return `<tr>
            <td>${barrier}</td>
            <td>${count}</td>
            <td>${pct}%</td>
            <td>
              <div class="progress-bar-cell">
                <div class="progress-bar-mini">
                  <div class="progress-fill-mini" style="width: ${barWidth}%"></div>
                </div>
              </div>
            </td>
          </tr>`;
        }).join('');
      },
  
    // ============================================
    // ANÁLISIS DE MARCAS
    // ============================================
    renderBrandsAnalysis() {
        const surveys = this.filteredSurveys;
        const brandData = {};
      
        surveys.forEach(s => {
          // Menciones espontáneas
          if (s.marca_espontanea) {
            const brands = s.marca_espontanea.split(',').map(b => b.trim());
            brands.forEach(b => {
              if (b) {
                if (!brandData[b]) brandData[b] = { spontaneous: 0, assisted: 0 };
                brandData[b].spontaneous++;
              }
            });
          }
      
          // Menciones asistidas
          let assisted = s.marca_asistida || [];
          if (!Array.isArray(assisted)) {
            assisted = typeof assisted === 'string' ? assisted.split(',').map(b => b.trim()) : [];
          }
          assisted.forEach(b => {
            if (b && b.trim()) {
              if (!brandData[b]) brandData[b] = { spontaneous: 0, assisted: 0 };
              brandData[b].assisted++;
            }
          });
        });
      
        const sorted = Object.entries(brandData)
          .map(([brand, data]) => ({
            brand,
            spontaneous: data.spontaneous,
            assisted: data.assisted,
            total: data.spontaneous + data.assisted
          }))
          .sort((a, b) => b.total - a.total);
      
        const tbody = document.querySelector('#brands-table tbody');
        if (!tbody) return;
      
        tbody.innerHTML = sorted.map(item => {
          const awareness = ((item.total / surveys.length) * 100).toFixed(1);
          return `<tr>
            <td>${item.brand}</td>
            <td>${item.spontaneous}</td>
            <td>${item.assisted}</td>
            <td>${item.total}</td>
            <td>${awareness}%</td>
          </tr>`;
        }).join('');
      },
  
    // ============================================
    // CORRELACIONES
    // ============================================
    renderCorrelations() {
      const surveys = this.filteredSurveys;
      const vars = ['edad', 'intencion', 'pago', 'favorabilidad_omo'];
      const correlations = {};
  
      vars.forEach(v1 => {
        correlations[v1] = {};
        vars.forEach(v2 => {
          correlations[v1][v2] = this.calculateCorrelation(surveys, v1, v2);
        });
      });
  
      const tbody = document.querySelector('#correlation-table tbody');
      if (!tbody) return;
  
      tbody.innerHTML = vars.map(v1 => {
        let html = `<tr><th>${v1}</th>`;
        vars.forEach(v2 => {
          const corr = correlations[v1][v2];
          const corrClass = this.getCorrelationClass(corr);
          html += `<td class="${corrClass}">${corr.toFixed(3)}</td>`;
        });
        html += '</tr>';
        return html;
      }).join('');
    },
  
    calculateCorrelation(surveys, var1, var2) {
      const pairs = surveys.map(s => ({
        x: parseFloat(s[var1]),
        y: parseFloat(s[var2])
      })).filter(p => !isNaN(p.x) && !isNaN(p.y));
  
      if (pairs.length < 2) return 0;
  
      const n = pairs.length;
      const sumX = pairs.reduce((sum, p) => sum + p.x, 0);
      const sumY = pairs.reduce((sum, p) => sum + p.y, 0);
      const sumXY = pairs.reduce((sum, p) => sum + p.x * p.y, 0);
      const sumX2 = pairs.reduce((sum, p) => sum + p.x * p.x, 0);
      const sumY2 = pairs.reduce((sum, p) => sum + p.y * p.y, 0);
  
      const numerator = n * sumXY - sumX * sumY;
      const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  
      return denominator === 0 ? 0 : numerator / denominator;
    },
  
    getCorrelationClass(corr) {
      if (corr > 0.7) return 'corr-strong-positive';
      if (corr > 0.3) return 'corr-moderate-positive';
      if (corr < -0.7) return 'corr-strong-negative';
      if (corr < -0.3) return 'corr-moderate-negative';
      return 'corr-weak';
    },
  
    // ============================================
    // FILTROS
    // ============================================
    applyFilters() {
      const filters = {
        edadMin: parseInt(document.getElementById('filter-edad-min').value) || null,
        edadMax: parseInt(document.getElementById('filter-edad-max').value) || null,
        zona: document.getElementById('filter-zona').value || null,
        ocupacion: document.getElementById('filter-ocupacion').value || null,
        intencionMin: parseInt(document.getElementById('filter-intencion-min').value) || null
      };
  
      this.currentFilters = filters;
      this.filteredSurveys = this.surveys.filter(s => {
        if (filters.edadMin && parseInt(s.edad) < filters.edadMin) return false;
        if (filters.edadMax && parseInt(s.edad) > filters.edadMax) return false;
        if (filters.zona && s.zona !== filters.zona) return false;
        if (filters.ocupacion && s.ocupacion !== filters.ocupacion) return false;
        if (filters.intencionMin && parseInt(s.intencion) < filters.intencionMin) return false;
        return true;
      });
  
      document.getElementById('filter-status').textContent = 
        `${this.filteredSurveys.length} de ${this.surveys.length} encuestas`;
  
      this.renderSummaryStats();
      this.renderDescriptiveStats();
      this.renderBarriersAnalysis();
      this.renderBrandsAnalysis();
      this.renderCorrelations();
  
      this.showToast('Filtros aplicados', 'success');
    },
  
    clearFilters() {
      document.getElementById('filter-edad-min').value = '';
      document.getElementById('filter-edad-max').value = '';
      document.getElementById('filter-zona').value = '';
      document.getElementById('filter-ocupacion').value = '';
      document.getElementById('filter-intencion-min').value = '';
      document.getElementById('filter-status').textContent = '';
  
      this.currentFilters = {};
      this.filteredSurveys = [...this.surveys];
  
      this.renderSummaryStats();
      this.renderDescriptiveStats();
      this.renderBarriersAnalysis();
      this.renderBrandsAnalysis();
      this.renderCorrelations();
  
      this.showToast('Filtros limpiados', 'success');
    },
  
    populateZoneFilter() {
      const zones = [...new Set(this.surveys.map(s => s.zona).filter(Boolean))].sort();
      const select = document.getElementById('filter-zona');
      if (!select) return;
      
      zones.forEach(zone => {
        const option = document.createElement('option');
        option.value = zone;
        option.textContent = zone;
        select.appendChild(option);
      });
    },
  
    // ============================================
    // UTILIDADES
    // ============================================
    renderFieldsList() {
      if (this.surveys.length === 0) return;
      
      const allFields = new Set();
      this.surveys.forEach(s => Object.keys(s).forEach(k => allFields.add(k)));
      
      const list = document.getElementById('fields-list');
      if (!list) return;
      
      list.innerHTML = Array.from(allFields).sort().map(field => 
        `<li>${field}</li>`
      ).join('');
    },
  
    switchTab(tabName) {
      document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
      
      const tabBtn = document.querySelector(`[data-tab="${tabName}"]`);
      const tabPanel = document.getElementById(`tab-${tabName}`);
      
      if (tabBtn) tabBtn.classList.add('active');
      if (tabPanel) tabPanel.classList.add('active');
    },
  
    showToast(message, type = 'success') {
      const toast = document.createElement('div');
      toast.className = `toast ${type}`;
      toast.textContent = message;
      document.body.appendChild(toast);
  
      setTimeout(() => {
        toast.remove();
      }, 3000);
    }
  };
  
  // Inicializar cuando el DOM esté listo
  document.addEventListener('DOMContentLoaded', () => {
    console.log('[Dataset] DOM cargado, esperando autenticación...');
    
    // Esperar a que Firebase esté listo
    const initDataset = () => {
      if (window.fbAuth && window.fbAuth.currentUser) {
        console.log('[Dataset] Usuario autenticado, inicializando...');
        DatasetManager.init();
      } else {
        console.log('[Dataset] Esperando autenticación...');
        setTimeout(initDataset, 500);
      }
    };
  
    if (window.fbAuth) {
      window.fbAuth.onAuthStateChanged((user) => {
        if (user) {
          console.log('[Dataset] Usuario autenticado:', user.email);
          DatasetManager.init();
        } else {
          console.log('[Dataset] No hay usuario autenticado');
        }
      });
    } else {
      // Si no hay Firebase, iniciar de todos modos con localStorage
      console.log('[Dataset] Firebase no disponible, usando localStorage');
      setTimeout(() => DatasetManager.init(), 1000);
    }
  });