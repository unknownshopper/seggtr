// Sistema de autenticación
const AuthSystem = {
  // Usuarios predefinidos (fallback local si no hay Firebase Auth)
  // users: {
  //   admin: { password: 'shopper01', role: 'admin', name: 'Administrador' },
  //   encuestador: { password: 'enc123', role: 'encuestador', name: 'Encuestador' },
  //   encuestador2: { password: 'enc123', role: 'encuestador', name: 'Encuestador2' },
  //   encuestador3: { password: 'enc123', role: 'encuestador', name: 'Encuestador3' },
  //   supervisor: { password: 'RolexMiami', role: 'supervisor', name: 'OswDom123' }
  // },

  // Inicializar sistema  ← ✅ Con indentación
  init() {
  this.setupLoginForm();

  if (window.fbAuth) {
    window.fbAuth.onAuthStateChanged(async (u) => {
      // Si hay usuario y no hay rol cacheado, cárgalo 1 vez desde Firestore
      if (u && window.db) {
        const local = JSON.parse(localStorage.getItem('omomobility_session') || '{}');
        if (!local.role) {
          try {
            const snap = await window.db.collection('users').doc(u.uid).get();
            if (snap.exists && snap.data()?.role) {
              localStorage.setItem('omomobility_session', JSON.stringify({
                username: u.email || u.uid,
                role: snap.data().role,
                name: u.displayName || (u.email ? u.email.split('@')[0] : 'Usuario'),
                loginTime: local.loginTime || new Date().toISOString(),
                expires: local.expires || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
              }));
            }
          } catch (e) {
            // opcional: logging silencioso
          }
        }
      }
      // Un único punto central que reevalúa guardas
      this.checkAuthOnProtectedPages();
    });
  } else {
    this.checkAuthOnProtectedPages();
  }
},

  // Configurar formulario de login
  setupLoginForm() {
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLogin();
      });
    }
  },

  // Manejar login
  async handleLogin() {
    const emailOrUser = document.getElementById('username')?.value?.trim();
    const password = document.getElementById('password')?.value;

    if (!emailOrUser || !password) {
      this.showMessage('Por favor completa todos los campos', 'error');
      return;
    }

    // Intento con Firebase (si está disponible)
    if (window.fbAuth) {
      try {
        const cred = await window.fbAuth.signInWithEmailAndPassword(emailOrUser, password);
        const user = cred.user;

        // 1) Traer rol desde Firestore (si existe)
        let role = 'encuestador';
        if (window.db) {
          const snap = await window.db.collection('users').doc(user.uid).get();
          if (snap.exists && snap.data()?.role) role = snap.data().role;
        }
        // Normalizar role
        role = (role || '').toString().trim().toLowerCase();
        if (!['admin','supervisor','encuestador'].includes(role)) {
          role = 'encuestador';
        }

        // 2) Guardar sesión local
        const session = {
          username: user.email || user.uid,
          role,
          name: user.displayName || (user.email ? user.email.split('@')[0] : 'Usuario'),
          loginTime: new Date().toISOString(),
          expires: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
        };
        localStorage.setItem('omomobility_session', JSON.stringify(session));

        // 3) Redirigir por rol
        this.showMessage('¡Login exitoso! Redirigiendo...', 'success');
        setTimeout(() => {
          const target = role === 'encuestador' ? 'encuesta.html' : 'index.html';
          const current = window.location.pathname.split('/').pop();
          if (current !== target) {
            window.location.href = target;
          }
        }, 800);
        return; // Éxito con Firebase → salir
      } catch (err) {
        // Falló Firebase → intentar fallback local sin bloquear
        const msg = err?.code ? err.code.replace('auth/', '').replace(/-/g, ' ') : 'Error de autenticación';
        this.showMessage(`Firebase: ${msg}. Probando login local...`, 'error');
        // Importante: no hacemos return aquí para permitir el fallback local
      }
    }

    // Sin fallback local - solo Firebase
    this.showMessage('Usuario o contraseña incorrectos.', 'error');
  },

  // Verificar si está autenticado
  isAuthenticated() {
    // Fuente de la verdad: Firebase Auth
    if (window.fbAuth && window.fbAuth.currentUser) return true;

    // Fallback local
    const session = this.getSession();
    if (!session) return false;

    const now = new Date();
    const expires = new Date(session.expires);
    if (now > expires) {
      this.logout();
      return false;
    }
    return true;
  },

  // Obtener sesión actual
  getSession() {
    try {
      // 1) Leer sesión local primero
      const localRaw = localStorage.getItem('omomobility_session');
      const localSess = localRaw ? JSON.parse(localRaw) : null;
      if (localSess) {
        // Normalizar: si username es 'admin', forzar rol admin
        if ((localSess.username || '').toLowerCase() === 'admin') {
          localSess.role = 'admin';
        }
        // Si no hay rol en local, por defecto encuestador (evita rebotes)
        if (!localSess.role) {
          localSess.role = 'encuestador';
        }
        // Dentro de getSession(), tras setear localSess.role:
        localSess.role = (localSess.role || '').toString().trim().toLowerCase();
        if ((localSess.username || '').toLowerCase() === 'admin') {
          localSess.role = 'admin';
        }
        if (!['admin','supervisor','encuestador'].includes(localSess.role)) {
          localSess.role = 'encuestador';
        }
      }
      

      // 2) Si hay usuario Firebase, combinar datos, pero mantener rol local si existe
      const u = (window.fbAuth && window.fbAuth.currentUser) ? window.fbAuth.currentUser : null;
      if (u) {
        const combined = {
          username: u.email || u.uid,
          role: (localSess && localSess.role) ? localSess.role : 'encuestador',
          name: u.displayName || (localSess?.name) || (u.email ? u.email.split('@')[0] : 'Usuario'),
          loginTime: (localSess?.loginTime) || new Date().toISOString(),
          expires: (localSess?.expires) || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
        };
        // Normalizar admin por username
        if ((combined.username || '').toLowerCase() === 'admin') {
          combined.role = 'admin';
        }
        combined.role = (combined.role || '').toString().trim().toLowerCase();
        if ((combined.username || '').toLowerCase() === 'admin') {
          combined.role = 'admin';
        }
        if (!['admin','supervisor','encuestador'].includes(combined.role)) {
          combined.role = 'encuestador';
        }
        return combined;
      }

      // 3) Sin Firebase: devolver local (ya normalizado con rol)
      if (localSess) {
        return localSess;
      }

      return null;
    } catch (error) {
      console.error('[AuthSystem] Error en getSession:', error);
      return null;
    }
  },

  // Verificar autenticación y autorización por página
  checkAuthOnProtectedPages() {
    const currentPage = window.location.pathname.split('/').pop();
    // Páginas públicas
    const publicPages = ['login.html', ''];
    if (publicPages.includes(currentPage)) return;

    // No autenticado → login (con anti-bucle)
    if (!this.isAuthenticated()) {
      const target = 'login.html';
      try {
        const last = JSON.parse(sessionStorage.getItem('lastRedirect') || 'null');
        const now = Date.now();
        if (last && last.target === target && (now - last.time) < 800) return;
        sessionStorage.setItem('lastRedirect', JSON.stringify({ target, time: now }));
      } catch {}
      if (currentPage !== target) window.location.href = target;
      return;
    }

    // Autenticado: verificar acceso por rol
    const session = this.getSession();
    if (!this.canAccess(currentPage, session.role)) {
      const target = (session.role === 'encuestador') ? 'encuesta.html' : 'index.html';
      try {
        const last = JSON.parse(sessionStorage.getItem('lastRedirect') || 'null');
        const now = Date.now();
        if (!(last && last.target === target && (now - last.time) < 800)) {
          sessionStorage.setItem('lastRedirect', JSON.stringify({ target, time: now }));
          if (currentPage !== target) window.location.href = target;
        }
      } catch {
        if (currentPage !== target) window.location.href = target;
      }
      return;
    }

    // UI de usuario y restricciones de links
    this.addUserInfo();
    if (currentPage === 'index.html') {
      this.restrictLinksOnIndex(session.role);
    }
    try { sessionStorage.removeItem('lastRedirect'); } catch {}
  },


  // Regla de autorización por página y rol
  // Regla de autorización por página y rol
  canAccess(page, role) {
    // Normalizar entradas
    const p = (page || '').toString().trim().toLowerCase();
    const r = (role || '').toString().trim().toLowerCase();

    // Admin: acceso total
    if (r === 'admin') return true;

    // Páginas permitidas por rol
    const encuestadorAllowed = new Set([
      'encuesta.html',
      'listadeencuestas.html',
      'encuestadores.html'
    ]);

        const supervisorAllowed = new Set([
      'index.html',
      'encuesta.html',
      'carta_propuesta_omomobility.html',
      'presentacion.html',
      'resultados.html',
      'listadeencuestas.html',
      'tco.html',
      'encuesta_metodologia.html',
      'competencia.html',
      'encuestadores.html'
    ]);

    if (r === 'encuestador') {
      return encuestadorAllowed.has(p);
    }

    if (r === 'supervisor') {
      return supervisorAllowed.has(p);
    }

    // Rol desconocido: negar
    return false;
  },

    // Restringir enlaces en index para roles sin permiso
    restrictLinksOnIndex(role) {
      if (role === 'admin') return; // sin restricciones
      const links = document.querySelectorAll('a.cardlink');
      links.forEach(a => {
        const href = (a.getAttribute('href') || '').toLowerCase();
        if (!this.canAccess(href, role)) {
          a.addEventListener('click', (e) => {
            e.preventDefault();
            alert('No tienes permisos para acceder a este módulo.');
          });
          a.style.pointerEvents = 'auto'; // permitir el click para mostrar alerta
          a.style.opacity = '0.6';
          a.style.filter = 'grayscale(0.2)';
          a.title = 'Acceso restringido por rol';
        }
      });
    },

    // Agregar información de usuario y botón logout (solo admin/supervisor)
    addUserInfo() {
      const session = this.getSession();
      if (!session) return;

      const header = document.querySelector('.header');
      if (!header) return;

      // Evitar duplicados si ya se añadió
      const existing = document.getElementById('auth-user-info');
      if (existing) existing.remove();

      const canLogout =
        session.role === 'admin' ||
        session.role === 'supervisor' ||
        window.location.pathname.split('/').pop() === 'encuesta.html';

      const userInfo = document.createElement('div');
      userInfo.id = 'auth-user-info';
      userInfo.style.cssText = `
        position: absolute;
        top: 10px;
        right: 20px;
        background: rgba(255,255,255,0.95);
        padding: 8px 12px;
        border-radius: 20px;
        font-size: 12px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.08);
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 9999;
      `;

      // Etiqueta de rol con color según rol
      const roleColor = session.role === 'admin' ? '#dc3545'
                      : session.role === 'supervisor' ? '#0d6efd'
                      : '#6c757d';

      userInfo.innerHTML = `
        <span style="color: #444;">👤 ${session.name}</span>
        <span style="
          background: ${roleColor}1a;
          color: ${roleColor};
          padding: 2px 8px;
          border-radius: 999px;
          font-weight: 600;
          text-transform: capitalize;
        ">${session.role}</span>
        ${canLogout ? `
          <button onclick="AuthSystem.logout()" style="
            background: #dc3545;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
          ">Salir</button>` : ''}
      `;

      const headerEl = document.querySelector('.header') || document.querySelector('.hero') || document.body;
      headerEl.style.position = 'relative';
      headerEl.appendChild(userInfo);
    },

    // Cerrar sesión
    logout() {
      localStorage.removeItem('omomobility_session');
      if (window.fbAuth) {
        window.fbAuth.signOut()
          .finally(() => { window.location.href = 'login.html'; })
          .catch(() => { window.location.href = 'login.html'; });
      } else {
        window.location.href = 'login.html';
      }
    },

    // Mostrar mensaje
    showMessage(text, type) {
      const messageDiv = document.getElementById('message');
      if (messageDiv) {
        messageDiv.textContent = text;
        messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
      }
    }
  };

// Inicializar cuando cargue la página
document.addEventListener('DOMContentLoaded', () => {
  AuthSystem.init();
});