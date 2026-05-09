// ============================================================
// PRODUK.JS - Listing produk, pencarian, filter
// ============================================================

const Produk = {
  all: [],
  filtered: [],
  activeKategori: 'semua',
  searchQuery: '',
  wishlist: new Set(),

  async init() {
    await this.loadWishlist();
    await this.load();
    this.setupSearch();
    this.setupKategori();
  },

  async load() {
    const container = document.getElementById('produk-grid');
    if (!container) return;

    container.innerHTML = createSkeleton(8);

    try {
      const { data, error } = await db
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.all = data || [];
      this.filtered = [...this.all];
      this.render();
      this.buildKategori();
    } catch (err) {
      container.innerHTML = `
        <div class="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          <h3>Gagal memuat produk</h3>
          <p>${err.message}</p>
          <button class="btn-primary" onclick="Produk.load()">Coba Lagi</button>
        </div>`;
    }
  },

  async loadWishlist() {
    if (!Auth.isLoggedIn()) return;
    const { data } = await db
      .from('wishlists')
      .select('product_id')
      .eq('user_id', Auth.currentUser.id);
    this.wishlist = new Set((data || []).map(w => w.product_id));
  },

  render() {
    const container = document.getElementById('produk-grid');
    if (!container) return;

    if (!this.filtered.length) {
      container.innerHTML = `
        <div class="empty-state full">
          <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
          <h3>Produk tidak ditemukan</h3>
          <p>Coba kata kunci atau kategori lain</p>
          <button class="btn-outline" onclick="Produk.resetFilter()">Reset Filter</button>
        </div>`;
      return;
    }

    container.innerHTML = this.filtered.map(p => this.cardHTML(p)).join('');
  },

  cardHTML(p) {
    const habis = p.stok <= 0;
    const inWishlist = this.wishlist.has(p.id);
    const imgSrc = p.image_url || `https://placehold.co/300x300/e8f5e9/2e7d32?text=${encodeURIComponent(p.nama)}`;

    return `
    <div class="produk-card" data-id="${p.id}">
      <div class="card-img-wrap">
        <img src="${imgSrc}" alt="${p.nama}" class="card-img" loading="lazy" onerror="this.src='https://placehold.co/300x300/e8f5e9/2e7d32?text=Foto'">
        ${habis ? '<div class="badge-habis">Stok Habis</div>' : ''}
        <button class="btn-wishlist ${inWishlist ? 'active' : ''}" onclick="Produk.toggleWishlist('${p.id}', event)" title="Wishlist">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${inWishlist ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
        </button>
      </div>
      <div class="card-body">
        <p class="card-kategori">${p.kategori}</p>
        <h3 class="card-nama">${p.nama}</h3>
        <div class="card-stok">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          ${habis ? '<span class="stok-habis-text">Stok Habis</span>' : `<span>Stok: ${p.stok}</span>`}
        </div>
        <div class="card-footer">
          <span class="card-harga">${Fmt.currency(p.harga)}</span>
          <div class="card-actions">
            <a href="detail.html?id=${p.id}" class="btn-detail" title="Lihat Detail">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            </a>
            <button 
              class="btn-keranjang ${habis ? 'disabled' : ''}" 
              onclick="${habis ? '' : `Produk.addToCart('${p.id}')`}"
              ${habis ? 'disabled' : ''}
              title="Tambah ke Keranjang">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>`;
  },

  addToCart(productId) {
    const product = this.all.find(p => p.id === productId);
    if (!product) return;
    if (!Auth.isLoggedIn()) {
      Modal.showLogin();
      return;
    }
    Cart.add(product, 1);
  },

  async toggleWishlist(productId, e) {
    e.preventDefault();
    e.stopPropagation();
    if (!Auth.requireLogin()) return;

    const btn = e.currentTarget;
    const inList = this.wishlist.has(productId);

    if (inList) {
      await db.from('wishlists').delete()
        .eq('user_id', Auth.currentUser.id)
        .eq('product_id', productId);
      this.wishlist.delete(productId);
      btn.classList.remove('active');
      btn.querySelector('svg').setAttribute('fill', 'none');
      Toast.show('Dihapus dari wishlist', 'info');
    } else {
      await db.from('wishlists').insert({
        user_id: Auth.currentUser.id,
        product_id: productId
      });
      this.wishlist.add(productId);
      btn.classList.add('active');
      btn.querySelector('svg').setAttribute('fill', 'currentColor');
      Toast.show('Ditambahkan ke wishlist', 'success');
    }
  },

  setupSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;
    let timeout;
    input.addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.applyFilter();
      }, 300);
    });
  },

  setupKategori() {
    document.querySelectorAll('[data-kategori]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-kategori]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeKategori = btn.dataset.kategori;
        this.applyFilter();
      });
    });
  },

  buildKategori() {
    const kategoriSet = [...new Set(this.all.map(p => p.kategori))];
    const container = document.getElementById('kategori-list');
    if (!container) return;

    const items = ['semua', ...kategoriSet];
    container.innerHTML = items.map(k => `
      <button class="chip-kategori ${k === 'semua' ? 'active' : ''}" data-kategori="${k}">
        ${k === 'semua' ? 'Semua' : k}
      </button>
    `).join('');

    this.setupKategori();
  },

  applyFilter() {
    this.filtered = this.all.filter(p => {
      const matchKat = this.activeKategori === 'semua' || p.kategori === this.activeKategori;
      const matchSearch = !this.searchQuery ||
        p.nama.toLowerCase().includes(this.searchQuery) ||
        p.deskripsi?.toLowerCase().includes(this.searchQuery) ||
        p.kategori.toLowerCase().includes(this.searchQuery);
      return matchKat && matchSearch;
    });
    this.render();
  },

  resetFilter() {
    this.searchQuery = '';
    this.activeKategori = 'semua';
    const input = document.getElementById('search-input');
    if (input) input.value = '';
    document.querySelectorAll('[data-kategori]').forEach(b => b.classList.remove('active'));
    const allBtn = document.querySelector('[data-kategori="semua"]');
    if (allBtn) allBtn.classList.add('active');
    this.filtered = [...this.all];
    this.render();
  },

  // Update a single product card (for realtime)
  updateCard(product) {
    const idx = this.all.findIndex(p => p.id === product.id);
    if (idx !== -1) {
      this.all[idx] = { ...this.all[idx], ...product };
    } else {
      this.all.unshift(product);
    }
    this.applyFilter();
  },

  removeCard(productId) {
    this.all = this.all.filter(p => p.id !== productId);
    this.applyFilter();
  }
};

window.Produk = Produk;
