-- ============================================
-- media.112 - Database Schema for Supabase
-- Jalankan SQL ini di Supabase SQL Editor
-- ============================================

-- Kota
CREATE TABLE cities (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  initial TEXT NOT NULL,
  number_form TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Produk (flat table, linked ke cities)
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  city_id TEXT REFERENCES cities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size TEXT NOT NULL DEFAULT '1/4',
  default_price NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transaksi
CREATE TABLE transactions (
  id TEXT PRIMARY KEY,
  city_id TEXT REFERENCES cities(id),
  city_name TEXT,
  product_id TEXT REFERENCES products(id),
  product_name TEXT,
  product_initial TEXT,
  number_form TEXT,
  size TEXT,
  ply INTEGER DEFAULT 4,
  price_per_title NUMERIC DEFAULT 0,
  quantity INTEGER DEFAULT 1,
  total_price NUMERIC DEFAULT 0,
  material_cost NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'belum',
  date DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Belanja Bahan
CREATE TABLE expenses (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total_cost NUMERIC DEFAULT 0,
  payment_status TEXT DEFAULT 'lunas',
  titip_amount NUMERIC DEFAULT 0,
  remaining_amount NUMERIC DEFAULT 0,
  linked_transaction_id TEXT REFERENCES transactions(id),
  date DATE,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kas (Cashflow)
CREATE TABLE cashflow (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  amount NUMERIC DEFAULT 0,
  description TEXT,
  category TEXT DEFAULT 'operasional',
  date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow ENABLE ROW LEVEL SECURITY;

-- Policies (single-user, allow all)
CREATE POLICY "Allow all" ON cities FOR ALL USING (true);
CREATE POLICY "Allow all" ON products FOR ALL USING (true);
CREATE POLICY "Allow all" ON transactions FOR ALL USING (true);
CREATE POLICY "Allow all" ON expenses FOR ALL USING (true);
CREATE POLICY "Allow all" ON cashflow FOR ALL USING (true);
