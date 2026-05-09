-- ============================================================
-- MINISAYUR MARKET - SETUP LENGKAP
-- Jalankan SATU KALI di Supabase SQL Editor
-- Kategori: Sayur | Ikan | Makanan
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- TABLES
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE NOT NULL, full_name TEXT, avatar_url TEXT,
  is_admin BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nama TEXT NOT NULL, harga NUMERIC(12,2) NOT NULL CHECK (harga >= 0),
  stok INTEGER NOT NULL DEFAULT 0 CHECK (stok >= 0),
  kategori TEXT NOT NULL DEFAULT 'Lainnya', deskripsi TEXT, image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE, terjual INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  total NUMERIC(12,2) NOT NULL CHECK (total >= 0),
  status TEXT NOT NULL DEFAULT 'menunggu' CHECK (status IN ('menunggu','diproses','dikirim','selesai','dibatalkan')),
  payment_method TEXT NOT NULL DEFAULT 'cod', catatan TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(), updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  nama_produk TEXT NOT NULL, harga_satuan NUMERIC(12,2) NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0), subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.addresses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  penerima TEXT NOT NULL, nomor_hp TEXT NOT NULL, alamat TEXT NOT NULL,
  foto_rumah TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.wishlists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(), UNIQUE(user_id, product_id)
);
CREATE TABLE IF NOT EXISTS public.admin_stats (
  id INTEGER PRIMARY KEY DEFAULT 1, total_produk INTEGER DEFAULT 0,
  total_pesanan INTEGER DEFAULT 0, total_pendapatan NUMERIC(14,2) DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO public.admin_stats (id) VALUES (1) ON CONFLICT DO NOTHING;

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_products_kategori    ON public.products(kategori);
CREATE INDEX IF NOT EXISTS idx_orders_user_id       ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status        ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- FUNCTIONS & TRIGGERS
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, is_admin)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN NEW.email = 'azharazhar11x@gmail.com' THEN TRUE ELSE FALSE END)
  ON CONFLICT (id) DO UPDATE SET email=EXCLUDED.email, full_name=EXCLUDED.full_name, updated_at=NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.kurangi_stok() RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.products SET stok=stok-NEW.qty, terjual=terjual+NEW.qty
  WHERE id=NEW.product_id AND stok>=NEW.qty;
  IF NOT FOUND THEN RAISE EXCEPTION 'Stok tidak mencukupi'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trigger_kurangi_stok ON public.order_items;
CREATE TRIGGER trigger_kurangi_stok AFTER INSERT ON public.order_items FOR EACH ROW EXECUTE FUNCTION public.kurangi_stok();

CREATE OR REPLACE FUNCTION public.kembalikan_stok() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status='dibatalkan' AND OLD.status!='dibatalkan' THEN
    UPDATE public.products p SET stok=p.stok+oi.qty, terjual=GREATEST(0,p.terjual-oi.qty)
    FROM public.order_items oi WHERE oi.order_id=NEW.id AND p.id=oi.product_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trigger_kembalikan_stok ON public.orders;
CREATE TRIGGER trigger_kembalikan_stok AFTER UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.kembalikan_stok();

CREATE OR REPLACE FUNCTION public.update_admin_stats() RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.admin_stats SET
    total_produk=(SELECT COUNT(*) FROM public.products WHERE is_active=TRUE),
    total_pesanan=(SELECT COUNT(*) FROM public.orders),
    total_pendapatan=(SELECT COALESCE(SUM(total),0) FROM public.orders WHERE status='selesai'),
    updated_at=NOW() WHERE id=1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
DROP TRIGGER IF EXISTS trigger_stats_orders ON public.orders;
CREATE TRIGGER trigger_stats_orders AFTER INSERT OR UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_admin_stats();
DROP TRIGGER IF EXISTS trigger_stats_products ON public.products;
CREATE TRIGGER trigger_stats_products AFTER INSERT OR UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_admin_stats();

-- RLS
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wishlists   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (auth.uid()=id OR EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_admin=TRUE));
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (auth.uid()=id);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (auth.uid()=id);

CREATE POLICY "products_select" ON public.products FOR SELECT USING (is_active=TRUE OR EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_admin=TRUE));
CREATE POLICY "products_insert" ON public.products FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_admin=TRUE));
CREATE POLICY "products_update" ON public.products FOR UPDATE USING (EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_admin=TRUE));
CREATE POLICY "products_delete" ON public.products FOR DELETE USING (EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_admin=TRUE));

CREATE POLICY "orders_select" ON public.orders FOR SELECT USING (auth.uid()=user_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_admin=TRUE));
CREATE POLICY "orders_insert" ON public.orders FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "orders_update" ON public.orders FOR UPDATE USING (EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_admin=TRUE) OR (auth.uid()=user_id AND status='menunggu'));

CREATE POLICY "order_items_select" ON public.order_items FOR SELECT USING (EXISTS(SELECT 1 FROM public.orders WHERE id=order_id AND user_id=auth.uid()) OR EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_admin=TRUE));
CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT WITH CHECK (EXISTS(SELECT 1 FROM public.orders WHERE id=order_id AND user_id=auth.uid()));

CREATE POLICY "addresses_select" ON public.addresses FOR SELECT USING (auth.uid()=user_id OR EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_admin=TRUE));
CREATE POLICY "addresses_insert" ON public.addresses FOR INSERT WITH CHECK (auth.uid()=user_id);

CREATE POLICY "wishlists_select" ON public.wishlists FOR SELECT USING (auth.uid()=user_id);
CREATE POLICY "wishlists_insert" ON public.wishlists FOR INSERT WITH CHECK (auth.uid()=user_id);
CREATE POLICY "wishlists_delete" ON public.wishlists FOR DELETE USING (auth.uid()=user_id);

CREATE POLICY "admin_stats_select" ON public.admin_stats FOR SELECT USING (EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_admin=TRUE));

-- REALTIME
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_stats;

-- STORAGE
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('product-images','product-images',TRUE, 5242880, ARRAY['image/jpeg','image/png','image/webp']),
  ('house-images',  'house-images',  FALSE,10485760,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "prod_img_read"    ON storage.objects FOR SELECT USING (bucket_id='product-images');
CREATE POLICY "prod_img_upload"  ON storage.objects FOR INSERT WITH CHECK (bucket_id='product-images' AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_admin=TRUE));
CREATE POLICY "prod_img_delete"  ON storage.objects FOR DELETE USING (bucket_id='product-images' AND EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_admin=TRUE));
CREATE POLICY "house_img_upload" ON storage.objects FOR INSERT WITH CHECK (bucket_id='house-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "house_img_read"   ON storage.objects FOR SELECT USING (bucket_id='house-images' AND (auth.uid()::TEXT=(storage.foldername(name))[1] OR EXISTS(SELECT 1 FROM public.profiles WHERE id=auth.uid() AND is_admin=TRUE)));

-- SAMPLE DATA
INSERT INTO public.products (nama, harga, stok, kategori, deskripsi) VALUES
  ('Bayam Segar (250g)',    5000, 50,'Sayur','Bayam segar kaya zat besi, cocok untuk tumis atau sayur bening.'),
  ('Kangkung (250g)',       4000, 40,'Sayur','Kangkung muda segar, cocok untuk tumis belacan.'),
  ('Wortel (500g)',         8000, 35,'Sayur','Wortel manis segar, bagus untuk sup dan jus.'),
  ('Terong Ungu (2 buah)', 5000, 40,'Sayur','Terong segar, cocok untuk balado atau ungkep.'),
  ('Tomat Merah (500g)',  10000, 60,'Sayur','Tomat matang sempurna untuk sambal dan masak.'),
  ('Timun (3 buah)',        4000, 45,'Sayur','Timun renyah segar untuk lalapan dan acar.'),
  ('Ikan Mas (500g)',      25000, 20,'Ikan','Ikan mas segar, cocok digoreng atau dibuat pindang.'),
  ('Ikan Nila (500g)',     22000, 25,'Ikan','Ikan nila daging putih, rendah lemak dan kaya protein.'),
  ('Ikan Lele (500g)',     18000, 30,'Ikan','Lele segar untuk digoreng crispy atau dibakar.'),
  ('Udang Segar (250g)',   35000, 20,'Ikan','Udang segar ukuran sedang, cocok untuk tumis atau saus tiram.'),
  ('Telur Ayam (1 kg)',    28000, 50,'Makanan','Telur ayam kampung segar, isi 14-16 butir.'),
  ('Tahu Putih (5 pcs)',    8000, 60,'Makanan','Tahu putih segar lembut untuk berbagai olahan.'),
  ('Tempe (1 papan)',       7000, 55,'Makanan','Tempe kedelai pilihan, padat dan bernutrisi.'),
  ('Beras Pulen (1 kg)',   14000,100,'Makanan','Beras pulen premium, nasi lembut dan wangi.')
ON CONFLICT DO NOTHING;
-- SELESAI
