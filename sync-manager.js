// sync-manager.js - Gestor de sincronización Firebase-first
const SyncManager = {
    PENDING_KEY: 'encuestas_pending_sync',
    
    // Marcar encuesta como pendiente de sincronizar
    markPending(surveyData) {
      try {
        const pending = this.getPending();
        pending.push({
          ...surveyData,
          _syncPending: true,
          _syncAttempts: 0,
          _syncQueuedAt: new Date().toISOString()
        });
        localStorage.setItem(this.PENDING_KEY, JSON.stringify(pending));
        console.log('[SyncManager] Encuesta marcada como pendiente:', surveyData.ts);
      } catch (e) {
        console.error('[SyncManager] Error marcando pendiente:', e);
      }
    },
    
    // Obtener encuestas pendientes
    getPending() {
      try {
        return JSON.parse(localStorage.getItem(this.PENDING_KEY) || '[]');
      } catch {
        return [];
      }
    },
    
    // Sincronizar todas las pendientes
    async syncAll() {
      const pending = this.getPending();
      if (pending.length === 0) {
        console.log('[SyncManager] No hay encuestas pendientes');
        return { success: 0, failed: 0 };
      }
      
      console.log(`[SyncManager] Sincronizando ${pending.length} encuestas pendientes...`);
      
      let success = 0;
      let failed = 0;
      const stillPending = [];
      
      for (const survey of pending) {
        try {
          // Intentar guardar en Firestore
          if (window.db && window.fbAuth && window.fbAuth.currentUser) {
            const col = window.db.collection('surveys');
            const cleanSurvey = { ...survey };
            delete cleanSurvey._syncPending;
            delete cleanSurvey._syncAttempts;
            delete cleanSurvey._syncQueuedAt;
            
            await col.add(cleanSurvey);
            console.log('[SyncManager] ✓ Sincronizada:', survey.ts);
            success++;
          } else {
            throw new Error('Firebase no disponible');
          }
        } catch (e) {
          console.warn('[SyncManager] ✗ Falló sincronización:', survey.ts, e.message);
          survey._syncAttempts = (survey._syncAttempts || 0) + 1;
          
          // Si ha fallado menos de 5 veces, mantener en cola
          if (survey._syncAttempts < 5) {
            stillPending.push(survey);
          }
          failed++;
        }
      }
      
      // Actualizar cola de pendientes
      localStorage.setItem(this.PENDING_KEY, JSON.stringify(stillPending));
      
      console.log(`[SyncManager] Sincronización completada: ${success} exitosas, ${failed} fallidas`);
      return { success, failed, pending: stillPending.length };
    },
    
    // Verificar si hay conexión a Firebase
    isFirebaseAvailable() {
      return !!(window.db && window.fbAuth && window.fbAuth.currentUser);
    },
    
    // Iniciar sincronización automática
    startAutoSync(intervalMs = 30000) {
      console.log('[SyncManager] Iniciando sincronización automática cada', intervalMs / 1000, 'segundos');
      
      // Sincronizar inmediatamente
      this.syncAll();
      
      // Sincronizar periódicamente
      setInterval(() => {
        if (this.isFirebaseAvailable() && this.getPending().length > 0) {
          this.syncAll();
        }
      }, intervalMs);
      
      // Sincronizar cuando se recupera conexión
      window.addEventListener('online', () => {
        console.log('[SyncManager] Conexión recuperada, sincronizando...');
        setTimeout(() => this.syncAll(), 2000);
      });
    },
    
    // Obtener estado de sincronización
    getStatus() {
      const pending = this.getPending();
      return {
        pending: pending.length,
        isOnline: navigator.onLine,
        firebaseAvailable: this.isFirebaseAvailable(),
        oldestPending: pending.length > 0 ? pending[0]._syncQueuedAt : null
      };
    }
  };
  
  // Exportar al scope global
  window.SyncManager = SyncManager;