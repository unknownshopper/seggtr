// Sistema de actualización en tiempo real para listadeencuestas.html
// Usa Firestore onSnapshot para detectar nuevas encuestas automáticamente

(function setupRealtimeUpdates() {
    let unsubscribe = null;
    let lastCount = 0;
    let isFirstLoad = true;
  
    // Función para mostrar notificación toast
    function showToast(message) {
      // Remover toast anterior si existe
      const existing = document.getElementById('realtime-toast');
      if (existing) existing.remove();
  
      // Crear nuevo toast
      const toast = document.createElement('div');
      toast.id = 'realtime-toast';
      toast.className = 'realtime-toast';
      toast.innerHTML = `
        <span style="font-size: 20px;">🔔</span>
        <span>${message}</span>
        <span style="font-size: 18px; margin-left: 8px;">✨</span>
      `;
      
      document.body.appendChild(toast);
  
      // Click para cerrar
      toast.addEventListener('click', () => {
        toast.classList.add('hiding');
        setTimeout(() => toast.remove(), 300);
      });
  
      // Auto-cerrar después de 5 segundos
      setTimeout(() => {
        if (toast && toast.parentNode) {
          toast.classList.add('hiding');
          setTimeout(() => toast.remove(), 300);
        }
      }, 5000);
    }
  
    // Configurar listener en tiempo real
    function setupRealtimeListener() {
      if (!window.db) {
        console.warn('[Realtime] Firebase no disponible');
        return;
      }
  
      // Cancelar listener anterior si existe
      if (unsubscribe) {
        unsubscribe();
      }
  
      console.log('[Realtime] Configurando listener en tiempo real...');
  
      const colRef = window.db.collection('surveys');
      
      unsubscribe = colRef.limit(250).onSnapshot((snapshot) => {
        const currentCount = snapshot.size;
        
        console.log(`[Realtime] Snapshot recibido: ${currentCount} documentos`);
  
        // En la primera carga, solo guardar el conteo
        if (isFirstLoad) {
          lastCount = currentCount;
          isFirstLoad = false;
          console.log('[Realtime] Primera carga, conteo inicial:', lastCount);
          return;
        }
  
        // Detectar nuevas encuestas
        if (currentCount > lastCount) {
          const newSurveys = currentCount - lastCount;
          console.log(`[Realtime] 🎉 ${newSurveys} nueva(s) encuesta(s) detectada(s)!`);
          
          showToast(`¡Nueva encuesta recibida! Total: ${currentCount}`);
          
          // Recargar datos sin recargar la página completa
          if (window.ListaEncuestas && typeof window.ListaEncuestas.loadData === 'function') {
            setTimeout(() => {
              window.ListaEncuestas.loadData();
            }, 1000);
          } else {
            // Fallback: recargar página completa
            setTimeout(() => {
              window.location.reload();
            }, 1000);
          }
        }
  
        lastCount = currentCount;
      }, (error) => {
        console.error('[Realtime] Error en listener:', error);
      });
  
      console.log('[Realtime] Listener configurado exitosamente');
    }
  
  // Iniciar cuando Firebase esté listo
function init() {
  if (window.firebaseReady && window.db && window.fbAuth && window.fbAuth.currentUser) {
    setupRealtimeListener();
  } else {
    // Esperar evento de Firebase
    window.addEventListener('firebaseReady', () => {
      if (window.fbAuth && window.fbAuth.currentUser) {
        console.log('[Realtime] Firebase listo, configurando listener...');
        setupRealtimeListener();
      }
    }, { once: true });
  }
}

// Inicializar
init();

})(); // Cierre del IIFE setupRealtimeUpdates