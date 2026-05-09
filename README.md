# MiniSayur Market - Panduan Setup Lengkap

## Deskripsi
Website marketplace mini khusus sayur, bahan dapur, dan kebutuhan harian.
Teknologi: HTML + CSS + Vanilla JavaScript + Supabase (Auth, Realtime, Storage)

---

## Struktur Folder

```
/minisayur
├── index.html          → Beranda
├── login.html          → Halaman login
├── produk.html         → Daftar produk
├── detail.html         → Detail produk
├── checkout.html       → Keranjang & checkout
├── pesanan.html        → Riwayat pesanan
├── admin.html          → Panel admin
├── kebijakan.html      → Syarat & kebijakan
│
├── /css
│   ├── style.css       → Design system utama
│   ├── auth.css        → Halaman login
│   ├── admin.css       → Panel admin
│   ├── produk.css      → Halaman produk
│   └── responsive.css  → Semua breakpoint
│
├── /js
│   ├── supabase.js     → ← EDIT FILE INI DULU
│   ├── app.js          → Toast, Cart, Modal, utils
│   ├── auth.js         → Google OAuth
│   ├── produk.js       → Listing & filter produk
│   ├── realtime.js     → Supabase Realtime
│   ├── checkout.js     → Proses checkout
│   └── admin.js        → Panel admin logic
│
└── /sql
    ├── setup.sql          → Jalankan 1x ini saja
```

---

## LANGKAH 1: Buat Project Supabase

1. Buka https://supabase.com
2. Klik **"New Project"**
3. Isi nama project: `minisayur-market`
4. Pilih region terdekat (Singapore)
5. Buat password database yang kuat
6. Tunggu project selesai dibuat (~2 menit)

---

## LANGKAH 2: Dapatkan API Keys

1. Buka project Supabase Anda
2. Pergi ke **Settings → API**
3. Salin:
   - **Project URL** → contoh: `https://abcdefgh.supabase.co`
   - **anon public** key → string panjang

---

## LANGKAH 3: Edit File Konfigurasi

Buka file `js/supabase.js` dan ganti:

```javascript
const SUPABASE_URL = 'https://YOUR_PROJECT_ID.supabase.co';
// Ganti dengan Project URL Anda

const SUPABASE_ANON_KEY = 'YOUR_ANON_PUBLIC_KEY';
// Ganti dengan anon public key Anda
```

---

## LANGKAH 4: Jalankan SQL Schema

Di Supabase Dashboard → **SQL Editor**, jalankan file-file ini **secara berurutan**:

### 4a. Jalankan 01_schema.sql
Copy-paste seluruh isi file `sql/01_schema.sql` → Run




---

## LANGKAH 5: Setup Google OAuth

1. Buka Supabase → **Authentication → Providers**
2. Klik **Google** → Enable
3. Buka Google Cloud Console: https://console.cloud.google.com
4. Buat project baru atau pilih yang sudah ada
5. Pergi ke **APIs & Services → OAuth consent screen**
   - User Type: External
   - Isi nama app, email
6. Pergi ke **APIs & Services → Credentials**
   - Klik **Create Credentials → OAuth 2.0 Client IDs**
   - Application type: **Web application**
   - Authorized redirect URIs: masukkan URL dari Supabase:
     `https://YOUR_PROJECT_ID.supabase.co/auth/v1/callback`
7. Salin **Client ID** dan **Client Secret**
8. Kembali ke Supabase → Authentication → Google
   - Masukkan Client ID dan Client Secret
   - Save

---

## LANGKAH 6: Setup Storage Buckets

Storage sudah dibuat otomatis melalui SQL. Verifikasi:

1. Buka Supabase → **Storage**
2. Pastikan ada 2 bucket:
   - `product-images` (Public)
   - `house-images` (Private)

Jika belum ada, buat manual:
- Klik **New Bucket**
- Nama: `product-images`, centang **Public bucket**
- Nama: `house-images`, **tidak** centang Public

---

## LANGKAH 7: Setup Realtime

1. Buka Supabase → **Database → Replication**
2. Pastikan tabel berikut sudah aktif di **supabase_realtime**:
   - `products`
   - `orders`
   - `order_items`
   - `admin_stats`

Jika belum, jalankan di SQL Editor:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_stats;
```

---

## LANGKAH 8: Setup Admin

Admin ditetapkan berdasarkan email. Pastikan di `js/supabase.js`:

```javascript
const ADMIN_EMAIL = 'azharazhar11x@gmail.com';
```

Saat login pertama dengan email tersebut, akun otomatis diberi status `is_admin = true` melalui trigger database.

---

## LANGKAH 9: Menjalankan Project

### Cara 1: VS Code Live Server (Rekomendasi)
1. Install extension **Live Server** di VS Code
2. Klik kanan `index.html` → **Open with Live Server**
3. Browser otomatis terbuka di `http://127.0.0.1:5500`

### Cara 2: Python HTTP Server
```bash
cd minisayur
python -m http.server 8000
# Buka: http://localhost:8000
```

### Cara 3: Node.js http-server
```bash
npm install -g http-server
cd minisayur
http-server -p 8000
# Buka: http://localhost:8000
```

**PENTING:** Jangan buka file HTML langsung (file://) karena OAuth tidak akan bekerja.

---

## LANGKAH 10: Deploy ke Internet

### Opsi A: Netlify (Gratis, Paling Mudah)
1. Buka https://netlify.com → Sign up
2. Drag & drop folder `minisayur` ke Netlify
3. Dapat URL: `https://xxx.netlify.app`
4. Update Google OAuth redirect URI dengan URL baru

### Opsi B: Vercel
1. Buka https://vercel.com → Sign up
2. Import dari GitHub atau upload folder
3. Deploy otomatis

### Opsi C: GitHub Pages
1. Upload ke repository GitHub
2. Settings → Pages → Deploy from branch `main`
3. URL: `https://username.github.io/minisayur`

---

## Konfigurasi Setelah Deploy

Setelah deploy, update:

1. **Google Cloud Console** → Authorized redirect URIs:
   Tambahkan: `https://YOUR_DOMAIN.com/`

2. **Supabase** → Authentication → URL Configuration:
   - Site URL: `https://YOUR_DOMAIN.com`
   - Redirect URLs: `https://YOUR_DOMAIN.com/**`

---

## Troubleshooting

### Login Google tidak bekerja
- Pastikan redirect URI di Google Console sudah benar
- Pastikan domain di Supabase Auth sudah benar
- Coba di localhost bukan file://

### Produk tidak muncul
- Cek SQL sudah dijalankan dengan benar
- Cek RLS policies tidak memblokir (buka Table Editor di Supabase)
- Cek browser console untuk error

### Realtime tidak update
- Pastikan tabel sudah di-publish ke supabase_realtime
- Cek koneksi websocket di browser DevTools → Network

### Upload gambar gagal
- Pastikan bucket sudah dibuat
- Pastikan storage policies sudah dijalankan
- Cek ukuran file < 5MB

---

## Fitur Lengkap

### Pembeli
- Login dengan Google
- Browsing produk dengan search & filter kategori realtime
- Wishlist produk
- Keranjang belanja (session storage)
- Checkout dengan form pengiriman + upload foto rumah
- Pembayaran COD
- Tracking pesanan realtime
- Dark mode

### Admin (azharazhar11x@gmail.com)
- Dashboard statistik (produk, pesanan, pendapatan)
- CRUD produk dengan upload foto
- Manajemen pesanan
- Update status pesanan (realtime ke pembeli)
- Laporan pendapatan harian/bulanan/total
- Grafik pendapatan 7 hari
- Notifikasi pesanan baru realtime

---

## Kontak & Bantuan

WhatsApp: +62 853-3248-9867

Atau jika ingin menitip pesanan barang yang tidak ada di katalog, silakan chat ke nomor tersebut.
