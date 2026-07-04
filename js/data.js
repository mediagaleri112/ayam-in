/**
 * media.112 - Data Management Layer (Supabase)
 * All data operations are async, backed by PostgreSQL via Supabase
 */

const DataStore = {

    // Check if Supabase is connected
    _checkDb() {
        if (!db) {
            throw new Error('Supabase belum terhubung. Periksa koneksi internet dan URL/key di js/supabase.js');
        }
    },

    // Generate unique ID
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
    },

    // Input validation helpers
    _validateString(val, name, maxLen = 255) {
        if (val === null || val === undefined || val === '') return null;
        if (typeof val !== 'string') return null;
        if (val.length > maxLen) throw new Error(`${name} maksimal ${maxLen} karakter`);
        return val.trim();
    },

    _validateNumber(val, name, min = 0, max = 999999999) {
        const num = parseFloat(val);
        if (isNaN(num)) throw new Error(`${name} harus berupa angka`);
        if (num < min || num > max) throw new Error(`${name} harus antara ${min} dan ${max}`);
        return num;
    },

    _validateId(val) {
        if (!val || typeof val !== 'string') throw new Error('ID tidak valid');
        if (val.length > 50) throw new Error('ID terlalu panjang');
        return val;
    },

    // Format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }).format(amount || 0);
    },

    // Format date
    formatDate(dateString) {
        if (!dateString) return '-';
        const options = { day: 'numeric', month: 'short', year: 'numeric' };
        return new Date(dateString).toLocaleDateString('id-ID', options);
    },

    // =====================
    // INITIALIZATION & MIGRATION
    // =====================

    async init() {
        try {
            // Check if Supabase is connected and has data
            const { count } = await db.from('cities').select('*', { count: 'exact', head: true });

            // If Supabase is empty, try migrating from localStorage
            if (count === 0) {
                await this.migrateFromLocalStorage();
            }
        } catch (e) {
            console.error('Supabase connection error:', e);
        }
    },

    async migrateFromLocalStorage() {
        const lsKeys = {
            transactions: 'media112_transactions',
            products: 'media112_products',
            expenses: 'media112_expenses',
            cashflow: 'media112_cashflow'
        };

        let hasData = false;
        for (const key of Object.values(lsKeys)) {
            const data = localStorage.getItem(key);
            if (data && JSON.parse(data).length > 0) {
                hasData = true;
                break;
            }
        }

        if (!hasData) return false;

        try {
            // Migrate cities (products)
            const lsProducts = JSON.parse(localStorage.getItem(lsKeys.products) || '[]');
            for (const city of lsProducts) {
                const { products: cityProducts, ...cityData } = city;
                await db.from('cities').insert({
                    id: cityData.id,
                    name: cityData.name,
                    initial: cityData.initial,
                    number_form: cityData.numberForm || null,
                    created_at: cityData.createdAt || new Date().toISOString()
                });

                if (cityProducts && cityProducts.length > 0) {
                    const productRows = cityProducts.map(p => ({
                        id: p.id,
                        city_id: cityData.id,
                        name: p.name,
                        size: p.size,
                        default_price: p.defaultPrice || 0,
                        created_at: new Date().toISOString()
                    }));
                    await db.from('products').insert(productRows);
                }
            }

            // Migrate transactions
            const lsTransactions = JSON.parse(localStorage.getItem(lsKeys.transactions) || '[]');
            if (lsTransactions.length > 0) {
                const txRows = lsTransactions.map(t => ({
                    id: t.id,
                    city_id: t.cityId || null,
                    city_name: t.cityName || null,
                    product_id: t.productId || null,
                    product_name: t.productName || null,
                    product_initial: t.productInitial || null,
                    number_form: t.numberForm || null,
                    size: t.size || null,
                    ply: t.ply || 4,
                    price_per_title: t.pricePerTitle || 0,
                    quantity: t.quantity || 1,
                    total_price: t.totalPrice || 0,
                    material_cost: t.materialCost || 0,
                    payment_status: t.paymentStatus || 'belum',
                    date: t.date || null,
                    note: t.note || null,
                    created_at: t.createdAt || new Date().toISOString(),
                    updated_at: t.updatedAt || new Date().toISOString()
                }));
                await db.from('transactions').insert(txRows);
            }

            // Migrate expenses
            const lsExpenses = JSON.parse(localStorage.getItem(lsKeys.expenses) || '[]');
            if (lsExpenses.length > 0) {
                const expRows = lsExpenses.map(e => ({
                    id: e.id,
                    name: e.name,
                    quantity: e.quantity || 1,
                    unit_price: e.unitPrice || 0,
                    total_cost: e.totalCost || 0,
                    payment_status: e.paymentStatus || 'lunas',
                    titip_amount: e.titipAmount || 0,
                    remaining_amount: e.remainingAmount || 0,
                    linked_transaction_id: e.linkedTransactionId || null,
                    date: e.date || null,
                    note: e.note || null,
                    created_at: e.createdAt || new Date().toISOString(),
                    updated_at: e.updatedAt || new Date().toISOString()
                }));
                await db.from('expenses').insert(expRows);
            }

            // Migrate cashflow
            const lsCashflow = JSON.parse(localStorage.getItem(lsKeys.cashflow) || '[]');
            if (lsCashflow.length > 0) {
                const cfRows = lsCashflow.map(c => ({
                    id: c.id,
                    type: c.type,
                    amount: c.amount || 0,
                    description: c.description || null,
                    category: c.category || 'operasional',
                    date: c.date || null,
                    created_at: c.createdAt || new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }));
                await db.from('cashflow').insert(cfRows);
            }

            // Clear localStorage after successful migration
            Object.values(lsKeys).forEach(key => localStorage.removeItem(key));
            return true;
        } catch (e) {
            console.error('Migration error:', e);
            return false;
        }
    },

    // =====================
    // CITIES (Kota)
    // =====================

    async getCities() {
        const { data: cities, error: cityErr } = await db.from('cities').select('*').order('created_at', { ascending: false });
        if (cityErr) throw cityErr;

        const { data: products, error: prodErr } = await db.from('products').select('*');
        if (prodErr) throw prodErr;

        return cities.map(city => ({
            id: city.id,
            name: city.name,
            initial: city.initial,
            numberForm: city.number_form,
            products: (products || [])
                .filter(p => p.city_id === city.id)
                .map(p => ({
                    id: p.id,
                    name: p.name,
                    size: p.size,
                    defaultPrice: p.default_price
                })),
            createdAt: city.created_at
        }));
    },

    async getCity(id) {
        const { data: city, error } = await db.from('cities').select('*').eq('id', id).single();
        if (error) throw error;
        if (!city) return null;

        const { data: products } = await db.from('products').select('*').eq('city_id', id);

        return {
            id: city.id,
            name: city.name,
            initial: city.initial,
            numberForm: city.number_form,
            products: (products || []).map(p => ({
                id: p.id,
                name: p.name,
                size: p.size,
                defaultPrice: p.default_price
            })),
            createdAt: city.created_at
        };
    },

    async addCity(data) {
        const cityId = this._validateId(data.id || this.generateId());
        const name = this._validateString(data.name, 'Nama kota', 100);
        const initial = this._validateString(data.initial, 'Inisial', 10);
        if (!name || !initial) throw new Error('Nama kota dan inisial wajib diisi');
        const { error: cityErr } = await db.from('cities').insert({
            id: cityId,
            name: name,
            initial: initial,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        if (cityErr) throw cityErr;

        return { id: cityId };
    },

    async updateCity(id, data) {
        this._validateId(id);
        const { error: cityErr } = await db.from('cities').update({
            name: this._validateString(data.name, 'Nama Kota', 100),
            initial: this._validateString(data.initial, 'Inisial', 10),
            updated_at: new Date().toISOString()
        }).eq('id', id);
        if (cityErr) throw cityErr;
    },

    async deleteCity(id) {
        this._validateId(id);
        // Products cascade delete via FK
        const { error } = await db.from('cities').delete().eq('id', id);
        if (error) throw error;
    },

    // Alias for backward compatibility
    async getProducts() { return this.getCities(); },
    async getProduct(id) { return this.getCity(id); },
    async addProduct(data) { return this.addCity(data); },
    async updateProduct(id, data) { return this.updateCity(id, data); },
    async deleteProduct(id) { return this.deleteCity(id); },

    async getCityProducts(cityId) {
        const city = await this.getCity(cityId);
        return city ? city.products : [];
    },

    getDefaultProducts() {
        const now = new Date().toISOString();
        return [
            {
                id: this.generateId(), name: 'JAKARTA', initial: 'JKT', numberForm: '',
                products: [
                    { id: this.generateId(), name: 'DATA TIMBANG', size: '1/2', defaultPrice: 0 },
                    { id: this.generateId(), name: 'BPS OVK', size: '1/2', defaultPrice: 0 },
                    { id: this.generateId(), name: 'BPS PAKAN', size: '1/4', defaultPrice: 0 },
                    { id: this.generateId(), name: 'BPS DOC', size: '1/4', defaultPrice: 0 },
                    { id: this.generateId(), name: 'BPS MUTASI PAKAN', size: '1/4', defaultPrice: 0 }
                ],
                createdAt: now
            },
            {
                id: this.generateId(), name: 'SURABAYA', initial: 'SBY', numberForm: '',
                products: [
                    { id: this.generateId(), name: 'DATA TIMBANG', size: '1/2', defaultPrice: 0 },
                    { id: this.generateId(), name: 'BPS OVK', size: '1/2', defaultPrice: 0 },
                    { id: this.generateId(), name: 'BPS PAKAN', size: '1/4', defaultPrice: 0 },
                    { id: this.generateId(), name: 'BPS DOC', size: '1/4', defaultPrice: 0 },
                    { id: this.generateId(), name: 'BPS MUTASI PAKAN', size: '1/4', defaultPrice: 0 }
                ],
                createdAt: now
            },
            {
                id: this.generateId(), name: 'BANDUNG', initial: 'BDG', numberForm: '',
                products: [
                    { id: this.generateId(), name: 'DATA TIMBANG', size: '1/2', defaultPrice: 0 },
                    { id: this.generateId(), name: 'BPS OVK', size: '1/2', defaultPrice: 0 },
                    { id: this.generateId(), name: 'BPS PAKAN', size: '1/4', defaultPrice: 0 },
                    { id: this.generateId(), name: 'BPS DOC', size: '1/4', defaultPrice: 0 },
                    { id: this.generateId(), name: 'BPS MUTASI PAKAN', size: '1/4', defaultPrice: 0 }
                ],
                createdAt: now
            }
        ];
    },

    // =====================
    // TRANSACTIONS
    // =====================

    async getTransactions() {
        const { data, error } = await db.from('transactions').select('*').order('date', { ascending: false });
        if (error) throw error;
        return (data || []).map(t => ({
            id: t.id,
            cityId: t.city_id,
            cityName: t.city_name,
            productId: t.product_id,
            productName: t.product_name,
            productInitial: t.product_initial,
            numberForm: t.number_form,
            size: t.size,
            ply: t.ply,
            pricePerTitle: t.price_per_title,
            quantity: t.quantity,
            totalPrice: t.total_price,
            materialCost: t.material_cost,
            paymentStatus: t.payment_status,
            date: t.date,
            note: t.note,
            createdAt: t.created_at,
            updatedAt: t.updated_at
        }));
    },

    async getTransaction(id) {
        const { data, error } = await db.from('transactions').select('*').eq('id', id).single();
        if (error) throw error;
        if (!data) return null;
        return {
            id: data.id,
            cityId: data.city_id,
            cityName: data.city_name,
            productId: data.product_id,
            productName: data.product_name,
            productInitial: data.product_initial,
            numberForm: data.number_form,
            size: data.size,
            ply: data.ply,
            pricePerTitle: data.price_per_title,
            quantity: data.quantity,
            totalPrice: data.total_price,
            materialCost: data.material_cost,
            paymentStatus: data.payment_status,
            date: data.date,
            note: data.note,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        };
    },

    async addTransaction(data) {
        const id = this.generateId();
        const qty = this._validateNumber(data.quantity, 'Jumlah', 1, 99999);
        const price = this._validateNumber(data.pricePerTitle, 'Harga', 0, 999999999);
        const { error } = await db.from('transactions').insert({
            id,
            city_id: data.cityId || null,
            city_name: this._validateString(data.cityName, 'Nama kota', 100),
            product_id: data.productId || null,
            product_name: this._validateString(data.productName, 'Nama produk', 100),
            product_initial: this._validateString(data.productInitial, 'Inisial', 10),
            number_form: this._validateString(data.numberForm, 'Nomor form', 20),
            size: this._validateString(data.size, 'Ukuran', 10),
            ply: this._validateNumber(data.ply, 'Ply', 1, 10),
            price_per_title: price,
            quantity: qty,
            total_price: this._validateNumber(data.totalPrice, 'Total harga', 0, 99999999999),
            material_cost: data.materialCost || 0,
            payment_status: data.paymentStatus || 'belum',
            date: data.date || null,
            note: data.note || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        if (error) throw error;
        return { id };
    },

    async updateTransaction(id, data) {
        this._validateId(id);
        const validStatus = ['lunas', 'belum'];
        const { error } = await db.from('transactions').update({
            city_id: this._validateString(data.cityId, 'Kota ID', 50),
            city_name: this._validateString(data.cityName, 'Nama Kota', 100),
            product_id: this._validateString(data.productId, 'Produk ID', 50),
            product_name: this._validateString(data.productName, 'Nama Produk', 100),
            product_initial: this._validateString(data.productInitial, 'Inisial', 10),
            number_form: this._validateString(data.numberForm, 'Nomor Form', 20),
            size: this._validateString(data.size, 'Ukuran', 10),
            ply: this._validateNumber(data.ply, 'Ply', 1, 10),
            price_per_title: this._validateNumber(data.pricePerTitle, 'Harga', 0, 999999999),
            quantity: this._validateNumber(data.quantity, 'Jumlah', 1, 99999),
            total_price: this._validateNumber(data.totalPrice, 'Total', 0, 99999999999),
            material_cost: this._validateNumber(data.materialCost || 0, 'Biaya Bahan', 0, 999999999),
            payment_status: validStatus.includes(data.paymentStatus) ? data.paymentStatus : 'belum',
            date: data.date || null,
            note: this._validateString(data.note, 'Catatan', 500),
            updated_at: new Date().toISOString()
        }).eq('id', id);
        if (error) throw error;
    },

    async deleteTransaction(id) {
        this._validateId(id);
        const { error } = await db.from('transactions').delete().eq('id', id);
        if (error) throw error;
    },

    async filterTransactions({ search = '', status = '', startDate = '', endDate = '' } = {}) {
        let query = db.from('transactions').select('*');

        if (startDate) query = query.gte('date', startDate);
        if (endDate) query = query.lte('date', endDate);
        if (status) query = query.eq('payment_status', status);

        query = query.order('date', { ascending: false });
        const { data, error } = await query;
        if (error) throw error;

        let results = (data || []).map(t => ({
            id: t.id,
            cityId: t.city_id,
            cityName: t.city_name,
            productId: t.product_id,
            productName: t.product_name,
            productInitial: t.product_initial,
            numberForm: t.number_form,
            size: t.size,
            ply: t.ply,
            pricePerTitle: t.price_per_title,
            quantity: t.quantity,
            totalPrice: t.total_price,
            materialCost: t.material_cost,
            paymentStatus: t.payment_status,
            date: t.date,
            note: t.note,
            createdAt: t.created_at,
            updatedAt: t.updated_at
        }));

        if (search) {
            const q = search.toLowerCase();
            results = results.filter(t =>
                (t.productName && t.productName.toLowerCase().includes(q)) ||
                (t.productInitial && t.productInitial.toLowerCase().includes(q)) ||
                (t.note && t.note.toLowerCase().includes(q))
            );
        }

        return results;
    },

    async getRecentTransactions(limit = 5) {
        const { data, error } = await db.from('transactions').select('*').order('date', { ascending: false }).limit(limit);
        if (error) throw error;
        return (data || []).map(t => ({
            id: t.id,
            cityId: t.city_id,
            cityName: t.city_name,
            productId: t.product_id,
            productName: t.product_name,
            productInitial: t.product_initial,
            numberForm: t.number_form,
            size: t.size,
            ply: t.ply,
            pricePerTitle: t.price_per_title,
            quantity: t.quantity,
            totalPrice: t.total_price,
            materialCost: t.material_cost,
            paymentStatus: t.payment_status,
            date: t.date,
            note: t.note,
            createdAt: t.created_at,
            updatedAt: t.updated_at
        }));
    },

    // =====================
    // EXPENSES (Belanja Bahan)
    // =====================

    async getExpenses() {
        const { data, error } = await db.from('expenses').select('*').order('date', { ascending: false });
        if (error) throw error;
        return (data || []).map(e => ({
            id: e.id,
            name: e.name,
            quantity: e.quantity,
            unitPrice: e.unit_price,
            totalCost: e.total_cost,
            paymentStatus: e.payment_status,
            titipAmount: e.titip_amount,
            remainingAmount: e.remaining_amount,
            linkedTransactionId: e.linked_transaction_id,
            date: e.date,
            note: e.note,
            createdAt: e.created_at,
            updatedAt: e.updated_at
        }));
    },

    async getExpense(id) {
        const { data, error } = await db.from('expenses').select('*').eq('id', id).single();
        if (error) throw error;
        if (!data) return null;
        return {
            id: data.id,
            name: data.name,
            quantity: data.quantity,
            unitPrice: data.unit_price,
            totalCost: data.total_cost,
            paymentStatus: data.payment_status,
            titipAmount: data.titip_amount,
            remainingAmount: data.remaining_amount,
            linkedTransactionId: data.linked_transaction_id,
            date: data.date,
            note: data.note,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        };
    },

    async addExpense(data) {
        const id = this.generateId();
        const name = this._validateString(data.name, 'Nama bahan', 200);
        if (!name) throw new Error('Nama bahan wajib diisi');
        const qty = this._validateNumber(data.quantity, 'Jumlah', 1, 99999);
        const unitPrice = this._validateNumber(data.unitPrice, 'Harga satuan', 0, 999999999);
        const { error } = await db.from('expenses').insert({
            id,
            name: name,
            quantity: qty,
            unit_price: unitPrice,
            total_cost: this._validateNumber(data.totalCost, 'Total biaya', 0, 99999999999),
            payment_status: data.paymentStatus || 'lunas',
            titip_amount: data.titipAmount || 0,
            remaining_amount: data.remainingAmount || 0,
            linked_transaction_id: data.linkedTransactionId || null,
            date: data.date || null,
            note: data.note || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        if (error) throw error;
        return { id };
    },

    async updateExpense(id, data) {
        this._validateId(id);
        const validStatus = ['lunas', 'belum', 'titip'];
        const { error } = await db.from('expenses').update({
            name: this._validateString(data.name, 'Nama Bahan', 200),
            quantity: this._validateNumber(data.quantity, 'Jumlah', 1, 99999),
            unit_price: this._validateNumber(data.unitPrice, 'Harga Satuan', 0, 999999999),
            total_cost: this._validateNumber(data.totalCost, 'Total Biaya', 0, 99999999999),
            payment_status: validStatus.includes(data.paymentStatus) ? data.paymentStatus : 'lunas',
            titip_amount: this._validateNumber(data.titipAmount || 0, 'Titip Dana', 0, 999999999),
            remaining_amount: this._validateNumber(data.remainingAmount || 0, 'Sisa Bayar', 0, 999999999),
            linked_transaction_id: this._validateString(data.linkedTransactionId, 'Link Transaksi', 50),
            date: data.date || null,
            note: this._validateString(data.note, 'Catatan', 500),
            updated_at: new Date().toISOString()
        }).eq('id', id);
        if (error) throw error;
    },

    async deleteExpense(id) {
        this._validateId(id);
        const { error } = await db.from('expenses').delete().eq('id', id);
        if (error) throw error;
    },

    async filterExpenses({ search = '', status = '', startDate = '', endDate = '' } = {}) {
        let query = db.from('expenses').select('*');

        if (startDate) query = query.gte('date', startDate);
        if (endDate) query = query.lte('date', endDate);
        if (status) query = query.eq('payment_status', status);

        query = query.order('date', { ascending: false });
        const { data, error } = await query;
        if (error) throw error;

        let results = (data || []).map(e => ({
            id: e.id,
            name: e.name,
            quantity: e.quantity,
            unitPrice: e.unit_price,
            totalCost: e.total_cost,
            paymentStatus: e.payment_status,
            titipAmount: e.titip_amount,
            remainingAmount: e.remaining_amount,
            linkedTransactionId: e.linked_transaction_id,
            date: e.date,
            note: e.note,
            createdAt: e.created_at,
            updatedAt: e.updated_at
        }));

        if (search) {
            const q = search.toLowerCase();
            results = results.filter(e =>
                (e.name && e.name.toLowerCase().includes(q)) ||
                (e.note && e.note.toLowerCase().includes(q))
            );
        }

        return results;
    },

    async getRecentExpenses(limit = 5) {
        const { data, error } = await db.from('expenses').select('*').order('date', { ascending: false }).limit(limit);
        if (error) throw error;
        return (data || []).map(e => ({
            id: e.id,
            name: e.name,
            quantity: e.quantity,
            unitPrice: e.unit_price,
            totalCost: e.total_cost,
            paymentStatus: e.payment_status,
            titipAmount: e.titip_amount,
            remainingAmount: e.remaining_amount,
            linkedTransactionId: e.linked_transaction_id,
            date: e.date,
            note: e.note,
            createdAt: e.created_at,
            updatedAt: e.updated_at
        }));
    },

    async getTotalExpenseAmount() {
        const expenses = await this.getExpenses();
        return expenses.reduce((sum, e) => sum + (e.totalCost || 0), 0);
    },

    async getPaidExpenseAmount() {
        const expenses = await this.getExpenses();
        return expenses.filter(e => e.paymentStatus === 'lunas').reduce((sum, e) => sum + (e.totalCost || 0), 0);
    },

    async getUnpaidExpenseAmount() {
        const expenses = await this.getExpenses();
        return expenses.filter(e => e.paymentStatus === 'belum').reduce((sum, e) => sum + (e.totalCost || 0), 0);
    },

    async getTitipDanaAmount() {
        const expenses = await this.getExpenses();
        return expenses.filter(e => e.paymentStatus === 'titip').reduce((sum, e) => sum + (e.titipAmount || 0), 0);
    },

    async getTitipDanaRemaining() {
        const expenses = await this.getExpenses();
        return expenses.filter(e => e.paymentStatus === 'titip').reduce((sum, e) => sum + (e.remainingAmount || 0), 0);
    },

    // Single-query expense summary (replaces 4 separate fetches)
    async getExpenseSummary() {
        const expenses = await this.getExpenses();
        let totalAll = 0, totalPaid = 0, totalUnpaid = 0, totalTitip = 0;
        for (const e of expenses) {
            const cost = e.totalCost || 0;
            totalAll += cost;
            if (e.paymentStatus === 'lunas') totalPaid += cost;
            else if (e.paymentStatus === 'belum') totalUnpaid += cost;
            else if (e.paymentStatus === 'titip') totalTitip += (e.titipAmount || 0);
        }
        return { totalAll, totalPaid, totalUnpaid, totalTitip };
    },

    // =====================
    // CASHFLOW (Kas)
    // =====================

    async getCashflow() {
        const { data, error } = await db.from('cashflow').select('*').order('date', { ascending: false });
        if (error) throw error;
        return (data || []).map(c => ({
            id: c.id,
            type: c.type,
            amount: c.amount,
            description: c.description,
            category: c.category,
            date: c.date,
            createdAt: c.created_at,
            updatedAt: c.updated_at
        }));
    },

    async getCashflowItem(id) {
        const { data, error } = await db.from('cashflow').select('*').eq('id', id).single();
        if (error) throw error;
        if (!data) return null;
        return {
            id: data.id,
            type: data.type,
            amount: data.amount,
            description: data.description,
            category: data.category,
            date: data.date,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        };
    },

    async addCashflow(data) {
        const id = this.generateId();
        const amt = this._validateNumber(data.amount, 'Nominal', 1, 99999999999);
        const desc = this._validateString(data.description, 'Keterangan', 500);
        const validTypes = ['in', 'out', 'adjust'];
        const type = validTypes.includes(data.type) ? data.type : 'in';
        const { error } = await db.from('cashflow').insert({
            id,
            type: type,
            amount: amt,
            description: desc,
            category: this._validateString(data.category, 'Kategori', 50) || 'operasional',
            date: data.date || null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        if (error) throw error;
        return { id };
    },

    async updateCashflow(id, data) {
        this._validateId(id);
        const validTypes = ['in', 'out', 'adjust'];
        const { error } = await db.from('cashflow').update({
            type: validTypes.includes(data.type) ? data.type : 'in',
            amount: this._validateNumber(data.amount, 'Nominal', 0, 99999999999),
            description: this._validateString(data.description, 'Keterangan', 500),
            category: this._validateString(data.category, 'Kategori', 50) || 'operasional',
            date: data.date,
            updated_at: new Date().toISOString()
        }).eq('id', id);
        if (error) throw error;
    },

    async deleteCashflow(id) {
        this._validateId(id);
        const { error } = await db.from('cashflow').delete().eq('id', id);
        if (error) throw error;
    },

    async filterCashflow({ search = '', type = '', startDate = '', endDate = '' } = {}) {
        let query = db.from('cashflow').select('*');

        if (startDate) query = query.gte('date', startDate);
        if (endDate) query = query.lte('date', endDate);
        if (type) query = query.eq('type', type);

        query = query.order('date', { ascending: false });
        const { data, error } = await query;
        if (error) throw error;

        let results = (data || []).map(c => ({
            id: c.id,
            type: c.type,
            amount: c.amount,
            description: c.description,
            category: c.category,
            date: c.date,
            createdAt: c.created_at,
            updatedAt: c.updated_at
        }));

        if (search) {
            const q = search.toLowerCase();
            results = results.filter(c => c.description && c.description.toLowerCase().includes(q));
        }

        return results;
    },

    async getCurrentBalance() {
        const { data, error } = await db.from('cashflow').select('*').order('date', { ascending: true });
        if (error) throw error;
        return (data || []).reduce((balance, item) => {
            if (item.type === 'in') return balance + (item.amount || 0);
            if (item.type === 'out') return balance - (item.amount || 0);
            if (item.type === 'adjust') return item.amount || 0;
            return balance;
        }, 0);
    },

    async getTotalCashIn() {
        const items = await this.getCashflow();
        return items.filter(c => c.type === 'in').reduce((sum, c) => sum + (c.amount || 0), 0);
    },

    async getTotalCashOut() {
        const items = await this.getCashflow();
        return items.filter(c => c.type === 'out').reduce((sum, c) => sum + (c.amount || 0), 0);
    },

    async getNetCashflow() {
        const totalIn = await this.getTotalCashIn();
        const totalOut = await this.getTotalCashOut();
        return totalIn - totalOut;
    },

    async recordTransactionPayment(transaction) {
        if (transaction.paymentStatus === 'lunas' && transaction.totalPrice > 0) {
            await this.addCashflow({
                type: 'in',
                amount: transaction.totalPrice,
                description: `Pembayaran: ${transaction.productName} (${transaction.productInitial})`,
                category: 'operasional',
                date: transaction.date
            });
        }
    },

    async recordExpensePayment(expense) {
        if (expense.paymentStatus === 'lunas' && expense.totalCost > 0) {
            await this.addCashflow({
                type: 'out',
                amount: expense.totalCost,
                description: `Bayar bahan: ${expense.name}`,
                category: 'operasional',
                date: expense.date
            });
        }
    },

    // =====================
    // STATISTICS
    // =====================

    async getStats() {
        const transactions = await this.getTransactions();
        const expenses = await this.getExpenses();
        const today = new Date().toISOString().split('T')[0];
        const thisMonth = today.substring(0, 7);

        const totalIncome = transactions.reduce((sum, t) => sum + (t.totalPrice || 0), 0);
        const totalMaterialFromTx = transactions.reduce((sum, t) => sum + (t.materialCost || 0), 0);
        // Belanja bahan: hanya lunas + nominal titip yang dihitung sebagai pengeluaran
        const totalExpenseFromExpenses = expenses.reduce((sum, e) => {
            if (e.paymentStatus === 'lunas') return sum + (e.totalCost || 0);
            if (e.paymentStatus === 'titip') return sum + (e.titipAmount || 0);
            return sum; // belum bayar = tidak dihitung
        }, 0);
        const totalExpense = totalMaterialFromTx + totalExpenseFromExpenses;
        const profit = totalIncome - totalExpense;

        const paid = transactions.filter(t => t.paymentStatus === 'lunas').length;
        const unpaid = transactions.filter(t => t.paymentStatus === 'belum').length;

        const expensesPaid = expenses.filter(e => e.paymentStatus === 'lunas').length;
        const expensesUnpaid = expenses.filter(e => e.paymentStatus === 'belum').length;
        const expensesTitip = expenses.filter(e => e.paymentStatus === 'titip').length;
        const titipDanaAmount = expenses.filter(e => e.paymentStatus === 'titip')
            .reduce((sum, e) => sum + (e.titipAmount || 0), 0);
        const titipDanaRemaining = expenses.filter(e => e.paymentStatus === 'titip')
            .reduce((sum, e) => sum + (e.remainingAmount || 0), 0);

        const monthlyTransactions = transactions.filter(t => t.date && t.date.startsWith(thisMonth));
        const monthlyIncome = monthlyTransactions.reduce((sum, t) => sum + (t.totalPrice || 0), 0);
        const monthlyExpenseTx = monthlyTransactions.reduce((sum, t) => sum + (t.materialCost || 0), 0);
        const monthlyExpenses = expenses.filter(e => e.date && e.date.startsWith(thisMonth));
        const monthlyExpenseBahan = monthlyExpenses.reduce((sum, e) => {
            if (e.paymentStatus === 'lunas') return sum + (e.totalCost || 0);
            if (e.paymentStatus === 'titip') return sum + (e.titipAmount || 0);
            return sum;
        }, 0);
        const monthlyExpense = monthlyExpenseTx + monthlyExpenseBahan;

        return {
            totalIncome, totalExpense, totalMaterialFromTx, totalExpenseFromExpenses,
            profit, totalTransactions: transactions.length, paid, unpaid,
            paymentProgress: transactions.length > 0 ? (paid / transactions.length * 100) : 0,
            totalExpenses: expenses.length, expensesPaid, expensesUnpaid, expensesTitip,
            titipDanaAmount, titipDanaRemaining,
            expensesProgress: expenses.length > 0 ? (expensesPaid / expenses.length * 100) : 0,
            monthlyIncome, monthlyExpense
        };
    },

    // =====================
    // REPORTS
    // =====================

    getProfitMargin(transactions, expenses) {
        const totalIncome = transactions.reduce((sum, t) => sum + (t.totalPrice || 0), 0);
        const txExpense = transactions.reduce((sum, t) => sum + (t.materialCost || 0), 0);
        // Belanja bahan: hanya lunas + nominal titip
        const bahanExpense = expenses.reduce((sum, e) => {
            if (e.paymentStatus === 'lunas') return sum + (e.totalCost || 0);
            if (e.paymentStatus === 'titip') return sum + (e.titipAmount || 0);
            return sum;
        }, 0);
        const totalExpense = txExpense + bahanExpense;
        const profit = totalIncome - totalExpense;
        if (totalIncome === 0) return 0;
        return Math.round((profit / totalIncome) * 10000) / 100;
    },

    getMaterialEfficiency(transactions, expenses) {
        const totalIncome = transactions.reduce((sum, t) => sum + (t.totalPrice || 0), 0);
        const txExpense = transactions.reduce((sum, t) => sum + (t.materialCost || 0), 0);
        // Belanja bahan: hanya lunas + nominal titip
        const bahanExpense = expenses.reduce((sum, e) => {
            if (e.paymentStatus === 'lunas') return sum + (e.totalCost || 0);
            if (e.paymentStatus === 'titip') return sum + (e.titipAmount || 0);
            return sum;
        }, 0);
        const totalExpense = txExpense + bahanExpense;
        if (totalIncome === 0) return 0;
        return Math.round((totalExpense / totalIncome) * 10000) / 100;
    },

    getTopProducts(transactions) {
        const productMap = {};
        transactions.forEach(t => {
            const key = t.productName;
            if (!productMap[key]) {
                productMap[key] = { name: key, initial: t.productInitial, totalRevenue: 0, totalCost: 0, totalProfit: 0, count: 0 };
            }
            const revenue = t.totalPrice || 0;
            const cost = t.materialCost || 0;
            productMap[key].totalRevenue += revenue;
            productMap[key].totalCost += cost;
            productMap[key].totalProfit += revenue - cost;
            productMap[key].count += t.quantity || 1;
        });
        const products = Object.values(productMap);
        products.sort((a, b) => b.totalProfit - a.totalProfit);
        return products.map((p, i) => ({
            ...p, rank: i + 1,
            avgProfitPerTx: p.count > 0 ? Math.round(p.totalProfit / p.count) : 0
        }));
    },

    getMonthlyTrend() {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const previousMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
        return { currentMonth, previousMonth };
    },

    getProfitProjection(transactions) {
        const monthlyData = {};
        transactions.forEach(t => {
            if (!t.date) return;
            const month = t.date.substring(0, 7);
            if (!monthlyData[month]) monthlyData[month] = { income: 0, expense: 0 };
            monthlyData[month].income += t.totalPrice || 0;
            monthlyData[month].expense += t.materialCost || 0;
        });
        const months = Object.keys(monthlyData).sort();
        if (months.length === 0) return { averageMonthlyProfit: 0, nextMonthEstimate: 0, dataPoints: 0, monthlyBreakdown: [] };
        const profits = months.map(m => monthlyData[m].income - monthlyData[m].expense);
        const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
        let weightedSum = 0, weightTotal = 0;
        profits.forEach((p, i) => { const w = i + 1; weightedSum += p * w; weightTotal += w; });
        const weightedAvg = weightTotal > 0 ? weightedSum / weightTotal : avgProfit;
        return {
            averageMonthlyProfit: Math.round(avgProfit),
            nextMonthEstimate: Math.round(weightedAvg),
            dataPoints: months.length,
            monthlyBreakdown: months.map((m, i) => ({ month: m, profit: profits[i] }))
        };
    },

    async generateAdvancedReport(startDate, endDate) {
        const allTransactions = await this.getTransactions();
        const allExpenses = await this.getExpenses();

        // Filter by date range for report period
        let transactions = allTransactions;
        let expenses = allExpenses;
        if (startDate) {
            transactions = transactions.filter(t => t.date >= startDate);
            expenses = expenses.filter(e => e.date >= startDate);
        }
        if (endDate) {
            transactions = transactions.filter(t => t.date <= endDate);
            expenses = expenses.filter(e => e.date <= endDate);
        }

        const totalIncome = transactions.reduce((sum, t) => sum + (t.totalPrice || 0), 0);
        const txExpense = transactions.reduce((sum, t) => sum + (t.materialCost || 0), 0);
        // Belanja bahan: hanya lunas + nominal titip yang dihitung sebagai pengeluaran
        // Belum bayar = hutang, bukan pengeluaran
        const bahanExpense = expenses.reduce((sum, e) => {
            if (e.paymentStatus === 'lunas') return sum + (e.totalCost || 0);
            if (e.paymentStatus === 'titip') return sum + (e.titipAmount || 0);
            return sum; // belum bayar = tidak dihitung
        }, 0);
        const totalExpense = txExpense + bahanExpense;
        const profit = totalIncome - totalExpense;

        const paid = transactions.filter(t => t.paymentStatus === 'lunas');
        const unpaid = transactions.filter(t => t.paymentStatus === 'belum');
        const expensesPaid = expenses.filter(e => e.paymentStatus === 'lunas');
        const expensesUnpaid = expenses.filter(e => e.paymentStatus === 'belum');
        const expensesTitip = expenses.filter(e => e.paymentStatus === 'titip');

        const byProduct = {};
        transactions.forEach(t => {
            const key = t.productName;
            if (!byProduct[key]) byProduct[key] = { count: 0, total: 0, material: 0 };
            byProduct[key].count += t.quantity || 1;
            byProduct[key].total += t.totalPrice || 0;
            byProduct[key].material += t.materialCost || 0;
        });

        // Use allTransactions (unfiltered) for monthly trend and projection
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const prevDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const previousMonth = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;

        const getMonthData = (month) => {
            const tx = allTransactions.filter(t => t.date && t.date.startsWith(month));
            const exp = expenses.filter(e => e.date && e.date.startsWith(month));
            const income = tx.reduce((s, t) => s + (t.totalPrice || 0), 0);
            const txExp = tx.reduce((s, t) => s + (t.materialCost || 0), 0);
            // Belanja bahan: hanya lunas + nominal titip
            const bahanExp = exp.reduce((s, e) => {
                if (e.paymentStatus === 'lunas') return s + (e.totalCost || 0);
                if (e.paymentStatus === 'titip') return s + (e.titipAmount || 0);
                return s;
            }, 0);
            const expense = txExp + bahanExp;
            return { income, expense, profit: income - expense, txCount: tx.length, expCount: exp.length };
        };
        const current = getMonthData(currentMonth);
        const previous = getMonthData(previousMonth);
        let changePercent = 0;
        if (previous.profit !== 0) changePercent = Math.round(((current.profit - previous.profit) / Math.abs(previous.profit)) * 10000) / 100;

        return {
            transactions, expenses, totalIncome, totalExpense, txExpense, bahanExpense, profit,
            byProduct, paid, unpaid, expensesPaid, expensesUnpaid, expensesTitip,
            paidAmount: paid.reduce((s, t) => s + (t.totalPrice || 0), 0),
            unpaidAmount: unpaid.reduce((s, t) => s + (t.totalPrice || 0), 0),
            expensesPaidAmount: expensesPaid.reduce((s, e) => s + (e.totalCost || 0), 0),
            expensesUnpaidAmount: expensesUnpaid.reduce((s, e) => s + (e.totalCost || 0), 0),
            expensesTitipAmount: expensesTitip.reduce((s, e) => s + (e.titipAmount || 0), 0),
            expensesTitipRemaining: expensesTitip.reduce((s, e) => s + (e.remainingAmount || 0), 0),
            profitMargin: this.getProfitMargin(transactions, expenses),
            materialEfficiency: this.getMaterialEfficiency(transactions, expenses),
            topProducts: this.getTopProducts(transactions),
            monthlyTrend: { currentMonth: current, previousMonth: previous, changePercent },
            profitProjection: this.getProfitProjection(allTransactions),
            dateRange: { start: startDate || 'Awal', end: endDate || 'Sekarang' }
        };
    }
};
