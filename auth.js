// Sistema de autenticación
const AuthSystem = {
  // Usuarios predefinidos (fallback local si no hay Firebase Auth)
  users: {
    admin: { password: 'shopper01', role: 'admin', name: 'Administrador' },
    encuestador: { password: 'enc123', role: 'encuestador', name: 'Encuestador' },
    supervisor: { password: 'RolexMiami', role: 'supervisor', name: 'OswDom123' }
  },

// Inicializar sistema
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
 // Reemplaza tu handleLogin completo por esta versión async
async handleLogin() {
  const emailOrUser = document.getElementById('username')?.value?.trim();
  const password = document.getElementById('password')?.value;

  if (!emailOrUser || !password) {
    this.showMessage('Por favor completa todos los campos', 'error');
    return;
  }

  if (window.fbAuth) {
    try {
      const cred = await window.fbAuth.signInWithEmailAndPassword(emailOrUser, password);
      const user = cred.user;

      // 1) Traer rol desde Firestore
      let role = 'encuestador';
      if (window.db) {
        const snap = await window.db.collection('users').doc(user.uid).get();
        if (snap.exists && snap.data()?.role) role = snap.data().role;
      }

      // 2) Construir sesión con rol real
      const session = {
        username: user.email || user.uid,
        role,
        name: user.displayName || (user.email ? user.email.split('@')[0] : 'Usuario'),
        loginTime: new Date().toISOString(),
        expires: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
      };
      localStorage.setItem('omomobility_session', JSON.stringify(session));

      this.showMessage('¡Login exitoso! Redirigiendo...', 'success');
      setTimeout(() => { window.location.href = 'index.html'; }, 800);
    } catch (err) {
      const msg = err?.code ? err.code.replace('auth/', '').replace(/-/g, ' ') : 'Error de autenticación';
      this.showMessage(msg, 'error');
    }
    return;
  }

  // Fallback local si no hay Firebase
  if (this.authenticate(emailOrUser, password)) {
    const user = this.users[emailOrUser];
    this.createSession(emailOrUser, user);
    this.showMessage('¡Login exitoso! Redirigiendo...', 'success');
    setTimeout(() => { window.location.href = 'index.html'; }, 1000);
  } else {
    this.showMessage('Usuario o contraseña incorrectos', 'error');
  }
},

  // Autenticar usuario (fallback local)
  authenticate(username, password) {
    const user = this.users[username];
    return user && user.password === password;
  },

  // Crear sesión (fallback local)
  createSession(username, user) {
    const session = {
      username: username,
      role: user.role,
      name: user.name,
      loginTime: new Date().toISOString(),
      expires: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString() // 8 horas
    };
    localStorage.setItem('omomobility_session', JSON.stringify(session));
  },

  // Verificar si está autenticado
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
      // Si hay usuario Firebase, combinar con datos locales (temporal para rol)
      const u = (window.fbAuth && window.fbAuth.currentUser) ? window.fbAuth.currentUser : null;
      if (u) {
        const fallback = JSON.parse(localStorage.getItem('omomobility_session') || '{}');
        return {
          username: u.email || u.uid,
          role: fallback.role || 'encuestador',
          name: u.displayName || fallback.name || (u.email ? u.email.split('@')[0] : 'Usuario'),
          loginTime: fallback.loginTime || new Date().toISOString(),
          expires: fallback.expires || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
        };
      }
      // Fallback local puro
      const sessionData = localStorage.getItem('omomobility_session');
      return sessionData ? JSON.parse(sessionData) : null;
    } catch {
      return null;
    }
  },

  // Verificar autenticación y autorización por página
  checkAuthOnProtectedPages() {
    const currentPage = window.location.pathname.split('/').pop();
    // Páginas públicas
    const publicPages = ['login.html', ''];

    if (publicPages.includes(currentPage)) return;

    if (!this.isAuthenticated()) {
      window.location.href = 'login.html';
      return;
    }

    const session = this.getSession();
    if (!this.canAccess(currentPage, session.role)) {
      // Si no tiene permiso, encuestador va a encuesta; otros a index
      if (session.role === 'encuestador') {
        window.location.href = 'encuesta.html';
      } else {
        window.location.href = 'index.html';
      }
      return;
    }

    // Agregar info de usuario y logout
    this.addUserInfo();

    // Aplicar restricciones visuales en index para roles con acceso limitado
    if (currentPage === 'index.html') {
      this.restrictLinksOnIndex(session.role);
    }
  },

  // Regla de autorización por página y rol
  canAccess(page, role) {
    const p = (page || '').toLowerCase();

    // Admin: acceso total
    if (role === 'admin') return true;

    // Encuestador: SOLO encuesta.html
    if (role === 'encuestador') {
      return p === 'encuesta.html';
    }

    // Supervisor: index + páginas informativas + encuesta
    if (role === 'supervisor') {
      const allowed = [
        'index.html',
        'encuesta.html',
        'carta_propuesta_omomobility.html',
        'presentacion.html',
        'resultados.html'
      ];
      return allowed.includes(p);
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