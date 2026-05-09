// ============================================================
// CHECKOUT.JS - Proses checkout & upload foto rumah
// ============================================================

const Checkout = {
  async init() {
    if (!Auth.isLoggedIn()) {
      Modal.showLogin();
      return;
    }
    if (!Cart.items.length) {
      window.location.href = 'produk.html';
      return;
    }
    this.renderRingkasan();
    this.renderForm();
    this.setupUpload();
  },

  renderRingkasan() {
    const container = document.getElementById('checkout-items');
    if (!container) return;
    container.innerHTML = Cart.items.map(item => `
      <div class="checkout-item">
        <img src="${item.image_url || `https://placehold.co/60x60/e8f5e9/2e7d32?text=${encodeURIComponent(item.nama)}`}" 
             alt="${item.nama}" class="checkout-item-img">
        <div class="checkout-item-info">
          <p class="checkout-item-nama">${item.nama}</p>
          <p class="checkout-item-qty">${item.qty} x ${Fmt.currency(item.harga)}</p>
        </div>
        <span class="checkout-item-sub">${Fmt.currency(item.harga * item.qty)}</span>
      </div>
    `).join('');

    const totalEl = document.getElementById('checkout-total');
    if (totalEl) totalEl.textContent = Fmt.currency(Cart.getTotal());
  },

  renderForm() {
    const user = Auth.currentUser;
    const profile = Auth.currentProfile;
    const namaInput = document.getElementById('nama-penerima');
    if (namaInput && profile?.full_name) namaInput.value = profile.full_name;
  },

  setupUpload() {
    const input = document.getElementById('foto-rumah');
    const preview = document.getElementById('foto-preview');
    if (!input) return;

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        Toast.show('Ukuran foto maksimal 5MB', 'error');
        input.value = '';
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (preview) {
          preview.src = ev.target.result;
          preview.style.display = 'block';
        }
      };
      reader.readAsDataURL(file);
    });
  },

  async uploadFotoRumah(file, orderId) {
    const ext = file.name.split('.').pop();
    const path = `${Auth.currentUser.id}/${orderId}.${ext}`;
    const { data, error } = await db.storage
      .from('house-images')
      .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: urlData } = db.storage.from('house-images').getPublicUrl(path);
    return urlData.publicUrl;
  },

  validate() {
    const nama = document.getElementById('nama-penerima')?.value.trim();
    const hp = document.getElementById('nomor-hp')?.value.trim();
    const alamat = document.getElementById('alamat')?.value.trim();

    if (!nama) { Toast.show('Nama penerima wajib diisi', 'error'); return false; }
    if (!hp || !/^(\+62|0)[0-9]{8,13}$/.test(hp)) {
      Toast.show('Nomor HP tidak valid', 'error'); return false;
    }
    if (!alamat || alamat.length < 10) {
      Toast.show('Alamat terlalu singkat, tolong lengkapi', 'error'); return false;
    }
    return true;
  },

  async submit() {
    if (!this.validate()) return;
    if (!Cart.items.length) return;

    const btn = document.getElementById('btn-pesan');
    if (btn) { btn.disabled = true; btn.textContent = 'Memproses...'; }

    try {
      // 1. Buat order
      const { data: order, error: orderErr } = await db
        .from('orders')
        .insert({
          user_id: Auth.currentUser.id,
          total: Cart.getTotal(),
          status: 'menunggu',
          payment_method: 'cod',
          catatan: document.getElementById('catatan')?.value.trim() || null
        })
        .select()
        .single();
      if (orderErr) throw orderErr;

      // 2. Insert order items
      const items = Cart.items.map(i => ({
        order_id: order.id,
        product_id: i.id,
        nama_produk: i.nama,
        harga_satuan: i.harga,
        qty: i.qty,
        subtotal: i.harga * i.qty
      }));
      const { error: itemsErr } = await db.from('order_items').insert(items);
      if (itemsErr) throw itemsErr;

      // 3. Upload foto rumah jika ada
      let fotoUrl = null;
      const fotoInput = document.getElementById('foto-rumah');
      if (fotoInput?.files?.[0]) {
        try {
          fotoUrl = await this.uploadFotoRumah(fotoInput.files[0], order.id);
        } catch (e) {
          console.warn('Upload foto gagal, melanjutkan tanpa foto:', e.message);
        }
      }

      // 4. Insert alamat
      const { error: alamatErr } = await db.from('addresses').insert({
        order_id: order.id,
        user_id: Auth.currentUser.id,
        penerima: document.getElementById('nama-penerima').value.trim(),
        nomor_hp: document.getElementById('nomor-hp').value.trim(),
        alamat: document.getElementById('alamat').value.trim(),
        foto_rumah: fotoUrl
      });
      if (alamatErr) throw alamatErr;

      // 5. Clear cart
      Cart.clear();

      // 6. Redirect ke halaman pesanan
      Toast.show('Pesanan berhasil dibuat!', 'success');
      setTimeout(() => {
        window.location.href = `pesanan.html?new=${order.id}`;
      }, 1200);

    } catch (err) {
      Toast.show('Gagal membuat pesanan: ' + err.message, 'error');
      if (btn) { btn.disabled = false; btn.textContent = 'Buat Pesanan'; }
    }
  }
};

window.Checkout = Checkout;
