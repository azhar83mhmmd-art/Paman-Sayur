// ============================================================
// AUTH.JS - Sistem autentikasi Google OAuth
// ============================================================

const Auth = {
  currentUser: null,
  currentProfile: null,

  async init() {
    // Tunggu session — bisa dari getSession atau dari OAuth callback
    let session = null;

    const { data: s1 } = await db.auth.getSession();
    if (s1?.session) {
      session = s1.session;
    } else {
      // Tunggu event SIGNED_IN dari OAuth redirect (max 3 detik)
      session = await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(null), 3000);
        const { data: { subscription } } = db.auth.onAuthStateChange((event, s) => {
          if (event === 'SIGNED_IN' && s) {
            clearTimeout(timer);
            subscription.unsubscribe();
            resolve(s);
          }
        });
      });
    }

    if (session) {
      this.currentUser = session.user;
      await this.ensureProfile();
    }

    this.setupAuthListener();
    this.updateUI();
    return session;
  },

  // Pastikan profile ada di DB, buat jika belum ada
  async ensureProfile() {
    if (!this.currentUser) return null;

    const isAdminEmail = this.currentUser.email === ADMIN_EMAIL;

    // Upsert: buat kalau belum ada, update kalau sudah ada
    const { data, error } = await db.from('profiles').upsert({
      id: this.currentUser.id,
      email: this.currentUser.email,
      full_name: this.currentUser.user_metadata?.full_name || null,
      avatar_url: this.currentUser.user_metadata?.avatar_url || null,
      is_admin: isAdminEmail,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' }).select().single();

    if (!error && data) {
      this.currentProfile = data;
    } else {
      // Fallback: coba baca saja
      const { data: p } = await db.from('profiles').select('*').eq('id', this.currentUser.id).single();
      this.currentProfile = p;
    }

    return this.currentProfile;
  },

  setupAuthListener() {
    db.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        this.currentUser = session.user;
        await this.ensureProfile();
        this.updateUI();
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
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) Toast.show('Gagal login: ' + error.message, 'error');
  },

  async logout() {
    await db.auth.signOut();
    Cart.clear();
    window.location.href = 'index.html';
  },

  isLoggedIn() {
    return !!this.currentUser;
  },

  // Cek admin: prioritas email match (tidak perlu DB query)
  isAdmin() {
    return !!(this.currentUser && this.currentUser.email === ADMIN_EMAIL);
  },

  requireLogin(callback) {
    if (!this.isLoggedIn()) { Modal.showLogin(); return false; }
    if (callback) callback();
    return true;
  },

  updateUI() {
    const userSection = document.getElementById('user-section');
    if (!userSection) return;

    if (this.currentUser) {
      const name = this.currentProfile?.full_name || this.currentUser.user_metadata?.full_name || this.currentUser.email.split('@')[0];
      const avatar = this.currentProfile?.avatar_url || this.currentUser.user_metadata?.avatar_url || '';
      const adminMenu = this.isAdmin() ? `
        <a href="admin.html" class="dropdown-item admin-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
          Panel Admin
        </a>` : '';

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
            ${adminMenu}
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

document.addEventListener('click', (e) => {
  if (!e.target.closest('.user-dropdown')) {
    const menu = document.getElementById('user-menu');
    if (menu) menu.classList.remove('active');
  }
});

window.Auth = Auth;
