// Sistema de autenticación
const AuthSystem = {
    // Usuarios predefinidos (en producción usar base de datos)
    users: {
      'admin': {
        password: 'shopper01',
        role: 'admin',
        name: 'Administrador'
      },
      'encuestador': {
        password: 'enc123',
        role: 'encuestador',
        name: 'Encuestador'
      },
      'supervisor': {
        password: 'RolexMiami',
        role: 'supervisor',
        name: 'OswDom123'
      }
    },
  
    // Inicializar sistema
    init() {
      this.setupLoginForm();
      this.checkAuthOnProtectedPages();
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
    handleLogin() {
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      const messageDiv = document.getElementById('message');
  
      if (!username || !password) {
        this.showMessage('Por favor completa todos los campos', 'error');
        return;
      }
  
      if (this.authenticate(username, password)) {
        const user = this.users[username];
        this.createSession(username, user);
        this.showMessage('¡Login exitoso! Redirigiendo...', 'success');
        
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 1500);
      } else {
        this.showMessage('Usuario o contraseña incorrectos', 'error');
      }
    },
  
    // Autenticar usuario
    authenticate(username, password) {
      const user = this.users[username];
      return user && user.password === password;
    },
  
    // Crear sesión
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
    isAuthenticated() {
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
        const sessionData = localStorage.getItem('omomobility_session');
        return sessionData ? JSON.parse(sessionData) : null;
      } catch (e) {
        return null;
      }
    },
  
   // Verificar autenticación y autorización por página
checkAuthOnProtectedPages() {
    const currentPage = window.location.pathname.split('/').pop();
    // Páginas públicas
    const publicPages = ['login.html', ''];
  
    if (publicPages.includes(currentPage)) {
      return;
    }
  
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
  
    // Agregar información de usuario y botón logout
    addUserInfo() {
      const session = this.getSession();
      if (!session) return;
  
      const header = document.querySelector('.header');
      if (header) {
        const userInfo = document.createElement('div');
        userInfo.style.cssText = `
          position: absolute;
          top: 10px;
          right: 20px;
          background: rgba(255,255,255,0.9);
          padding: 8px 15px;
          border-radius: 20px;
          font-size: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        `;
        
        userInfo.innerHTML = `
          <span style="color: #666;">👤 ${session.name}</span>
          <button onclick="AuthSystem.logout()" style="
            margin-left: 10px;
            background: #dc3545;
            color: white;
            border: none;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
          ">Salir</button>
        `;
        
        header.style.position = 'relative';
        header.appendChild(userInfo);
      }
    },
  
    // Cerrar sesión
    logout() {
      localStorage.removeItem('omomobility_session');
      window.location.href = 'login.html';
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