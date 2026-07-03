-- ============================================
-- media.112 - Database Schema for Supabase
-- Jalankan SQL ini di Supabase SQL Editor
-- Version: 5.2.0 (security hardening)
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

-- ============================================
-- CHECK Constraints (data integrity at DB level)
-- ============================================

ALTER TABLE transactions ADD CONSTRAINT chk_transaction_payment_status
  CHECK (payment_status IN ('lunas', 'belum'));

ALTER TABLE transactions ADD CONSTRAINT chk_transaction_ply
  CHECK (ply >= 1 AND ply <= 10);

ALTER TABLE expenses ADD CONSTRAINT chk_expense_payment_status
  CHECK (payment_status IN ('lunas', 'belum', 'titip'));

ALTER TABLE cashflow ADD CONSTRAINT chk_cashflow_type
  CHECK (type IN ('in', 'out', 'adjust'));

ALTER TABLE cashflow ADD CONSTRAINT chk_cashflow_category
  CHECK (category IN ('modal', 'operasional', 'lainnya'));

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow ENABLE ROW LEVEL SECURITY;

-- Drop old permissive policies (if re-running)
DROP POLICY IF EXISTS "Allow all" ON cities;
DROP POLICY IF EXISTS "Allow all" ON products;
DROP POLICY IF EXISTS "Allow all" ON transactions;
DROP POLICY IF EXISTS "Allow all" ON expenses;
DROP POLICY IF EXISTS "Allow all" ON cashflow;

-- Per-operation policies (single-user app with anon key)
-- SELECT: readable by all anon users
CREATE POLICY "cities_select" ON cities FOR SELECT USING (true);
CREATE POLICY "products_select" ON products FOR SELECT USING (true);
CREATE POLICY "transactions_select" ON transactions FOR SELECT USING (true);
CREATE POLICY "expenses_select" ON expenses FOR SELECT USING (true);
CREATE POLICY "cashflow_select" ON cashflow FOR SELECT USING (true);

-- INSERT: allow anon to insert
CREATE POLICY "cities_insert" ON cities FOR INSERT WITH CHECK (true);
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "transactions_insert" ON transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "expenses_insert" ON expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "cashflow_insert" ON cashflow FOR INSERT WITH CHECK (true);

-- UPDATE: allow anon to update
CREATE POLICY "cities_update" ON cities FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "products_update" ON products FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "transactions_update" ON transactions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "expenses_update" ON expenses FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "cashflow_update" ON cashflow FOR UPDATE USING (true) WITH CHECK (true);

-- DELETE: allow anon to delete
CREATE POLICY "cities_delete" ON cities FOR DELETE USING (true);
CREATE POLICY "products_delete" ON products FOR DELETE USING (true);
CREATE POLICY "transactions_delete" ON transactions FOR DELETE USING (true);
CREATE POLICY "expenses_delete" ON expenses FOR DELETE USING (true);
CREATE POLICY "cashflow_delete" ON cashflow FOR DELETE USING (true);
