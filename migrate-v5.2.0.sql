-- ============================================
-- media.112 - Migration v5.2.0 (Security Hardening)
-- Jalankan SQL ini di Supabase SQL Editor
-- Aman dijalankan berulang kali (idempotent)
-- ============================================

-- ============================================
-- 1. CHECK Constraints (skip jika sudah ada)
-- ============================================

DO $$
BEGIN
    -- transactions payment_status
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_transaction_payment_status') THEN
        ALTER TABLE transactions ADD CONSTRAINT chk_transaction_payment_status
            CHECK (payment_status IN ('lunas', 'belum'));
    END IF;

    -- transactions ply
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_transaction_ply') THEN
        ALTER TABLE transactions ADD CONSTRAINT chk_transaction_ply
            CHECK (ply >= 1 AND ply <= 10);
    END IF;

    -- expenses payment_status
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_expense_payment_status') THEN
        ALTER TABLE expenses ADD CONSTRAINT chk_expense_payment_status
            CHECK (payment_status IN ('lunas', 'belum', 'titip'));
    END IF;

    -- cashflow type
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cashflow_type') THEN
        ALTER TABLE cashflow ADD CONSTRAINT chk_cashflow_type
            CHECK (type IN ('in', 'out', 'adjust'));
    END IF;

    -- cashflow category
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_cashflow_category') THEN
        ALTER TABLE cashflow ADD CONSTRAINT chk_cashflow_category
            CHECK (category IN ('modal', 'operasional', 'lainnya'));
    END IF;
END $$;

-- ============================================
-- 2. Drop old permissive policies
-- ============================================

DROP POLICY IF EXISTS "Allow all" ON cities;
DROP POLICY IF EXISTS "Allow all" ON products;
DROP POLICY IF EXISTS "Allow all" ON transactions;
DROP POLICY IF EXISTS "Allow all" ON expenses;
DROP POLICY IF EXISTS "Allow all" ON cashflow;

-- Drop new policies if re-running (idempotent)
DROP POLICY IF EXISTS "cities_select" ON cities;
DROP POLICY IF EXISTS "cities_insert" ON cities;
DROP POLICY IF EXISTS "cities_update" ON cities;
DROP POLICY IF EXISTS "cities_delete" ON cities;

DROP POLICY IF EXISTS "products_select" ON products;
DROP POLICY IF EXISTS "products_insert" ON products;
DROP POLICY IF EXISTS "products_update" ON products;
DROP POLICY IF EXISTS "products_delete" ON products;

DROP POLICY IF EXISTS "transactions_select" ON transactions;
DROP POLICY IF EXISTS "transactions_insert" ON transactions;
DROP POLICY IF EXISTS "transactions_update" ON transactions;
DROP POLICY IF EXISTS "transactions_delete" ON transactions;

DROP POLICY IF EXISTS "expenses_select" ON expenses;
DROP POLICY IF EXISTS "expenses_insert" ON expenses;
DROP POLICY IF EXISTS "expenses_update" ON expenses;
DROP POLICY IF EXISTS "expenses_delete" ON expenses;

DROP POLICY IF EXISTS "cashflow_select" ON cashflow;
DROP POLICY IF EXISTS "cashflow_insert" ON cashflow;
DROP POLICY IF EXISTS "cashflow_update" ON cashflow;
DROP POLICY IF EXISTS "cashflow_delete" ON cashflow;

-- ============================================
-- 3. Re-create per-operation RLS policies
-- ============================================

-- cities
CREATE POLICY "cities_select" ON cities FOR SELECT USING (true);
CREATE POLICY "cities_insert" ON cities FOR INSERT WITH CHECK (true);
CREATE POLICY "cities_update" ON cities FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "cities_delete" ON cities FOR DELETE USING (true);

-- products
CREATE POLICY "products_select" ON products FOR SELECT USING (true);
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "products_update" ON products FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "products_delete" ON products FOR DELETE USING (true);

-- transactions
CREATE POLICY "transactions_select" ON transactions FOR SELECT USING (true);
CREATE POLICY "transactions_insert" ON transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "transactions_update" ON transactions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "transactions_delete" ON transactions FOR DELETE USING (true);

-- expenses
CREATE POLICY "expenses_select" ON expenses FOR SELECT USING (true);
CREATE POLICY "expenses_insert" ON expenses FOR INSERT WITH CHECK (true);
CREATE POLICY "expenses_update" ON expenses FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "expenses_delete" ON expenses FOR DELETE USING (true);

-- cashflow
CREATE POLICY "cashflow_select" ON cashflow FOR SELECT USING (true);
CREATE POLICY "cashflow_insert" ON cashflow FOR INSERT WITH CHECK (true);
CREATE POLICY "cashflow_update" ON cashflow FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "cashflow_delete" ON cashflow FOR DELETE USING (true);
