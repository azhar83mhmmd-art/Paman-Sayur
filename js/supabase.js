// ============================================================
// KONFIGURASI SUPABASE
// Ganti nilai di bawah dengan credentials Supabase Anda
// ============================================================

// CARA MENDAPATKAN CREDENTIALS:
// 1. Buka https://supabase.com dan login
// 2. Buka project Anda
// 3. Pergi ke Settings > API
// 4. Copy "Project URL" dan "anon public" key

const SUPABASE_URL = 'https://jrnqnviqzvkbnolkulif.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_kTlZXF3-MFg4bcXDTHGlaQ_RDjEW2T1';

// Admin email - hanya email ini yang mendapat akses admin
const ADMIN_EMAIL = 'azharazhar11x@gmail.com';

// Inisialisasi Supabase client
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Export untuk digunakan di file lain
window.db = db;
window.ADMIN_EMAIL = ADMIN_EMAIL;
window.SUPABASE_URL = SUPABASE_URL;
