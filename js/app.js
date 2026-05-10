// ============================================================
// APP.JS - Utilitas inti: Toast, Cart, Modal
// ============================================================

// ============================================================
// TOAST NOTIFICATION
// ============================================================
const Toast = {
  show(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container') || this.createContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
      success: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`,
      error: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
      warning: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
      info: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
    };

    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-msg">${message}</span>
      <button class="toast-close" onclick="this.parentElement.remove()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  createContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
    return container;
  }
};

// ============================================================
// CART (Keranjang Belanja)
// ============================================================
const Cart = {
  items: [],

  init() {
    const saved = sessionStorage.getItem('minisayur_cart');
    this.items = saved ? JSON.parse(saved) : [];
    this.updateBadge();
  },

  save() {
    sessionStorage.setItem('minisayur_cart', JSON.stringify(this.items));
    this.updateBadge();
  },

  add(product, qty = 1) {
    const existing = this.items.find(i => i.id === product.id);
    if (existing) {
      const newQty = existing.qty + qty;
      if (newQty > product.stok) {
        Toast.show('Jumlah melebihi stok yang tersedia', 'warning');
        return false;
      }
      existing.qty = newQty;
    } else {
      if (qty > product.stok) {
        Toast.show('Stok tidak mencukupi', 'warning');
        return false;
      }
      this.items.push({
        id: product.id,
        nama: product.nama,
        harga: product.harga,
        stok: product.stok,
        image_url: product.image_url,
        qty: qty
      });
    }
    this.save();
    Toast.show(`${product.nama} ditambahkan ke keranjang`, 'success');
    return true;
  },

  remove(productId) {
    this.items = this.items.filter(i => i.id !== productId);
    this.save();
  },

  updateQty(productId, qty) {
    const item = this.items.find(i => i.id === productId);
    if (item) {
      if (qty <= 0) {
        this.remove(productId);
      } else if (qty > item.stok) {
        Toast.show('Melebihi stok tersedia', 'warning');
        return false;
      } else {
        item.qty = qty;
        this.save();
      }
    }
    return true;
  },

  getTotal() {
    return this.items.reduce((sum, i) => sum + (i.harga * i.qty), 0);
  },

  getCount() {
    return this.items.reduce((sum, i) => sum + i.qty, 0);
  },

  clear() {
    this.items = [];
    this.save();
  },

  updateBadge() {
    const badges = document.querySelectorAll('.cart-badge');
    const count = this.getCount();
    badges.forEach(b => {
      b.textContent = count;
      b.style.display = count > 0 ? 'flex' : 'none';
    });
  }
};

// ============================================================
// MODAL
// ============================================================
const Modal = {
  showLogin() {
    const modal = document.getElementById('modal-login');
    if (modal) {
      modal.classList.add('active');
    } else {
      this.createLoginModal();
    }
  },

  createLoginModal() {
    const overlay = document.createElement('div');
    overlay.id = 'modal-login';
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-header">
          <h3>Masuk Terlebih Dahulu</h3>
          <button class="modal-close" onclick="Modal.close('modal-login')">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="modal-body">
          <div class="modal-icon">
            <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </div>
          <p>Anda perlu masuk dengan Google untuk melanjutkan pembelian.</p>
          <button class="btn-google-login" onclick="Auth.loginWithGoogle()">
            <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Masuk dengan Google
          </button>
        </div>
      </div>
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close('modal-login');
    });
    document.body.appendChild(overlay);
  },

  close(id) {
    const modal = document.getElementById(id);
    if (modal) {
      modal.classList.remove('active');
      setTimeout(() => {
        modal.remove();
        // Clean up callback registry
        if (Modal._callbacks) delete Modal._callbacks[id];
      }, 300);
    }
  },

  confirm(title, message, onConfirm) {
    const id = 'modal-confirm-' + Date.now();
    // Store callback in registry to preserve closure & async
    Modal._callbacks = Modal._callbacks || {};
    Modal._callbacks[id] = async () => {
      await onConfirm();
      Modal.close(id);
    };

    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.className = 'modal-overlay active';
    overlay.innerHTML = `
      <div class="modal-box modal-sm">
        <div class="modal-header">
          <h3>${title}</h3>
        </div>
        <div class="modal-body">
          <p>${message}</p>
          <div class="modal-actions">
            <button class="btn-outline" onclick="Modal.close('${id}')">Batal</button>
            <button class="btn-danger" id="confirm-btn-${id}">Konfirmasi</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    // Attach listener directly (no inline string eval)
    document.getElementById(`confirm-btn-${id}`)
      .addEventListener('click', Modal._callbacks[id]);
  }
};

// ============================================================
// FORMAT UTILITIES
// ============================================================
const Fmt = {
  currency(num) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(num);
  },

  date(dateStr) {
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr));
  },

  statusLabel(status) {
    const labels = {
      menunggu_konfirmasi: 'Menunggu Konfirmasi',
      menunggu:   'Menunggu',
      diproses:   'Diproses',
      dikirim:    'Dikirim',
      selesai:    'Selesai',
      dibatalkan: 'Dibatalkan',
    };
    return labels[status] || status;
  },

  statusClass(status) {
    const classes = {
      menunggu_konfirmasi: 'status-konfirmasi',
      menunggu:   'status-waiting',
      diproses:   'status-process',
      dikirim:    'status-ship',
      selesai:    'status-done',
      dibatalkan: 'status-cancel',
    };
    return classes[status] || '';
  }
};

// ============================================================
// SKELETON LOADING
// ============================================================
function createSkeleton(count = 4, type = 'product') {
  return Array(count).fill(0).map(() => `
    <div class="skeleton-card">
      <div class="skeleton skeleton-img"></div>
      <div class="skeleton-body">
        <div class="skeleton skeleton-line"></div>
        <div class="skeleton skeleton-line short"></div>
        <div class="skeleton skeleton-price"></div>
        <div class="skeleton skeleton-btn"></div>
      </div>
    </div>
  `).join('');
}

// ============================================================
// DARK MODE
// ============================================================
const DarkMode = {
  init() {
    const saved = localStorage.getItem('darkMode');
    if (saved === 'true') document.body.classList.add('dark');
    this.updateToggle();
  },
  toggle() {
    document.body.classList.toggle('dark');
    localStorage.setItem('darkMode', document.body.classList.contains('dark'));
    this.updateToggle();
  },
  updateToggle() {
    const btn = document.getElementById('dark-toggle');
    if (!btn) return;
    const isDark = document.body.classList.contains('dark');
    btn.innerHTML = isDark
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>`;
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  Cart.init();
  DarkMode.init();
  Auth.init();
});

window.Toast = Toast;
window.Cart = Cart;
window.Modal = Modal;
window.Fmt = Fmt;
window.DarkMode = DarkMode;
window.createSkeleton = createSkeleton;
