// ============================================================
// CHECKOUT.JS - Proses checkout: COD & Transfer Dana
// ============================================================

const Checkout = {
  async init() {
    if (!Auth.isLoggedIn()) { Modal.showLogin(); return; }
    if (!Cart.items.length) { window.location.href = 'produk.html'; return; }
    this.renderRingkasan();
    this.renderForm();
    this.setupFotoRumahUpload();
  },

  renderRingkasan() {
    const container = document.getElementById('checkout-items');
    if (!container) return;
    container.innerHTML = Cart.items.map(item => `
      <div class="checkout-item">
        <img src="${item.image_url || 'https://placehold.co/60x60/e8f5e9/2e7d32?text=P'}"
             alt="${item.nama}" class="checkout-item-img">
        <div class="checkout-item-info">
          <p class="checkout-item-nama">${item.nama}</p>
          <p class="checkout-item-qty">${item.qty} x ${Fmt.currency(item.harga)}</p>
        </div>
        <span class="checkout-item-sub">${Fmt.currency(item.harga * item.qty)}</span>
      </div>
    `).join('');
    const total = Cart.getTotal();
    const sub = document.getElementById('checkout-subtotal');
    const tot = document.getElementById('checkout-total');
    if (sub) sub.textContent = Fmt.currency(total);
    if (tot) tot.textContent = Fmt.currency(total);
  },

  renderForm() {
    const profile = Auth.currentProfile;
    const namaInput = document.getElementById('nama-penerima');
    if (namaInput && profile?.full_name) namaInput.value = profile.full_name;
  },

  setupFotoRumahUpload() {
    const input   = document.getElementById('foto-rumah');
    const preview = document.getElementById('foto-preview');
    if (!input) return;
    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        Toast.show('Ukuran foto maksimal 5MB', 'error'); input.value = ''; return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (preview) { preview.src = ev.target.result; preview.style.display = 'block'; }
      };
      reader.readAsDataURL(file);
    });
  },

  validate() {
    const nama   = document.getElementById('nama-penerima')?.value.trim();
    const hp     = document.getElementById('nomor-hp')?.value.trim();
    const alamat = document.getElementById('alamat')?.value.trim();
    const method = typeof selectedPayment !== 'undefined' ? selectedPayment : 'cod';

    if (!nama)  { Toast.show('Nama penerima wajib diisi', 'error'); return false; }
    if (!hp || !/^(\+62|0)[0-9]{8,13}$/.test(hp)) {
      Toast.show('Nomor HP tidak valid', 'error'); return false;
    }
    if (!alamat || alamat.length < 10) {
      Toast.show('Alamat terlalu singkat, tolong lengkapi', 'error'); return false;
    }
    if (method === 'transfer') {
      const buktiInput = document.getElementById('bukti-transfer');
      if (!buktiInput?.files?.[0]) {
        Toast.show('Upload foto bukti transfer terlebih dahulu', 'error'); return false;
      }
    }
    return true;
  },

  async uploadFile(bucket, file, path) {
    const { error } = await db.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = db.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },

  async submit() {
    if (!this.validate()) return;
    if (!Cart.items.length) return;

    const method  = typeof selectedPayment !== 'undefined' ? selectedPayment : 'cod';
    const btn     = document.getElementById('btn-pesan');
    const btnText = document.getElementById('btn-pesan-text');
    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = 'Memproses...';

    try {
      // Transfer → menunggu_konfirmasi, COD → menunggu
      const initialStatus = method === 'transfer' ? 'menunggu_konfirmasi' : 'menunggu';

      // 1. Buat order
      const { data: order, error: orderErr } = await db.from('orders').insert({
        user_id: Auth.currentUser.id,
        total: Cart.getTotal(),
        status: initialStatus,
        payment_method: method,
        catatan: document.getElementById('catatan')?.value.trim() || null,
      }).select().single();
      if (orderErr) throw orderErr;

      // 2. Order items
      const { error: itemsErr } = await db.from('order_items').insert(
        Cart.items.map(i => ({
          order_id: order.id, product_id: i.id,
          nama_produk: i.nama, harga_satuan: i.harga,
          qty: i.qty, subtotal: i.harga * i.qty,
        }))
      );
      if (itemsErr) throw itemsErr;

      // 3. Upload foto rumah (opsional)
      let fotoRumahUrl = null;
      const fotoInput = document.getElementById('foto-rumah');
      if (fotoInput?.files?.[0]) {
        try {
          const ext = fotoInput.files[0].name.split('.').pop();
          fotoRumahUrl = await this.uploadFile(
            'house-images', fotoInput.files[0],
            `${Auth.currentUser.id}/${order.id}.${ext}`
          );
        } catch (e) { console.warn('Upload foto rumah gagal:', e.message); }
      }

      // 4. Upload bukti transfer (wajib jika transfer)
      if (method === 'transfer') {
        const buktiInput = document.getElementById('bukti-transfer');
        if (buktiInput?.files?.[0]) {
          const ext = buktiInput.files[0].name.split('.').pop();
          const buktiUrl = await this.uploadFile(
            'transfer-images', buktiInput.files[0],
            `${Auth.currentUser.id}/${order.id}_bukti.${ext}`
          );
          await db.from('orders').update({ bukti_transfer: buktiUrl }).eq('id', order.id);
        }
      }

      // 5. Alamat
      const { error: alamatErr } = await db.from('addresses').insert({
        order_id: order.id, user_id: Auth.currentUser.id,
        penerima: document.getElementById('nama-penerima').value.trim(),
        nomor_hp: document.getElementById('nomor-hp').value.trim(),
        alamat: document.getElementById('alamat').value.trim(),
        foto_rumah: fotoRumahUrl,
      });
      if (alamatErr) throw alamatErr;

      Cart.clear();
      Toast.show(
        method === 'transfer'
          ? 'Bukti transfer dikirim! Menunggu konfirmasi admin.'
          : 'Pesanan berhasil dibuat!',
        'success'
      );
      setTimeout(() => { window.location.href = `pesanan.html?new=${order.id}`; }, 1400);

    } catch (err) {
      Toast.show('Gagal membuat pesanan: ' + err.message, 'error');
      if (btn) btn.disabled = false;
      if (btnText) btnText.textContent = method === 'cod' ? 'Buat Pesanan (COD)' : 'Kirim Bukti Transfer';
    }
  }
};

window.Checkout = Checkout;
