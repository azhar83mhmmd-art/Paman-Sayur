// ============================================================
// ADMIN.JS - Panel Admin: produk, pesanan, pendapatan
// ============================================================

const Admin = {
  currentTab: 'dashboard',

  async init() {
    // Guard: hanya admin
    await Auth.init();
    if (!Auth.isAdmin()) {
      document.body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;font-family:sans-serif;">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#e53e3e" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <h2 style="color:#e53e3e">Akses Ditolak</h2>
          <p style="color:#666">Halaman ini hanya untuk admin.</p>
          <a href="index.html" style="color:#2e7d32">Kembali ke Beranda</a>
        </div>`;
      return;
    }

    this.loadDashboard();
    this.loadProdukList();
    this.setupRealtimeAdmin();
    this.showTab('dashboard');
  },

  showTab(tab) {
    this.currentTab = tab;
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    const btn = document.querySelector(`[data-tab="${tab}"]`);
    const section = document.getElementById(`section-${tab}`);
    if (btn) btn.classList.add('active');
    if (section) section.classList.add('active');
  },

  // ---- DASHBOARD ----
  async loadDashboard() {
    try {
      const [produkRes, orderRes, pendapatanRes, habisRes] = await Promise.all([
        db.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        db.from('orders').select('id', { count: 'exact', head: true }),
        db.from('orders').select('total').eq('status', 'selesai'),
        db.from('products').select('id', { count: 'exact', head: true }).eq('stok', 0).eq('is_active', true)
      ]);

      const pendapatan = (pendapatanRes.data || []).reduce((s, o) => s + Number(o.total), 0);

      this.setCard('stat-produk', produkRes.count || 0);
      this.setCard('stat-pesanan', orderRes.count || 0);
      this.setCard('stat-pendapatan', Fmt.currency(pendapatan));
      this.setCard('stat-habis', habisRes.count || 0);

      await this.loadTerlaris();
      await this.loadPesananTerbaru();
      await this.loadGrafik();
    } catch (err) {
      console.error('Dashboard load error:', err);
    }
  },

  setCard(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  },

  async loadTerlaris() {
    const { data } = await db
      .from('products')
      .select('nama, terjual, harga')
      .eq('is_active', true)
      .order('terjual', { ascending: false })
      .limit(5);

    const container = document.getElementById('terlaris-list');
    if (!container) return;
    if (!data?.length) {
      container.innerHTML = '<p class="empty-text">Belum ada data</p>';
      return;
    }
    container.innerHTML = data.map((p, i) => `
      <div class="terlaris-item">
        <span class="rank">${i + 1}</span>
        <div class="terlaris-info">
          <strong>${p.nama}</strong>
          <span>${Fmt.currency(p.harga)}</span>
        </div>
        <span class="terjual-count">${p.terjual} terjual</span>
      </div>
    `).join('');
  },

  async loadPesananTerbaru() {
    const { data } = await db
      .from('orders')
      .select(`id, total, status, created_at, addresses(penerima, nomor_hp)`)
      .order('created_at', { ascending: false })
      .limit(5);

    const container = document.getElementById('pesanan-terbaru');
    if (!container) return;
    if (!data?.length) {
      container.innerHTML = '<p class="empty-text">Belum ada pesanan</p>';
      return;
    }
    container.innerHTML = data.map(o => `
      <div class="pesanan-row">
        <div>
          <strong>${o.addresses?.[0]?.penerima || 'Pelanggan'}</strong>
          <p class="order-id">#${o.id.split('-')[0]}</p>
        </div>
        <span class="${Fmt.statusClass(o.status)} status-badge">${Fmt.statusLabel(o.status)}</span>
        <strong>${Fmt.currency(o.total)}</strong>
      </div>
    `).join('');
  },

  async loadGrafik() {
    const { data } = await db
      .from('orders')
      .select('created_at, total')
      .eq('status', 'selesai')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const container = document.getElementById('grafik-pendapatan');
    if (!container) return;

    const byDay = {};
    (data || []).forEach(o => {
      const d = o.created_at.split('T')[0];
      byDay[d] = (byDay[d] || 0) + Number(o.total);
    });

    const keys = Object.keys(byDay).sort().slice(-7);
    if (!keys.length) {
      container.innerHTML = '<p class="empty-text">Belum ada pendapatan bulan ini</p>';
      return;
    }

    const max = Math.max(...keys.map(k => byDay[k]));
    container.innerHTML = `
      <div class="bar-chart">
        ${keys.map(k => `
          <div class="bar-item">
            <div class="bar" style="height: ${max ? Math.max(4, (byDay[k] / max) * 100) : 4}%"></div>
            <span class="bar-label">${k.slice(5)}</span>
          </div>
        `).join('')}
      </div>
    `;
  },

  // ---- PRODUK MANAGEMENT ----
  async loadProdukList() {
    const container = document.getElementById('admin-produk-list');
    if (!container) return;
    container.innerHTML = createSkeleton(4);

    const { data, error } = await db
      .from('products')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) { container.innerHTML = `<p class="error-text">Error: ${error.message}</p>`; return; }

    if (!data?.length) {
      container.innerHTML = '<p class="empty-text">Belum ada produk. Tambahkan produk pertama Anda.</p>';
      return;
    }

    container.innerHTML = `
      <table class="admin-table">
        <thead>
          <tr>
            <th>Produk</th>
            <th>Kategori</th>
            <th>Harga</th>
            <th>Stok</th>
            <th>Terjual</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          ${data.map(p => `
            <tr>
              <td>
                <div class="table-produk">
                  <img src="${p.image_url || `https://placehold.co/40x40/e8f5e9/2e7d32?text=${encodeURIComponent(p.nama[0])}`}" 
                       alt="${p.nama}" class="table-img">
                  <span>${p.nama}</span>
                </div>
              </td>
              <td><span class="chip">${p.kategori}</span></td>
              <td>${Fmt.currency(p.harga)}</td>
              <td class="${p.stok === 0 ? 'stok-0' : ''}">${p.stok}</td>
              <td>${p.terjual}</td>
              <td>
                <div class="table-actions">
                  <button class="btn-icon edit" onclick="Admin.editProduk('${p.id}')" title="Edit">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                  <button class="btn-icon delete" onclick="Admin.deleteProduk('${p.id}', '${p.nama}')" title="Hapus">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;
  },

  showFormProduk(data = null) {
    const modal = document.getElementById('modal-produk');
    const title = document.getElementById('form-produk-title');
    if (title) title.textContent = data ? 'Edit Produk' : 'Tambah Produk';
    if (data) {
      document.getElementById('fp-id').value = data.id || '';
      document.getElementById('fp-nama').value = data.nama || '';
      document.getElementById('fp-harga').value = data.harga || '';
      document.getElementById('fp-stok').value = data.stok || '';
      document.getElementById('fp-kategori').value = data.kategori || '';
      document.getElementById('fp-deskripsi').value = data.deskripsi || '';
      const preview = document.getElementById('fp-img-preview');
      if (preview && data.image_url) { preview.src = data.image_url; preview.style.display = 'block'; }
    } else {
      document.getElementById('form-produk').reset();
      document.getElementById('fp-id').value = '';
      const preview = document.getElementById('fp-img-preview');
      if (preview) preview.style.display = 'none';
    }
    if (modal) modal.classList.add('active');
  },

  async editProduk(id) {
    const { data } = await db.from('products').select('*').eq('id', id).single();
    if (data) this.showFormProduk(data);
  },

  deleteProduk(id, nama) {
    const self = this;
    Modal.confirm(
      'Hapus Produk',
      `Yakin ingin menghapus "<strong>${nama}</strong>"?`,
      async () => {
        const { error } = await db
          .from('products')
          .update({ is_active: false })
          .eq('id', id);
        if (error) {
          Toast.show('Gagal menghapus: ' + error.message, 'error');
        } else {
          Toast.show('Produk berhasil dihapus', 'success');
          self.loadProdukList();
          self.loadDashboard();
        }
      }
    );
  },

  async saveProduk() {
    const id = document.getElementById('fp-id')?.value;
    const nama = document.getElementById('fp-nama')?.value.trim();
    const harga = parseFloat(document.getElementById('fp-harga')?.value);
    const stok = parseInt(document.getElementById('fp-stok')?.value);
    const kategori = document.getElementById('fp-kategori')?.value.trim();
    const deskripsi = document.getElementById('fp-deskripsi')?.value.trim();
    const fileInput = document.getElementById('fp-gambar');

    if (!nama || !harga || isNaN(stok) || !kategori) {
      Toast.show('Lengkapi semua field wajib', 'error'); return;
    }

    const btn = document.getElementById('btn-save-produk');
    if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }

    try {
      let image_url = null;

      // Upload gambar jika ada
      if (fileInput?.files?.[0]) {
        const file = fileInput.files[0];
        const ext = file.name.split('.').pop();
        const path = `${Date.now()}.${ext}`;
        const { error: upErr } = await db.storage.from('product-images').upload(path, file);
        if (upErr) throw upErr;
        const { data: urlData } = db.storage.from('product-images').getPublicUrl(path);
        image_url = urlData.publicUrl;
      }

      const payload = { nama, harga, stok, kategori, deskripsi };
      if (image_url) payload.image_url = image_url;

      let error;
      if (id) {
        ({ error } = await db.from('products').update(payload).eq('id', id));
      } else {
        ({ error } = await db.from('products').insert(payload));
      }
      if (error) throw error;

      Toast.show(id ? 'Produk diperbarui' : 'Produk ditambahkan', 'success');
      Modal.close('modal-produk');
      this.loadProdukList();
      this.loadDashboard();
    } catch (err) {
      Toast.show('Error: ' + err.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = 'Simpan'; }
    }
  },

  // ---- PESANAN MANAGEMENT ----
  async loadPesanan(statusFilter = 'semua') {
    const container = document.getElementById('admin-pesanan-list');
    if (!container) return;
    container.innerHTML = '<div class="loading-spinner-wrap"><div class="loading-spinner"></div></div>';

    try {
      let query = db.from('orders')
        .select(`
          id, total, status, catatan, created_at, user_id,
          addresses(penerima, nomor_hp, alamat, foto_rumah),
          order_items(nama_produk, qty, subtotal)
        `)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'semua') query = query.eq('status', statusFilter);

      const { data, error } = await query;
      if (error) throw error;

      if (!data?.length) {
        container.innerHTML = '<div class="empty-state"><svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg><p>Belum ada pesanan</p></div>';
        return;
      }

      container.innerHTML = data.map(o => {
        const addr = o.addresses?.[0];
        const items = o.order_items || [];
        const waNum = addr?.nomor_hp ? addr.nomor_hp.replace(/^0/, '62').replace(/\D/g, '') : null;
        return `
          <div class="pesanan-card admin">
            <div class="pesanan-header">
              <div>
                <span class="order-num">#${o.id.split('-')[0].toUpperCase()}</span>
                <span class="order-date">${Fmt.date(o.created_at)}</span>
              </div>
              <select class="status-select ${Fmt.statusClass(o.status)}"
                      onchange="Admin.updateStatus('${o.id}', this.value)">
                <option value="menunggu"  ${o.status==='menunggu' ?'selected':''}>Menunggu</option>
                <option value="diproses"  ${o.status==='diproses' ?'selected':''}>Diproses</option>
                <option value="dikirim"   ${o.status==='dikirim'  ?'selected':''}>Dikirim</option>
                <option value="selesai"   ${o.status==='selesai'  ?'selected':''}>Selesai</option>
                <option value="dibatalkan"${o.status==='dibatalkan'?'selected':''}>Dibatalkan</option>
              </select>
            </div>
            <div class="pesanan-body">
              <div class="pesanan-buyer">
                <strong>${addr?.penerima || 'Pelanggan'}</strong>
                ${waNum ? `
                <a href="https://wa.me/${waNum}" target="_blank" class="btn-wa-order">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.106.549 4.083 1.508 5.799L.057 23.625a.75.75 0 00.918.918l5.826-1.451A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.662-.524-5.172-1.434l-.372-.22-3.849.959.977-3.752-.242-.386A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
                  ${addr.nomor_hp}
                </a>` : '<span class="no-contact">Tidak ada nomor</span>'}
                <p class="pesanan-alamat">${addr?.alamat || '-'}</p>
                ${addr?.foto_rumah ? `
                <a href="${addr.foto_rumah}" target="_blank" class="btn-foto">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  Lihat Foto Rumah
                </a>` : ''}
              </div>
              <div class="pesanan-items-list">
                ${items.map(i => `
                  <div class="pesanan-item-row">
                    <span>${i.nama_produk}</span>
                    <span>${i.qty}x</span>
                    <span>${Fmt.currency(i.subtotal)}</span>
                  </div>`).join('')}
              </div>
            </div>
            <div class="pesanan-footer">
              <span>Total: <strong>${Fmt.currency(o.total)}</strong></span>
              <span class="payment-badge">COD</span>
            </div>
            ${o.catatan ? `<div class="pesanan-catatan"><em>Catatan: ${o.catatan}</em></div>` : ''}
          </div>`;
      }).join('');

    } catch (err) {
      container.innerHTML = `<p class="error-text">Kesalahan: ${err.message}</p>`;
    }
  },

  async updateStatus(orderId, newStatus) {
    const { error } = await db
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);
    if (error) {
      Toast.show('Gagal update status: ' + error.message, 'error');
    } else {
      Toast.show(`Status diubah menjadi "${Fmt.statusLabel(newStatus)}"`, 'success');
      this.loadDashboard();
    }
  },

  // ---- PENDAPATAN ----
  async loadPendapatan() {
    const today = new Date().toISOString().split('T')[0];
    const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const [harianRes, bulananRes, totalRes] = await Promise.all([
      db.from('orders').select('total').eq('status', 'selesai').gte('created_at', today),
      db.from('orders').select('total').eq('status', 'selesai').gte('created_at', firstDay),
      db.from('orders').select('total').eq('status', 'selesai'),
    ]);

    const sum = arr => (arr || []).reduce((s, o) => s + Number(o.total), 0);
    this.setCard('pend-harian', Fmt.currency(sum(harianRes.data)));
    this.setCard('pend-bulanan', Fmt.currency(sum(bulananRes.data)));
    this.setCard('pend-total', Fmt.currency(sum(totalRes.data)));
  },

  setupRealtimeAdmin() {
    Realtime.subscribeAllOrders((payload) => {
      if (payload.eventType === 'INSERT') {
        Toast.show('Pesanan baru masuk!', 'info', 5000);
      }
      if (this.currentTab === 'pesanan') this.loadPesanan();
      this.loadDashboard();
    });

    Realtime.subscribeProducts((payload) => {
      if (this.currentTab === 'produk') this.loadProdukList();
    });
  }
};

// Setup gambar preview untuk form produk
document.addEventListener('DOMContentLoaded', () => {
  const fp = document.getElementById('fp-gambar');
  if (fp) {
    fp.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const preview = document.getElementById('fp-img-preview');
      if (!preview) return;
      const reader = new FileReader();
      reader.onload = ev => { preview.src = ev.target.result; preview.style.display = 'block'; };
      reader.readAsDataURL(file);
    });
  }
});

window.Admin = Admin;
