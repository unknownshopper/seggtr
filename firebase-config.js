// Firebase config and initialization (compat)
// This file assumes you loaded:
//   - https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js
//   - https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js
//   - https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js

const firebaseConfig = {
  apiKey: "AIzaSyDqULwMCZyzaYM3EN59WiOo_qLluaQAhDM",
  authDomain: "omob-ddd69.firebaseapp.com",
  projectId: "omob-ddd69",
  storageBucket: "omob-ddd69.firebasestorage.app",
  messagingSenderId: "710103890319",
  appId: "1:710103890319:web:afa9f64b39f39b138f73fa"
};

// Initialize Firebase (compat)
firebase.initializeApp(firebaseConfig);

// Inicializar servicios
window.fbAuth = firebase.auth();
window.db = firebase.firestore();

// ===== CONFIGURACIÓN MEJORADA PARA REDUCIR ERRORES =====

// 1. Configurar ajustes de Firestore PRIMERO (antes de cualquier operación)
try {
  window.db.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
    ignoreUndefinedProperties: true
  });
  console.log('[Firebase] ⚙️ Settings configurados');
} catch (e) {
  console.warn('[Firebase] Settings ya configurados');
}

// 2. Habilitar persistencia offline DESPUÉS de settings
try {
  window.db.enablePersistence({ synchronizeTabs: true })
    .then(() => {
      console.log('[Firebase] ✅ Persistencia offline habilitada');
    })
    .catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('[Firebase] ⚠️ Persistencia no disponible (múltiples tabs)');
      } else if (err.code === 'unimplemented') {
        console.warn('[Firebase] ⚠️ Persistencia no soportada en este navegador');
      }
    });
} catch (e) {
  console.warn('[Firebase] Persistencia ya habilitada o no disponible');
}

// 3. Estado de conexión global
window.firebaseReady = false;
window.firebaseConnectionState = 'connecting';

// 4. Monitorear estado de autenticación
window.fbAuth.onAuthStateChanged((user) => {
  window.firebaseReady = true;
  window.firebaseConnectionState = user ? 'connected' : 'disconnected';
  
  if (user) {
    console.log('[Firebase] ✅ Usuario autenticado:', user.email);
  } else {
    console.log('[Firebase] ⚠️ Sin usuario autenticado');
  }
  
  // Disparar evento personalizado para que otros scripts sepan que Firebase está listo
  window.dispatchEvent(new CustomEvent('firebaseReady', { 
    detail: { user, ready: true } 
  }));
});

// 5. Suprimir logs verbosos de Firestore en producción
if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
  firebase.firestore.setLogLevel('error');
} else {
  firebase.firestore.setLogLevel('silent'); // Silenciar warnings en desarrollo
}

console.log('[Firebase] Configuración cargada y optimizada');