// ============================================================
// AUTH.JS - Sistem autentikasi Google OAuth
// ============================================================

const Auth = {
  currentUser: null,
  currentProfile: null,

  async init() {
    const { data: { session } } = await db.auth.getSession();
    if (session) {
      this.currentUser = session.user;
      await this.loadProfile();
    }
    this.setupAuthListener();
    this.updateUI();
    return session;
  },

  async loadProfile() {
    if (!this.currentUser) return null;
    const { data } = await db
      .from('profiles')
      .select('*')
      .eq('id', this.currentUser.id)
      .single();
    this.currentProfile = data;
    return data;
  },

  setupAuthListener() {
    db.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        this.currentUser = session.user;
        await this.loadProfile();
        this.updateUI();
        // Redirect jika di halaman login
        if (window.location.pathname.includes('login.html')) {
          window.location.href = 'index.html';
        }
      } else if (event === 'SIGNED_OUT') {
        this.currentUser = null;
        this.currentProfile = null;
        this.updateUI();
      }
    });
  },

  async loginWithGoogle() {
    const { error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + '/index.html',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) {
      Toast.show('Gagal login dengan Google: ' + error.message, 'error');
    }
  },

  async logout() {
    const { error } = await db.auth.signOut();
    if (!error) {
      Cart.clear();
      window.location.href = 'index.html';
    }
  },

  isLoggedIn() {
    return !!this.currentUser;
  },

  isAdmin() {
    return this.currentUser?.email === ADMIN_EMAIL;
  },

  requireLogin(callback) {
    if (!this.isLoggedIn()) {
      Modal.showLogin();
      return false;
    }
    if (callback) callback();
    return true;
  },

  updateUI() {
    const userSection = document.getElementById('user-section');
    const adminBtn = document.getElementById('admin-btn');
    const loginBtn = document.getElementById('login-btn');

    if (!userSection) return;

    if (this.currentUser) {
      const name = this.currentProfile?.full_name || this.currentUser.email.split('@')[0];
      const avatar = this.currentProfile?.avatar_url || '';

      userSection.innerHTML = `
        <div class="user-dropdown">
          <button class="user-avatar-btn" onclick="toggleUserMenu()">
            ${avatar ? `<img src="${avatar}" alt="${name}" class="user-avatar">` : `<div class="user-avatar-placeholder">${name[0].toUpperCase()}</div>`}
            <span class="user-name-nav">${name.split(' ')[0]}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
          <div class="user-dropdown-menu" id="user-menu">
            <a href="pesanan.html" class="dropdown-item">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
              Pesanan Saya
            </a>
            ${this.isAdmin() ? `<a href="admin.html" class="dropdown-item admin-link">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
              Panel Admin
            </a>` : ''}
            <button class="dropdown-item logout-item" onclick="Auth.logout()">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
              Keluar
            </button>
          </div>
        </div>
      `;
    } else {
      userSection.innerHTML = `
        <button class="btn-login-nav" onclick="Auth.loginWithGoogle()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Masuk
        </button>
      `;
    }
  }
};

function toggleUserMenu() {
  const menu = document.getElementById('user-menu');
  if (menu) menu.classList.toggle('active');
}

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.user-dropdown')) {
    const menu = document.getElementById('user-menu');
    if (menu) menu.classList.remove('active');
  }
});

window.Auth = Auth;
