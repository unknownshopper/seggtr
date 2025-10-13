// Datos simulados realistas para Villahermosa, Tabasco
const SimulatedData = {
  // Cache para evitar regeneración excesiva
  _cachedData: null,
  _lastGeneration: 0,
  _generationCooldown: 1000, // 1 segundo entre generaciones
  
  generateRealisticSurveys() {
    // Verificar cooldown para evitar generación excesiva
    const now = Date.now();
    if (this._cachedData && (now - this._lastGeneration) < this._generationCooldown) {
      console.log('Usando datos en cache para evitar regeneración excesiva');
      return this._cachedData;
    }
    
    console.log('Generando nuevos datos simulados...');
      const surveys = [];
      
      // Distribución por zonas
      const zones = [
        { name: 'Centro', count: 100, socioeconomic: 'medio-bajo' },
        { name: 'Plaza Las Américas', count: 100, socioeconomic: 'medio-alto' },
        { name: 'Mercado Pino Suárez', count: 50, socioeconomic: 'bajo' }
      ];
      
      zones.forEach(zone => {
        for (let i = 0; i < zone.count; i++) {
          surveys.push(this.generateSurvey(zone));
        }
      });
      
    // Guardar en cache
    this._cachedData = surveys;
    this._lastGeneration = now;
    console.log(`Datos simulados generados: ${surveys.length} encuestas`);
    
    return surveys;
    },
    
    generateSurvey(zone) {
      // Generar awareness primero para usarlo en fuente_conocimiento
      const awareness_omo = this.randomOmomobilityAwareness();
      
      const survey = {
        ts: this.randomDate(),
        zona: zone.name,
        edad: this.randomAge(),
        sexo: this.randomGender(),
        ocupacion: this.randomOccupation(zone.socioeconomic),
        uso: this.randomUse(),
        usaMoto: this.randomMotorcycleUse(),
        intencion: this.randomIntention(zone.socioeconomic),
        barreras: this.randomBarriers(),
        marca: this.randomBrand(),
        pago: this.randomPayment(zone.socioeconomic),
        ingreso: this.randomIncome(zone.socioeconomic),
        hogar: this.randomHousehold(),
        vehiculos: this.randomVehicles(),
        
        // Conocimiento de marca (14% conoce Omomobility)
        marca_espontanea: this.randomSpontaneousBrand(),
        marca_asistida: this.randomAssistedBrand(),
        awareness_omo: awareness_omo,
        fuente_conocimiento: this.randomSourceKnowledge(awareness_omo),
        favorabilidad_omo: this.randomFavorability(),
        
        // Intención y uso
        horizonte: this.randomTimeframe(),
        frecuencia: this.randomFrequency(),
        km_dia: this.randomDailyKm(),
        posee_cargador: this.randomChargerAccess(zone.socioeconomic),
        
        // Financiamiento
        financia: this.randomFinancing(),
        pago_mensual: this.randomMonthlyPayment(zone.socioeconomic),
        enganche: this.randomDownPayment(zone.socioeconomic),
        plazo: this.randomTerm(),
        precio_objetivo: this.randomTargetPrice(zone.socioeconomic),
        
        // Atributos valorados (1-5)
        atr_precio: this.randomAttribute(4.5),
        atr_autonomia: this.randomAttribute(4.2),
        atr_desempeno: this.randomAttribute(3.8),
        atr_diseno: this.randomAttribute(3.5),
        atr_garantia: this.randomAttribute(4.0),
        atr_servicio: this.randomAttribute(4.1),
        atr_refacciones: this.randomAttribute(4.3),
        atr_tiempo_carga: this.randomAttribute(3.9),
        atr_conectividad: this.randomAttribute(2.8),
        atr_seguridad: this.randomAttribute(4.4),
        
        // Barreras extendidas
        barreras_ext: this.randomExtendedBarriers(),
        
        // Ambiente
        amb_motiva: this.randomEnvironmentalMotivation(),
        amb_ansiedad_autonomia: this.randomRangeAnxiety(),
        amb_ruido: this.randomNoiseValue(),
        
        // Canales
        can_test_ride: this.randomTestRide(),
        can_compra: this.randomPurchaseChannel(),
        canales_info: this.randomInfoChannels(),
        
        // Marcas
        marca_top: this.randomTopBrand(),
        marca_alt: this.randomAltBrand(),
        presupuesto_max: this.randomMaxBudget(zone.socioeconomic),
        tiempo_decision: this.randomDecisionTime(),
        
        // Preguntas abiertas
        motivos_no_compra: this.randomNoReasons(),
        mejoras_esperadas: this.randomImprovements()
      };
      
      return survey;
    },

    
    // Funciones auxiliares de generación aleatoria
    randomDate() {
      const start = new Date(2024, 9, 1); // Oct 1, 2024
      const end = new Date(2024, 11, 31); // Dec 31, 2024
      return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime())).toISOString();
    },
    
    randomAge() {
      // Distribución realista: más concentración en 25-40
      const weights = [0.1, 0.3, 0.4, 0.2]; // 18-25, 26-35, 36-45, 46-50
      const ranges = [[18,25], [26,35], [36,45], [46,50]];
      const selectedRange = this.weightedChoice(ranges, weights);
      return Math.floor(Math.random() * (selectedRange[1] - selectedRange[0] + 1)) + selectedRange[0];
    },
    
    randomGender() {
      return Math.random() < 0.6 ? 'Masculino' : 'Femenino'; // 60% masculino (motocicletas)
    },
    
    randomOccupation(socioeconomic) {
      const occupations = {
        'bajo': ['Repartidor', 'Empleado', 'Otro', 'Independiente'],
        'medio-bajo': ['Empleado', 'Independiente', 'Repartidor', 'Otro'],
        'medio-alto': ['Empleado', 'Independiente', 'Estudiante', 'Otro']
      };
      return this.randomChoice(occupations[socioeconomic]);
    },
    
    randomUse() {
      const weights = [0.5, 0.3, 0.2]; // Personal, Trabajo, Reparto
      return this.weightedChoice(['Personal', 'Trabajo', 'Reparto'], weights);
    },
    
    randomMotorcycleUse() {
      return Math.random() < 0.65 ? 'Sí' : 'No'; // 65% ya usa moto
    },
    
    randomIntention(socioeconomic) {
      // Intención más alta en zonas de mayor poder adquisitivo
      const baseIntention = socioeconomic === 'medio-alto' ? 6 : socioeconomic === 'medio-bajo' ? 5 : 4;
      return Math.max(0, Math.min(10, Math.floor(Math.random() * 4) + baseIntention - 1));
    },
    
    randomBarriers() {
      const barriers = ['Precio', 'Autonomía', 'Carga/Infra', 'Rendimiento', 'Garantía/Servicio', 'Financiamiento'];
      const selected = [];
      const numBarriers = Math.floor(Math.random() * 3) + 1; // 1-3 barreras
      
      for (let i = 0; i < numBarriers; i++) {
        const barrier = this.randomChoice(barriers);
        if (!selected.includes(barrier)) {
          selected.push(barrier);
        }
      }
      
      return selected.join('|');
    },
    
    randomBrand() {
      const brands = ['Omomobility', 'Italika', 'NIU', 'SEV', ''];
      const weights = [0.14, 0.4, 0.2, 0.1, 0.16]; // 14% conoce Omomobility
      return this.weightedChoice(brands, weights);
    },
    
    randomPayment(socioeconomic) {
      const ranges = {
        'bajo': [15000, 25000],
        'medio-bajo': [20000, 35000],
        'medio-alto': [30000, 50000]
      };
      const range = ranges[socioeconomic];
      return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
    },
    
    randomIncome(socioeconomic) {
      const incomes = {
        'bajo': ['<$10k', '$10k–$20k'],
        'medio-bajo': ['$10k–$20k', '$20k–$35k'],
        'medio-alto': ['$20k–$35k', '$35k–$50k', '>$50k']
      };
      return this.randomChoice(incomes[socioeconomic]);
    },
    
    randomOmomobilityAwareness() {
      const awareness = ['No la conozco', 'Me suena', 'La conozco', 'La he visto/probado'];
      const weights = [0.86, 0.08, 0.05, 0.01]; // 14% total conocimiento
      return this.weightedChoice(awareness, weights);
    },

    randomSourceKnowledge(awareness_omo) {
      // Si no conoce la marca, retornar "No la he escuchado"
      if (awareness_omo === 'No la conozco') {
        return 'No la he escuchado';
      }
      
      // Si conoce la marca, generar 1-3 fuentes
      const sources = ['Redes sociales', 'Amigos/Familia', 'YouTube', 'Publicidad', 'Tienda física', 'Eventos/Prensa'];
      const selected = [];
      const numSources = Math.floor(Math.random() * 3) + 1; // 1-3 fuentes
      
      for (let i = 0; i < numSources; i++) {
        const source = this.randomChoice(sources);
        if (!selected.includes(source)) {
          selected.push(source);
        }
      }
      
      return selected.join('|');
    },
    
    // Funciones auxiliares
    randomChoice(array) {
      return array[Math.floor(Math.random() * array.length)];
    },
    
    weightedChoice(choices, weights) {
      const random = Math.random();
      let sum = 0;
      for (let i = 0; i < weights.length; i++) {
        sum += weights[i];
        if (random < sum) return choices[i];
      }
      return choices[choices.length - 1];
    },
    
    randomAttribute(mean) {
      // Generar valores 1-5 con tendencia hacia la media
      const value = Math.round(Math.random() * 2 + mean - 1);
      return Math.max(1, Math.min(5, value));
    },
    
    // ... más funciones auxiliares para otros campos
    randomHousehold() { return Math.floor(Math.random() * 4) + 2; },
    randomVehicles() { return Math.floor(Math.random() * 3); },
    randomSpontaneousBrand() { return Math.random() < 0.1 ? 'Italika, NIU' : ''; },
    randomAssistedBrand() { return 'Italika|NIU'; },
    randomFavorability() { return Math.floor(Math.random() * 6) + 3; },
    randomTimeframe() { return this.randomChoice(['3–6 meses', '6–12 meses', '>12 meses', 'Sin planes']); },
    randomFrequency() { return this.randomChoice(['Diario', 'Semanal', 'Ocasional']); },
    randomDailyKm() { return Math.floor(Math.random() * 30) + 10; },
    randomChargerAccess(socioeconomic) { 
      const prob = socioeconomic === 'medio-alto' ? 0.7 : socioeconomic === 'medio-bajo' ? 0.5 : 0.3;
      return Math.random() < prob ? 'Sí' : 'No'; 
    },
    randomFinancing() { return this.randomChoice(['Sí', 'No', 'Tal vez']); },
    randomMonthlyPayment(socioeconomic) {
      const ranges = { 'bajo': [800, 1500], 'medio-bajo': [1200, 2000], 'medio-alto': [1500, 3000] };
      const range = ranges[socioeconomic];
      return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
    },
    randomDownPayment(socioeconomic) {
      const ranges = { 'bajo': [3000, 8000], 'medio-bajo': [5000, 12000], 'medio-alto': [8000, 20000] };
      const range = ranges[socioeconomic];
      return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
    },
    randomTerm() { return this.randomChoice(['12 meses', '18 meses', '24 meses', '36 meses']); },
    randomTargetPrice(socioeconomic) {
      const ranges = { 'bajo': [18000, 28000], 'medio-bajo': [25000, 40000], 'medio-alto': [35000, 60000] };
      const range = ranges[socioeconomic];
      return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
    },
    randomExtendedBarriers() { return 'Costo inicial|Autonomía|Puntos de carga'; },
    randomEnvironmentalMotivation() { return this.randomChoice(['Sí', 'No', 'Algo']); },
    randomRangeAnxiety() { return Math.floor(Math.random() * 3) + 3; },
    randomNoiseValue() { return Math.floor(Math.random() * 2) + 4; },
    randomTestRide() { return Math.random() < 0.8 ? 'Sí' : 'No'; },
    randomPurchaseChannel() { return this.randomChoice(['Tienda física', 'En línea', 'Híbrido']); },
    randomInfoChannels() { return 'Redes sociales|Amigos/Familia'; },
    randomTopBrand() { return this.randomChoice(['Italika', 'NIU', 'Omomobility', 'SEV']); },
    randomAltBrand() { return this.randomChoice(['Italika', 'NIU', 'SEV', '']); },
    randomMaxBudget(socioeconomic) {
      const ranges = { 'bajo': [20000, 35000], 'medio-bajo': [30000, 50000], 'medio-alto': [45000, 80000] };
      const range = ranges[socioeconomic];
      return Math.floor(Math.random() * (range[1] - range[0] + 1)) + range[0];
    },
    randomDecisionTime() { return this.randomChoice(['1–3 meses', '3–6 meses', '>6 meses']); },
    randomNoReasons() { return Math.random() < 0.3 ? 'Precio muy alto, poca autonomía' : ''; },
    randomImprovements() { return Math.random() < 0.4 ? 'Mejor precio, más autonomía, más puntos de carga' : ''; }
  };