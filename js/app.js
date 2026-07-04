/**
 * media.112 - Main Application (Async Supabase + Anime.js)
 */

// HTML escape utility — prevents XSS in innerHTML injection
function esc(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

const App = {
    currentPage: 'dashboard',
    editingTransactionId: null,
    editingProductId: null,
    editingExpenseId: null,
    deleteCallback: null,
    currentUser: null,
    sessionTimeout: 1800000, // 1800 detik = 30 menit
    sessionTimer: null,

    // Initialize app
    async init() {
        try {
            this.initTheme();
            this.bindEvents();
            this.initSessionTimeout();
            this.initAutoLogout();

            // Listen for auth state changes (token refresh, logout from other tab)
            db.auth.onAuthStateChange((event, session) => {
                if (event === 'SIGNED_OUT') {
                    this.currentUser = null;
                    this.clearSessionTimeout();
                    this.showLogin();
                } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
                    if (session) {
                        this.currentUser = session.user;
                        this.resetSessionTimeout();
                    }
                }
            });

            // Check auth session
            const { data: { session } } = await db.auth.getSession();

            if (session) {
                this.currentUser = session.user;
                await DataStore.init();
                await this.loadDashboard();
                this.setTodayDate();
                this.showApp();
                this.resetSessionTimeout();
            } else {
                this.showLogin();
            }
        } catch (err) {
            console.error('App init error:', err);
            this.showLogin();
        }
    },

    // =====================
    // SESSION TIMEOUT & AUTO LOGOUT
    // =====================

    initSessionTimeout() {
        // Reset timer setiap ada aktivitas user
        ['click', 'keydown', 'mousemove', 'scroll', 'touchstart'].forEach(evt => {
            document.addEventListener(evt, () => {
                if (this.currentUser) this.resetSessionTimeout();
            }, { passive: true });
        });
    },

    resetSessionTimeout() {
        this.clearSessionTimeout();
        this.sessionTimer = setTimeout(() => {
            this.showToast('Sesi habis (30 menit tanpa aktivitas). Silakan login kembali.', 'warning');
            this.handleLogout();
        }, this.sessionTimeout);
    },

    clearSessionTimeout() {
        if (this.sessionTimer) {
            clearTimeout(this.sessionTimer);
            this.sessionTimer = null;
        }
    },

    initAutoLogout() {
        // Tandai tab sebagai aktif
        sessionStorage.setItem('media112_tab_active', '1');
        window.addEventListener('beforeunload', () => {
            sessionStorage.removeItem('media112_tab_active');
        });
        // Jika tidak ada tab aktif (browser ditutup), paksa logout di load berikutnya
        window.addEventListener('load', () => {
            if (!sessionStorage.getItem('media112_tab_active') && this.currentUser) {
                db.auth.signOut();
            }
        });
    },

    // =====================
    // AUTH
    // =====================

    showLogin() {
        document.getElementById('authContainer').style.display = 'flex';
        document.querySelector('.sidebar').style.display = 'none';
        document.querySelector('.main-content').style.display = 'none';
    },

    showApp() {
        document.getElementById('authContainer').style.display = 'none';
        document.querySelector('.sidebar').style.display = '';
        document.querySelector('.main-content').style.display = '';
    },

    async handleLogin(email, password) {
        const loginBtn = document.getElementById('loginBtn');
        const errorEl = document.getElementById('loginError');

        loginBtn.disabled = true;
        loginBtn.textContent = 'Masuk...';
        errorEl.style.display = 'none';

        try {
            const { data, error } = await db.auth.signInWithPassword({ email, password });

            if (error) throw error;

            this.currentUser = data.user;
            await DataStore.init();
            await this.loadDashboard();
            this.setTodayDate();
            this.showApp();
        } catch (err) {
            errorEl.textContent = err.message || 'Email atau password salah';
            errorEl.style.display = 'block';
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Masuk';
        }
    },

    async handleLogout() {
        this.clearSessionTimeout();
        await db.auth.signOut();
        this.currentUser = null;
        this.showLogin();
    },

    // =====================
    // THEME (Dark Mode)
    // =====================

    initTheme() {
        const saved = localStorage.getItem('media112_theme') || 'light';
        this.applyTheme(saved);
    },

    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const btn = document.getElementById('themeToggle');
        btn.textContent = theme === 'dark' ? '☀️' : '🌙';
        localStorage.setItem('media112_theme', theme);
    },

    toggleTheme() {
        const current = document.documentElement.getAttribute('data-theme');
        this.applyTheme(current === 'dark' ? 'light' : 'dark');
    },

    // Set today's date for transaction form
    setTodayDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('transactionDate').value = today;
    },

    // Bind all events
    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });

        // Links in cards
        document.querySelectorAll('.link[data-page]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateTo(link.dataset.page);
            });
        });

        // Sidebar toggle
        document.getElementById('menuToggle').addEventListener('click', () => this.toggleSidebar());
        document.getElementById('sidebarClose').addEventListener('click', () => this.closeSidebar());

        // Quick add button
        document.getElementById('quickAdd').addEventListener('click', () => this.openModal());

        // Theme toggle
        document.getElementById('themeToggle').addEventListener('click', () => this.toggleTheme());

        // Transaction form
        document.getElementById('transactionForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveTransaction();
        });

        // City select change
        document.getElementById('selectCity').addEventListener('change', (e) => this.onCityChange(e));

        // Product checklist: select all
        document.getElementById('selectAllProducts').addEventListener('change', (e) => {
            const checks = document.querySelectorAll('input[name="productCheck"]');
            checks.forEach(c => c.checked = e.target.checked);
            this.updateProductCheckState();
        });

        // Product checklist: individual items (delegated)
        document.getElementById('productChecklistItems').addEventListener('change', (e) => {
            if (e.target.name === 'productCheck') {
                this.updateProductCheckState();
            }
        });

        // Auto-calculate total price (delegated for per-product fields)
        document.getElementById('productChecklistItems').addEventListener('input', (e) => {
            if (e.target.classList.contains('prod-qty') || e.target.classList.contains('prod-price')) {
                this.calculateTotal();
            }
        });

        // City search
        document.getElementById('searchCity').addEventListener('input', () => this.filterCities());

        // Product form
        document.getElementById('productForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProduct();
        });

        // Expense form
        document.getElementById('expenseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveExpense();
        });

        // Expense auto-calculate total
        ['expenseQuantity', 'expenseUnitPrice'].forEach(id => {
            document.getElementById(id).addEventListener('input', () => this.calculateExpenseTotal());
        });

        // Expense search and filters
        document.getElementById('searchExpense').addEventListener('input', () => this.filterExpenses());
        document.getElementById('filterExpenseStatus').addEventListener('change', () => this.filterExpenses());
        document.getElementById('filterExpenseDate').addEventListener('change', () => this.filterExpenses());

        // Cashflow form
        document.getElementById('cashForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveCashflow();
        });

        // Cashflow search and filters
        document.getElementById('searchCashflow').addEventListener('input', () => this.filterCashflow());
        document.getElementById('filterCashType').addEventListener('change', () => this.filterCashflow());
        document.getElementById('filterCashDate').addEventListener('change', () => this.filterCashflow());

        // Titip Dana radio toggle
        document.querySelectorAll('input[name="expensePaymentStatus"]').forEach(radio => {
            radio.addEventListener('change', () => this.toggleTitipDanaField());
        });

        // Titip Dana amount calculation
        document.getElementById('expenseTitipAmount').addEventListener('input', () => this.calculateRemaining());

        // Search and filters
        document.getElementById('searchTransaction').addEventListener('input', () => this.filterTransactions());
        document.getElementById('filterStatus').addEventListener('change', () => this.filterTransactions());
        document.getElementById('filterDate').addEventListener('change', () => this.filterTransactions());

        // Delete confirmation
        document.getElementById('confirmDelete').addEventListener('click', () => this.confirmDelete());

        // Close modals on overlay click
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeModalById(overlay);
                }
            });
        });

        // Data-action delegation (replaces inline onclick handlers)
        document.addEventListener('click', (e) => {
            const el = e.target.closest('[data-action]');
            if (!el) return;
            const action = el.dataset.action;
            const id = el.dataset.id;
            switch (action) {
                case 'export': this.exportData(); break;
                case 'import-trigger': document.getElementById('importFile').click(); break;
                case 'open-modal': this.openModal(); break;
                case 'open-product-modal': this.openProductModal(); break;
                case 'open-expense-modal': this.openExpenseModal(); break;
                case 'cash-in': this.openCashModal('in'); break;
                case 'cash-out': this.openCashModal('out'); break;
                case 'cash-adjust': this.openCashModal('adjust'); break;
                case 'report-today': this.setReportToday(); break;
                case 'report-this-month': this.setReportThisMonth(); break;
                case 'report-last-month': this.setReportLastMonth(); break;
                case 'generate-report': this.generateReport(); break;
                case 'print-report': this.printReport(); break;
                case 'close-modal': this.closeModal(); break;
                case 'close-product-modal': this.closeProductModal(); break;
                case 'close-expense-modal': this.closeExpenseModal(); break;
                case 'close-cash-modal': this.closeCashModal(); break;
                case 'close-delete-modal': this.closeDeleteModal(); break;
                case 'logout': this.handleLogout(); break;
                case 'edit-transaction': this.editTransaction(id); break;
                case 'delete-transaction': this.deleteTransaction(id); break;
                case 'quick-pay-transaction': this.quickPayTransaction(id); break;
                case 'edit-product': this.editProduct(id); break;
                case 'delete-product': this.deleteProduct(id); break;
                case 'edit-expense': this.editExpense(id); break;
                case 'delete-expense': this.deleteExpense(id); break;
                case 'quick-pay-expense': this.quickPayExpense(id); break;
                case 'edit-cashflow': this.editCashflow(id); break;
                case 'delete-cashflow': this.deleteCashflow(id); break;
            }
        });

        // Login form submit
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            this.handleLogin(email, password);
        });

        // Import file change
        document.getElementById('importFile').addEventListener('change', (e) => this.importData(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });

        // Sidebar overlay for mobile
        let overlay = document.getElementById('sidebarOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'sidebar-overlay';
            overlay.id = 'sidebarOverlay';
            document.body.appendChild(overlay);
        }
        overlay.addEventListener('click', () => this.closeSidebar());
    },

    // =====================
    // NAVIGATION
    // =====================

    async navigateTo(page) {
        this.currentPage = page;

        // Update nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });

        // Update pages
        document.querySelectorAll('.page').forEach(p => {
            p.classList.remove('active');
        });
        const pageEl = document.getElementById(`page-${page}`);
        pageEl.classList.add('active');

        // Update page title
        const titles = {
            dashboard: 'Dashboard',
            transactions: 'Transaksi',
            products: 'Produk',
            expenses: 'Belanja Vendor',
            cashflow: 'Kas',
            reports: 'Laporan'
        };
        document.getElementById('pageTitle').textContent = titles[page] || page;

        // Load page data
        await this.loadPageData(page);

        // Animate page entrance
        Animations.pageTransition(pageEl);

        // Close sidebar on mobile
        this.closeSidebar();
    },

    async loadPageData(page) {
        switch (page) {
            case 'dashboard':
                await this.loadDashboard();
                break;
            case 'transactions':
                await this.loadTransactions();
                break;
            case 'products':
                await this.loadProducts();
                break;
            case 'expenses':
                await this.loadExpenses();
                break;
            case 'cashflow':
                await this.loadCashflow();
                break;
        }
    },

    // =====================
    // SIDEBAR
    // =====================

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        sidebar.classList.toggle('active');
        overlay.classList.toggle('active');
    },

    closeSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        sidebar.classList.remove('active');
        overlay.classList.remove('active');
    },

    // =====================
    // DASHBOARD
    // =====================

    async loadDashboard() {
        try {
            const [stats, balance] = await Promise.all([
                DataStore.getStats(),
                DataStore.getCurrentBalance()
            ]);

            document.getElementById('statPaid').textContent = stats.paid;
            document.getElementById('statUnpaid').textContent = stats.unpaid;

            const balanceEl = document.getElementById('statBalance');
            balanceEl.closest('.stat-card').classList.toggle('stat-negative', balance < 0);

            // Animate stat cards entrance + count-up (no static write — countUp handles it)
            Animations.statCardsEntrance();
            Animations.countUp(document.getElementById('statIncome'), stats.totalIncome);
            Animations.countUp(document.getElementById('statExpense'), stats.totalExpense);
            Animations.countUp(document.getElementById('statProfit'), stats.profit);
            Animations.countUpNumber(document.getElementById('statCount'), stats.totalTransactions);
            Animations.countUp(document.getElementById('statBalance'), balance);
            Animations.progressBar(document.getElementById('paymentProgress'), stats.paymentProgress);

            await this.loadRecentTransactions();
            await this.loadRecentExpenses();
        } catch (err) {
            console.error('loadDashboard error:', err);
        }
    },

    async loadRecentTransactions() {
        const container = document.getElementById('recentTransactions');
        const transactions = await DataStore.getRecentTransactions(5);

        if (transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📝</span>
                    <p>Belum ada transaksi</p>
                </div>
            `;
            return;
        }

        container.innerHTML = transactions.map(t => this.renderTransactionItem(t)).join('');
        Animations.listStagger(container);
    },

    async loadRecentExpenses() {
        const container = document.getElementById('recentExpenses');
        const expenses = await DataStore.getRecentExpenses(3);

        if (expenses.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">🧾</span>
                    <p>Belum ada belanja</p>
                </div>
            `;
            return;
        }

        container.innerHTML = expenses.map(e => this.renderExpenseItem(e, false)).join('');
        Animations.listStagger(container);
    },

    // =====================
    // TRANSACTIONS
    // =====================

    async loadTransactions() {
        await this.filterTransactions();
    },

    async filterTransactions() {
        try {
        const search = document.getElementById('searchTransaction').value;
        const status = document.getElementById('filterStatus').value;
        const date = document.getElementById('filterDate').value;

        let startDate = '';
        let endDate = '';

        if (date) {
            startDate = date + '-01';
            const [year, month] = date.split('-').map(Number);
            const d = new Date(year, month, 0);
            endDate = `${year}-${String(month).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        const transactions = await DataStore.filterTransactions({ search, status, startDate, endDate });
        this.renderTransactions(transactions);
        } catch (err) {
            console.error('filterTransactions error:', err);
        }
    },

    renderTransactions(transactions) {
        const container = document.getElementById('transactionsList');

        if (transactions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📝</span>
                    <p>Belum ada transaksi</p>
                    <button class="btn btn-primary" data-action="open-modal">+ Tambah Transaksi</button>
                </div>
            `;
            return;
        }

        container.innerHTML = transactions.map(t => this.renderTransactionItem(t, true)).join('');
        Animations.listStagger(container);
    },

    renderTransactionItem(t, showActions = false) {
        const statusClass = t.paymentStatus === 'lunas' ? 'status-lunas' : 'status-belum';
        const statusText = t.paymentStatus === 'lunas' ? 'Lunas' : 'Belum';
        const cityLabel = esc(t.cityName || '');
        const productLabel = esc(t.productName || '');
        const sizeLabel = t.size ? ` (${esc(t.size)})` : '';
        const numberLabel = t.numberForm ? ` | No: ${esc(t.numberForm)}` : '';

        return `
            <div class="transaction-item" data-id="${esc(t.id)}">
                <div class="transaction-icon">${esc(t.productInitial || '??')}</div>
                <div class="transaction-info">
                    <div class="transaction-name">${cityLabel} - ${productLabel}${sizeLabel}</div>
                    <div class="transaction-meta">
                        ${esc(t.ply)} Ply | Qty: ${esc(t.quantity || 1)}
                        ${numberLabel}
                        ${t.date ? ' | ' + DataStore.formatDate(t.date) : ''}
                    </div>
                </div>
                <div class="transaction-amount">
                    <div class="transaction-price">${DataStore.formatCurrency(t.totalPrice)}</div>
                    <span class="transaction-status ${statusClass}">${statusText}</span>
                </div>
                ${showActions ? `
                    <div class="transaction-actions">
                        ${t.paymentStatus === 'belum' ? `<button class="btn-icon btn-pay" data-action="quick-pay-transaction" data-id="${esc(t.id)}" title="Tandai Lunas">💰</button>` : ''}
                        <button class="btn-icon btn-edit" data-action="edit-transaction" data-id="${esc(t.id)}" title="Edit">✏️</button>
                        <button class="btn-icon btn-delete" data-action="delete-transaction" data-id="${esc(t.id)}" title="Hapus">🗑️</button>
                    </div>
                ` : ''}
            </div>
        `;
    },

    // =====================
    // CITIES (Kota)
    // =====================

    async loadProducts() {
        await this.filterCities();
    },

    async filterCities() {
        try {
        const search = document.getElementById('searchCity').value.toLowerCase();
        let cities = await DataStore.getProducts();

        if (search) {
            cities = cities.filter(c =>
                c.name.toLowerCase().includes(search) ||
                c.initial.toLowerCase().includes(search)
            );
        }

        this.renderCities(cities);
        } catch (err) {
            console.error('filterCities error:', err);
        }
    },

    renderCities(cities) {
        const container = document.getElementById('productsList');

        if (cities.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">🏙️</span>
                    <p>Belum ada kota</p>
                    <button class="btn btn-primary" data-action="open-product-modal">+ Tambah Kota</button>
                </div>
            `;
            return;
        }

        container.innerHTML = cities.map(city => {
            return `
                <div class="product-card" data-id="${esc(city.id)}">
                    <div class="product-header">
                        <div class="product-initial">${esc(city.initial)}</div>
                        <div class="product-actions">
                            <button class="btn-icon btn-edit" data-action="edit-product" data-id="${esc(city.id)}" title="Edit">✏️</button>
                            <button class="btn-icon btn-delete" data-action="delete-product" data-id="${esc(city.id)}" title="Hapus">🗑️</button>
                        </div>
                    </div>
                    <div class="product-name">${esc(city.name)}</div>
                </div>
            `;
        }).join('');

        Animations.listStagger(container);
    },

    // =====================
    // EXPENSES (Belanja Bahan)
    // =====================

    async loadExpenses() {
        await this.updateExpenseSummary();
        await this.filterExpenses();
    },

    async updateExpenseSummary() {
        try {
        const summary = await DataStore.getExpenseSummary();

        document.getElementById('expenseTotalAll').textContent = DataStore.formatCurrency(summary.totalAll);
        document.getElementById('expenseTotalPaid').textContent = DataStore.formatCurrency(summary.totalPaid);
        document.getElementById('expenseTotalUnpaid').textContent = DataStore.formatCurrency(summary.totalUnpaid);
        document.getElementById('expenseTotalTitip').textContent = DataStore.formatCurrency(summary.totalTitip);
        } catch (err) {
            console.error('updateExpenseSummary error:', err);
        }
    },

    async filterExpenses() {
        try {
        const search = document.getElementById('searchExpense').value;
        const status = document.getElementById('filterExpenseStatus').value;
        const date = document.getElementById('filterExpenseDate').value;

        let startDate = '';
        let endDate = '';

        if (date) {
            startDate = date + '-01';
            const [year, month] = date.split('-').map(Number);
            const d = new Date(year, month, 0);
            endDate = `${year}-${String(month).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        const expenses = await DataStore.filterExpenses({ search, status, startDate, endDate });
        this.renderExpenses(expenses);
        } catch (err) {
            console.error('filterExpenses error:', err);
        }
    },

    renderExpenses(expenses) {
        const container = document.getElementById('expensesList');

        if (expenses.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">🧾</span>
                    <p>Belum ada catatan belanja vendor</p>
                    <button class="btn btn-primary" data-action="open-expense-modal">+ Tambah Belanja</button>
                </div>
            `;
            return;
        }

        container.innerHTML = expenses.map(e => this.renderExpenseItem(e)).join('');
        Animations.listStagger(container);
    },

    renderExpenseItem(e, showActions = true) {
        const statusClass = e.paymentStatus === 'lunas' ? 'status-lunas' :
                           e.paymentStatus === 'titip' ? 'status-titip' : 'status-belum';
        const statusText = e.paymentStatus === 'lunas' ? 'Lunas' :
                          e.paymentStatus === 'titip' ? 'Titip Dana' : 'Belum';

        let titipInfo = '';
        if (e.paymentStatus === 'titip' && e.titipAmount) {
            titipInfo = `<br><span class="titip-info">Dititip: ${DataStore.formatCurrency(e.titipAmount)} | Sisa: ${DataStore.formatCurrency(e.remainingAmount || 0)}</span>`;
        }

        return `
            <div class="transaction-item" data-id="${esc(e.id)}">
                <div class="transaction-icon expense-icon">🧾</div>
                <div class="transaction-info">
                    <div class="transaction-name">${esc(e.name)}</div>
                    <div class="transaction-meta">
                        Qty: ${esc(e.quantity)} × ${DataStore.formatCurrency(e.unitPrice)}
                        ${e.date ? ' | ' + DataStore.formatDate(e.date) : ''}
                        ${titipInfo}
                    </div>
                </div>
                <div class="transaction-amount">
                    <div class="transaction-price expense-negative">-${DataStore.formatCurrency(e.totalCost)}</div>
                    <span class="transaction-status ${statusClass}">${statusText}</span>
                </div>
                ${showActions ? `
                <div class="transaction-actions">
                    ${e.paymentStatus === 'belum' || e.paymentStatus === 'titip' ? `<button class="btn-icon btn-pay" data-action="quick-pay-expense" data-id="${esc(e.id)}" title="Tandai Lunas">💰</button>` : ''}
                    <button class="btn-icon btn-edit" data-action="edit-expense" data-id="${esc(e.id)}" title="Edit">✏️</button>
                    <button class="btn-icon btn-delete" data-action="delete-expense" data-id="${esc(e.id)}" title="Hapus">🗑️</button>
                </div>
                ` : ''}
            </div>
        `;
    },

    async openExpenseModal(expenseId = null) {
        try {
            this.editingExpenseId = expenseId;
            const modal = document.getElementById('expenseModal');
            const title = document.getElementById('expenseModalTitle');
            const form = document.getElementById('expenseForm');

            // Populate linked transaction dropdown
            const txSelect = document.getElementById('expenseLinkedTransaction');
            const transactions = await DataStore.getTransactions();
            txSelect.innerHTML = '<option value="">- Tidak di-link -</option>' +
                transactions.map(t => `<option value="${esc(t.id)}">${esc(t.productInitial)} - ${esc(t.productName)} (${DataStore.formatDate(t.date)})</option>`).join('');

            if (expenseId) {
                const e = await DataStore.getExpense(expenseId);
                if (e) {
                    title.textContent = 'Edit Belanja Vendor';
                    document.getElementById('expenseId').value = e.id;
                    document.getElementById('expenseName').value = e.name;
                    document.getElementById('expenseQuantity').value = e.quantity;
                    document.getElementById('expenseUnitPrice').value = e.unitPrice;
                    document.getElementById('expenseTotalCost').value = DataStore.formatCurrency(e.totalCost);
                    document.querySelector(`input[name="expensePaymentStatus"][value="${e.paymentStatus}"]`).checked = true;
                    document.getElementById('expenseTitipAmount').value = e.titipAmount || '';
                    document.getElementById('expenseDate').value = e.date;
                    document.getElementById('expenseLinkedTransaction').value = e.linkedTransactionId || '';
                    document.getElementById('expenseNote').value = e.note || '';
                    this.calculateExpenseTotal();
                    this.toggleTitipDanaField();
                }
            } else {
                title.textContent = 'Tambah Belanja Vendor';
                form.reset();
                document.getElementById('expenseId').value = '';
                document.getElementById('expenseQuantity').value = '1';
                document.querySelector('input[name="expensePaymentStatus"][value="lunas"]').checked = true;
                document.getElementById('expenseTitipAmount').value = '';
                const today = new Date().toISOString().split('T')[0];
                document.getElementById('expenseDate').value = today;
                document.getElementById('expenseTotalCost').value = '';
                this.toggleTitipDanaField();
            }

            Animations.modalOpen('expenseModal');
        } catch (err) {
            console.error('openExpenseModal error:', err);
            this.showToast('Gagal membuka form belanja: ' + err.message, 'error');
        }
    },

    closeExpenseModal() {
        Animations.modalClose('expenseModal', () => {
            this.editingExpenseId = null;
            document.getElementById('titipDanaField').style.display = 'none';
        });
    },

    toggleTitipDanaField() {
        const selected = document.querySelector('input[name="expensePaymentStatus"]:checked').value;
        const field = document.getElementById('titipDanaField');
        if (selected === 'titip') {
            field.style.display = 'block';
            this.calculateRemaining();
        } else {
            field.style.display = 'none';
        }
    },

    calculateRemaining() {
        const total = parseFloat(document.getElementById('expenseQuantity').value || 0) *
                      parseFloat(document.getElementById('expenseUnitPrice').value || 0);
        const titip = parseFloat(document.getElementById('expenseTitipAmount').value) || 0;
        const remaining = total - titip;
        document.getElementById('expenseRemaining').textContent = DataStore.formatCurrency(Math.max(0, remaining));
    },

    calculateExpenseTotal() {
        const qty = parseFloat(document.getElementById('expenseQuantity').value) || 0;
        const price = parseFloat(document.getElementById('expenseUnitPrice').value) || 0;
        const total = qty * price;
        document.getElementById('expenseTotalCost').value = DataStore.formatCurrency(total);
        this.calculateRemaining();
    },

    async saveExpense() {
        try {
            const id = document.getElementById('expenseId').value;
            const totalCost = (parseInt(document.getElementById('expenseQuantity').value) || 1) *
                              (parseFloat(document.getElementById('expenseUnitPrice').value) || 0);
            const paymentStatus = document.querySelector('input[name="expensePaymentStatus"]:checked').value;
            const titipAmount = paymentStatus === 'titip' ?
                               (parseFloat(document.getElementById('expenseTitipAmount').value) || 0) : 0;

            const data = {
                name: document.getElementById('expenseName').value,
                quantity: parseInt(document.getElementById('expenseQuantity').value) || 1,
                unitPrice: parseFloat(document.getElementById('expenseUnitPrice').value) || 0,
                totalCost: totalCost,
                paymentStatus: paymentStatus,
                titipAmount: titipAmount,
                remainingAmount: totalCost - titipAmount,
                date: document.getElementById('expenseDate').value,
                linkedTransactionId: document.getElementById('expenseLinkedTransaction').value || null,
                note: document.getElementById('expenseNote').value
            };

            if (id) {
                await DataStore.updateExpense(id, data);
                this.showToast('Belanja vendor berhasil diupdate', 'success');
            } else {
                await DataStore.addExpense(data);
                this.showToast('Belanja vendor berhasil ditambahkan', 'success');
            }

            this.closeExpenseModal();
            await this.loadPageData(this.currentPage);
        } catch (err) {
            console.error('saveExpense error:', err);
            this.showToast('Gagal simpan belanja: ' + err.message, 'error');
        }
    },

    async editExpense(id) {
        await this.openExpenseModal(id);
    },

    async deleteExpense(id) {
        this.openDeleteModal(async () => {
            await DataStore.deleteExpense(id);
            this.showToast('Belanja vendor berhasil dihapus', 'success');
            await this.loadPageData(this.currentPage);
        });
    },

    // =====================
    // CASHFLOW (Kas)
    // =====================

    async loadCashflow() {
        await this.updateCashflowSummary();
        await this.filterCashflow();
    },

    async updateCashflowSummary() {
        try {
        const balance = await DataStore.getCurrentBalance();
        const totalIn = await DataStore.getTotalCashIn();
        const totalOut = await DataStore.getTotalCashOut();
        const net = await DataStore.getNetCashflow();

        document.getElementById('cashBalance').textContent = DataStore.formatCurrency(balance);
        document.getElementById('cashTotalIn').textContent = DataStore.formatCurrency(totalIn);
        document.getElementById('cashTotalOut').textContent = DataStore.formatCurrency(totalOut);
        document.getElementById('cashNet').textContent = DataStore.formatCurrency(net);
        } catch (err) {
            console.error('updateCashflowSummary error:', err);
        }
    },

    async filterCashflow() {
        try {
        const search = document.getElementById('searchCashflow').value;
        const type = document.getElementById('filterCashType').value;
        const date = document.getElementById('filterCashDate').value;

        let startDate = '';
        let endDate = '';

        if (date) {
            startDate = date + '-01';
            const [year, month] = date.split('-').map(Number);
            const d = new Date(year, month, 0);
            endDate = `${year}-${String(month).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        }

        const items = await DataStore.filterCashflow({ search, type, startDate, endDate });
        this.renderCashflow(items);
        } catch (err) {
            console.error('filterCashflow error:', err);
        }
    },

    renderCashflow(items) {
        const container = document.getElementById('cashflowList');

        if (items.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">💵</span>
                    <p>Belum ada transaksi kas</p>
                    <button class="btn btn-primary" data-action="cash-in">+ Setor Kas</button>
                </div>
            `;
            return;
        }

        container.innerHTML = items.map(item => this.renderCashflowItem(item)).join('');
        Animations.listStagger(container);
    },

    renderCashflowItem(item) {
        const typeClass = item.type === 'in' ? 'cash-in-icon' :
                         item.type === 'out' ? 'cash-out-icon' : 'cash-adjust-icon';
        const typeIcon = item.type === 'in' ? '💰' :
                        item.type === 'out' ? '💸' : '⚙️';
        const typeText = item.type === 'in' ? 'Masuk' :
                        item.type === 'out' ? 'Keluar' : 'Adjust';
        const amountClass = item.type === 'in' ? 'cash-in' :
                           item.type === 'out' ? 'cash-out' : '';
        const amountPrefix = item.type === 'in' ? '+' :
                            item.type === 'out' ? '-' : '';

        return `
            <div class="transaction-item" data-id="${esc(item.id)}">
                <div class="transaction-icon ${typeClass}">${typeIcon}</div>
                <div class="transaction-info">
                    <div class="transaction-name">${esc(item.description)}</div>
                    <div class="transaction-meta">
                        ${typeText} | ${esc(item.category || 'Operasional')}
                        ${item.date ? ' | ' + DataStore.formatDate(item.date) : ''}
                    </div>
                </div>
                <div class="transaction-amount">
                    <div class="transaction-price ${amountClass}">${amountPrefix}${DataStore.formatCurrency(item.amount)}</div>
                    <span class="transaction-status status-titip">${typeText}</span>
                </div>
                <div class="transaction-actions">
                    <button class="btn-icon btn-edit" data-action="edit-cashflow" data-id="${esc(item.id)}" title="Edit">✏️</button>
                    <button class="btn-icon btn-delete" data-action="delete-cashflow" data-id="${esc(item.id)}" title="Hapus">🗑️</button>
                </div>
            </div>
        `;
    },

    openCashModal(type = 'in') {
        const modal = document.getElementById('cashModal');
        const title = document.getElementById('cashModalTitle');
        const submitBtn = document.getElementById('cashSubmitBtn');

        document.getElementById('cashId').value = '';
        document.getElementById('cashType').value = type;
        document.getElementById('cashAmount').value = '';
        document.getElementById('cashDescription').value = '';
        document.getElementById('cashCategory').value = 'operasional';
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('cashDate').value = today;

        if (type === 'in') {
            title.textContent = 'Setor Kas';
            submitBtn.textContent = 'Setor';
            submitBtn.className = 'btn btn-success';
        } else if (type === 'out') {
            title.textContent = 'Tarik Kas';
            submitBtn.textContent = 'Tarik';
            submitBtn.className = 'btn btn-danger';
        } else {
            title.textContent = 'Adjust Saldo';
            submitBtn.textContent = 'Simpan';
            submitBtn.className = 'btn btn-primary';
        }

        Animations.modalOpen('cashModal');
    },

    closeCashModal() {
        Animations.modalClose('cashModal');
    },

    async editCashflow(id) {
        const item = await DataStore.getCashflowItem(id);
        if (!item) return;

        const modal = document.getElementById('cashModal');
        const title = document.getElementById('cashModalTitle');
        const submitBtn = document.getElementById('cashSubmitBtn');

        document.getElementById('cashId').value = item.id;
        document.getElementById('cashType').value = item.type;
        document.getElementById('cashAmount').value = item.amount;
        document.getElementById('cashDescription').value = item.description;
        document.getElementById('cashCategory').value = item.category || 'operasional';
        document.getElementById('cashDate').value = item.date;

        title.textContent = 'Edit Transaksi Kas';
        submitBtn.textContent = 'Simpan';
        submitBtn.className = 'btn btn-primary';

        Animations.modalOpen('cashModal');
    },

    async saveCashflow() {
        try {
            const id = document.getElementById('cashId').value;
            const type = document.getElementById('cashType').value;
            const data = {
                type: type,
                amount: parseFloat(document.getElementById('cashAmount').value) || 0,
                description: document.getElementById('cashDescription').value,
                category: document.getElementById('cashCategory').value,
                date: document.getElementById('cashDate').value
            };

            if (id) {
                await DataStore.updateCashflow(id, data);
                this.showToast('Transaksi kas berhasil diupdate', 'success');
            } else {
                await DataStore.addCashflow(data);
                this.showToast(type === 'in' ? 'Setor kas berhasil' :
                              type === 'out' ? 'Tarik kas berhasil' : 'Saldo berhasil diadjust', 'success');
            }

            this.closeCashModal();
            await this.loadPageData(this.currentPage);
        } catch (err) {
            console.error('saveCashflow error:', err);
            this.showToast('Gagal simpan kas: ' + err.message, 'error');
        }
    },

    async deleteCashflow(id) {
        this.openDeleteModal(async () => {
            await DataStore.deleteCashflow(id);
            this.showToast('Transaksi kas berhasil dihapus', 'success');
            await this.loadPageData(this.currentPage);
        });
    },

    // =====================
    // MODALS
    // =====================

    async openModal(transactionId = null) {
        try {
            this.editingTransactionId = transactionId;
            const modal = document.getElementById('transactionModal');
            const title = document.getElementById('modalTitle');
            const form = document.getElementById('transactionForm');

            // Populate city dropdown
            const citySelect = document.getElementById('selectCity');
            const cities = await DataStore.getProducts();
            citySelect.innerHTML = '<option value="">- Pilih Kota -</option>' +
                cities.map(c => `<option value="${esc(c.id)}">${esc(c.name)} (${esc(c.initial)})</option>`).join('');

            // Reset product checklist
            const checklist = document.getElementById('productChecklist');
            const items = document.getElementById('productChecklistItems');
            const selectAll = document.getElementById('selectAllProducts');
            checklist.classList.add('disabled');
            selectAll.disabled = true;
            selectAll.checked = false;
            items.innerHTML = '<span class="checklist-empty">Pilih kota terlebih dahulu</span>';

            if (transactionId) {
                const t = await DataStore.getTransaction(transactionId);
                if (t) {
                    title.textContent = 'Edit Transaksi';
                    document.getElementById('transactionId').value = t.id;
                    document.getElementById('selectCity').value = t.cityId || '';
                    await this.onCityChange({ target: { value: t.cityId || '' } }, [t.productId]);

                    // Set per-product fields for the selected product
                    const row = document.querySelector(`.checklist-row[data-product-id="${t.productId}"]`);
                    if (row) {
                        row.querySelector('.prod-qty').value = t.quantity || 1;
                        row.querySelector('.prod-number').value = t.numberForm || '';
                        row.querySelector('.prod-price').value = t.pricePerTitle || 0;
                    }

                    document.getElementById('productPly').value = t.ply || 4;
                    document.getElementById('totalPrice').value = DataStore.formatCurrency(t.totalPrice || 0);
                    document.querySelector(`input[name="paymentStatus"][value="${t.paymentStatus}"]`).checked = true;
                    document.getElementById('transactionDate').value = t.date;
                    document.getElementById('transactionNote').value = t.note || '';
                }
            } else {
                title.textContent = 'Tambah Transaksi';
                form.reset();
                document.getElementById('transactionId').value = '';
                document.getElementById('productPly').value = '4';
                document.querySelector('input[name="paymentStatus"][value="lunas"]').checked = true;
                this.setTodayDate();
                document.getElementById('totalPrice').value = '';
            }

            Animations.modalOpen('transactionModal');
        } catch (err) {
            console.error('openModal error:', err);
            this.showToast('Gagal membuka form: ' + err.message, 'error');
        }
    },

    closeModal() {
        Animations.modalClose('transactionModal', () => {
            this.editingTransactionId = null;
        });
    },

    closeModalById(overlay) {
        Animations.modalClose(overlay.id, () => {
            this.editingTransactionId = null;
            this.editingProductId = null;
            this.editingExpenseId = null;
            this.deleteCallback = null;
        });
    },

    async onCityChange(e, preselectProductIds = null) {
        const cityId = e.target.value;
        const checklist = document.getElementById('productChecklist');
        const items = document.getElementById('productChecklistItems');
        const selectAll = document.getElementById('selectAllProducts');

        if (!cityId) {
            checklist.classList.add('disabled');
            selectAll.disabled = true;
            selectAll.checked = false;
            items.innerHTML = '<span class="checklist-empty">Pilih kota terlebih dahulu</span>';
            return;
        }

        const city = await DataStore.getProduct(cityId);
        if (!city) return;

        const products = city.products || [];
        checklist.classList.remove('disabled');
        selectAll.disabled = false;
        selectAll.checked = false;

        items.innerHTML = products.map(p => `
            <div class="checklist-row" data-product-id="${esc(p.id)}">
                <label class="checklist-item">
                    <input type="checkbox" name="productCheck" value="${esc(p.id)}" data-name="${esc(p.name)}" data-size="${esc(p.size)}" data-initial="${esc(city.initial)}" ${preselectProductIds && preselectProductIds.includes(p.id) ? 'checked' : ''}>
                    <span class="checklist-check"></span>
                    <span class="checklist-label">${esc(p.name)} ${esc(p.size)}</span>
                </label>
                <div class="checklist-fields">
                    <input type="number" class="form-input prod-qty" value="1" min="1" max="99999" placeholder="Qty">
                    <input type="text" class="form-input prod-number" maxlength="10" placeholder="No. Form">
                    <input type="number" class="form-input prod-price" value="${p.defaultPrice || 0}" min="0" placeholder="Rp.">
                </div>
            </div>
        `).join('');

        this.updateProductCheckState();
        this.calculateTotal();
    },

    updateProductCheckState() {
        const checks = document.querySelectorAll('input[name="productCheck"]');
        const selectAll = document.getElementById('selectAllProducts');
        const checked = document.querySelectorAll('input[name="productCheck"]:checked');

        if (checks.length === 0) {
            selectAll.checked = false;
            selectAll.indeterminate = false;
        } else if (checked.length === checks.length) {
            selectAll.checked = true;
            selectAll.indeterminate = false;
        } else if (checked.length > 0) {
            selectAll.checked = false;
            selectAll.indeterminate = true;
        } else {
            selectAll.checked = false;
            selectAll.indeterminate = false;
        }
    },

    async openProductModal(productId = null) {
        try {
            this.editingProductId = productId;
            const modal = document.getElementById('productModal');
            const title = document.getElementById('productModalTitle');
            const form = document.getElementById('productForm');

            if (productId) {
                const p = await DataStore.getProduct(productId);
                if (p) {
                    title.textContent = 'Edit Kota';
                    document.getElementById('editProductId').value = p.id;
                    document.getElementById('editProductName').value = p.name;
                    document.getElementById('editProductInitial').value = p.initial;
                }
            } else {
                title.textContent = 'Tambah Kota';
                form.reset();
                document.getElementById('editProductId').value = '';
            }

            Animations.modalOpen('productModal');
        } catch (err) {
            console.error('openProductModal error:', err);
            this.showToast('Gagal membuka form kota: ' + err.message, 'error');
        }
    },

    closeProductModal() {
        Animations.modalClose('productModal', () => {
            this.editingProductId = null;
        });
    },

    openDeleteModal(callback) {
        this.deleteCallback = callback;
        Animations.modalOpen('deleteModal');
    },

    closeDeleteModal() {
        Animations.modalClose('deleteModal', () => {
            this.deleteCallback = null;
        });
    },

    closeAllModals() {
        document.querySelectorAll('.modal-overlay.active').forEach(m => {
            Animations.modalClose(m.id);
        });
        this.editingTransactionId = null;
        this.editingProductId = null;
        this.editingExpenseId = null;
        this.deleteCallback = null;
        document.getElementById('titipDanaField').style.display = 'none';
    },

    // =====================
    // FORMS
    // =====================

    calculateTotal() {
        const checks = document.querySelectorAll('input[name="productCheck"]:checked');
        let total = 0;
        checks.forEach(check => {
            const row = check.closest('.checklist-row');
            if (!row) return;
            const price = parseFloat(row.querySelector('.prod-price').value) || 0;
            const qty = parseInt(row.querySelector('.prod-qty').value) || 1;
            total += price * qty;
        });
        document.getElementById('totalPrice').value = DataStore.formatCurrency(total);
    },

    async saveTransaction() {
        try {
            const id = document.getElementById('transactionId').value;
            const cityId = document.getElementById('selectCity').value;
            const city = await DataStore.getProduct(cityId);

            // Edit mode: single transaction
            if (id) {
                const checked = document.querySelector('input[name="productCheck"]:checked');
                if (!checked) {
                    this.showToast('Pilih minimal satu produk', 'error');
                    return;
                }
                const row = checked.closest('.checklist-row');
                const price = parseFloat(row.querySelector('.prod-price').value) || 0;
                const qty = parseInt(row.querySelector('.prod-qty').value) || 1;
                const data = {
                    cityId: cityId,
                    cityName: city ? city.name : '',
                    productId: checked.value,
                    productName: checked.dataset.name,
                    productInitial: checked.dataset.initial,
                    numberForm: row.querySelector('.prod-number').value,
                    size: checked.dataset.size,
                    ply: parseInt(document.getElementById('productPly').value),
                    pricePerTitle: price,
                    quantity: qty,
                    totalPrice: price * qty,
                    paymentStatus: document.querySelector('input[name="paymentStatus"]:checked').value,
                    materialCost: 0,
                    date: document.getElementById('transactionDate').value,
                    note: document.getElementById('transactionNote').value
                };
                await DataStore.updateTransaction(id, data);
                this.showToast('Transaksi berhasil diupdate', 'success');
            } else {
                // Create mode: one transaction per checked product
                const checks = document.querySelectorAll('input[name="productCheck"]:checked');
                if (checks.length === 0) {
                    this.showToast('Pilih minimal satu produk', 'error');
                    return;
                }
                const ply = parseInt(document.getElementById('productPly').value);
                const paymentStatus = document.querySelector('input[name="paymentStatus"]:checked').value;
                const date = document.getElementById('transactionDate').value;
                const note = document.getElementById('transactionNote').value;

                let count = 0;
                for (const check of checks) {
                    const row = check.closest('.checklist-row');
                    const price = parseFloat(row.querySelector('.prod-price').value) || 0;
                    const qty = parseInt(row.querySelector('.prod-qty').value) || 1;
                    const data = {
                        cityId: cityId,
                        cityName: city ? city.name : '',
                        productId: check.value,
                        productName: check.dataset.name,
                        productInitial: check.dataset.initial,
                        numberForm: row.querySelector('.prod-number').value,
                        size: check.dataset.size,
                        ply,
                        pricePerTitle: price,
                        quantity: qty,
                        totalPrice: price * qty,
                        paymentStatus,
                        materialCost: 0,
                        date,
                        note
                    };
                    await DataStore.addTransaction(data);
                    count++;
                }
                this.showToast(`${count} transaksi berhasil ditambahkan`, 'success');
            }

            this.closeModal();
            await this.loadPageData(this.currentPage);
        } catch (err) {
            console.error('saveTransaction error:', err);
            this.showToast('Gagal simpan transaksi: ' + err.message, 'error');
        }
    },

    async saveProduct() {
        try {
            const id = document.getElementById('editProductId').value;
            const name = document.getElementById('editProductName').value.toUpperCase();
            const initial = document.getElementById('editProductInitial').value.toUpperCase();

            const data = {
                name: name,
                initial: initial
            };

            if (id) {
                await DataStore.updateProduct(id, data);
                this.showToast('Kota berhasil diupdate', 'success');
            } else {
                await DataStore.addProduct(data);
                this.showToast('Kota berhasil ditambahkan', 'success');
            }

            this.closeProductModal();
            await this.loadPageData(this.currentPage);
        } catch (err) {
            console.error('saveProduct error:', err);
            this.showToast('Gagal simpan kota: ' + err.message, 'error');
        }
    },

    // =====================
    // CRUD OPERATIONS
    // =====================

    async editTransaction(id) {
        await this.openModal(id);
    },

    async deleteTransaction(id) {
        this.openDeleteModal(async () => {
            await DataStore.deleteTransaction(id);
            this.showToast('Transaksi berhasil dihapus', 'success');
            await this.loadPageData(this.currentPage);
        });
    },

    async editProduct(id) {
        await this.openProductModal(id);
    },

    async deleteProduct(id) {
        this.openDeleteModal(async () => {
            await DataStore.deleteProduct(id);
            this.showToast('Produk berhasil dihapus', 'success');
            await this.loadPageData(this.currentPage);
        });
    },

    async confirmDelete() {
        if (this.deleteCallback) {
            try {
                await this.deleteCallback();
            } catch (err) {
                console.error('Delete error:', err);
                this.showToast('Gagal menghapus: ' + err.message, 'error');
            }
        }
        this.closeDeleteModal();
    },

    // =====================
    // REPORTS
    // =====================

    setReportToday() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('reportStartDate').value = today;
        document.getElementById('reportEndDate').value = today;
    },

    setReportThisMonth() {
        const now = new Date();
        const first = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const lastDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
        document.getElementById('reportStartDate').value = first;
        document.getElementById('reportEndDate').value = lastDay;
    },

    setReportLastMonth() {
        const now = new Date();
        const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const first = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-01`;
        const last = new Date(prev.getFullYear(), prev.getMonth() + 1, 0);
        const lastDay = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
        document.getElementById('reportStartDate').value = first;
        document.getElementById('reportEndDate').value = lastDay;
    },

    async generateReport() {
        try {
        const startDate = document.getElementById('reportStartDate').value;
        const endDate = document.getElementById('reportEndDate').value;
        const report = await DataStore.generateAdvancedReport(startDate, endDate);

        const container = document.getElementById('reportContent');

        if (report.transactions.length === 0 && report.expenses.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <span class="empty-icon">📈</span>
                    <p>Tidak ada data pada periode ini</p>
                </div>
            `;
            return;
        }

        // Build product summary table
        let productRows = '';
        let totalProductQty = 0;
        let totalProductRevenue = 0;
        let totalProductProfit = 0;
        for (const [name, data] of Object.entries(report.byProduct)) {
            const prodProfit = data.total - data.material;
            const prodMargin = data.total > 0 ? Math.round((prodProfit / data.total) * 10000) / 100 : 0;
            totalProductQty += data.count;
            totalProductRevenue += data.total;
            totalProductProfit += prodProfit;
            productRows += `
                <tr>
                    <td>${esc(name)}</td>
                    <td>${esc(data.count)}</td>
                    <td>${DataStore.formatCurrency(data.total)}</td>
                    <td>${DataStore.formatCurrency(prodProfit)}</td>
                    <td>${prodMargin}%</td>
                </tr>
            `;
        }
        const totalProductMargin = totalProductRevenue > 0 ? Math.round((totalProductProfit / totalProductRevenue) * 10000) / 100 : 0;

        // Build transaction details table
        let transactionRows = '';
        report.transactions.forEach(t => {
            const cityLabel = esc(t.cityName || '');
            const productLabel = esc(t.productName || '');
            const numberLabel = t.numberForm ? ` | No: ${esc(t.numberForm)}` : '';
            transactionRows += `
                <tr>
                    <td>${DataStore.formatDate(t.date)}</td>
                    <td>${cityLabel} - ${productLabel} (${esc(t.size || '')})</td>
                    <td>${esc(t.ply)} Ply</td>
                    <td>${esc(t.quantity)}</td>
                    <td>${numberLabel.replace(' | ', '')}</td>
                    <td>${DataStore.formatCurrency(t.totalPrice)}</td>
                    <td><span class="transaction-status ${t.paymentStatus === 'lunas' ? 'status-lunas' : 'status-belum'}">${t.paymentStatus === 'lunas' ? 'Lunas' : 'Belum'}</span></td>
                </tr>
            `;
        });

        // Build expenses table
        let expenseRows = '';
        report.expenses.forEach(e => {
            const statusClass = e.paymentStatus === 'lunas' ? 'status-lunas' :
                               e.paymentStatus === 'titip' ? 'status-titip' : 'status-belum';
            const statusText = e.paymentStatus === 'lunas' ? 'Lunas' :
                              e.paymentStatus === 'titip' ? 'Titip Dana' : 'Belum';
            const titipInfo = e.paymentStatus === 'titip' ?
                `<br><small>Dititip: ${DataStore.formatCurrency(e.titipAmount || 0)} | Sisa: ${DataStore.formatCurrency(e.remainingAmount || 0)}</small>` : '';
            expenseRows += `
                <tr>
                    <td>${DataStore.formatDate(e.date)}</td>
                    <td>${esc(e.name)}</td>
                    <td>${esc(e.quantity)}</td>
                    <td>${DataStore.formatCurrency(e.unitPrice)}</td>
                    <td style="color: var(--danger)">-${DataStore.formatCurrency(e.totalCost)}</td>
                    <td>-</td>
                    <td><span class="transaction-status ${statusClass}">${statusText}</span>${titipInfo}</td>
                </tr>
            `;
        });

        // Top products rows
        let topProductRows = '';
        report.topProducts.forEach(p => {
            topProductRows += `
                <tr>
                    <td>#${esc(p.rank)}</td>
                    <td>${esc(p.initial)} - ${esc(p.name)}</td>
                    <td>${esc(p.count)}</td>
                    <td>${DataStore.formatCurrency(p.totalRevenue)}</td>
                    <td>${DataStore.formatCurrency(p.totalCost)}</td>
                    <td>${DataStore.formatCurrency(p.totalProfit)}</td>
                    <td>${DataStore.formatCurrency(p.avgProfitPerTx)}</td>
                </tr>
            `;
        });

        // Monthly trend
        const trend = report.monthlyTrend;
        const trendDirection = trend.changePercent >= 0 ? '📈' : '📉';
        const trendClass = trend.changePercent >= 0 ? 'trend-up' : 'trend-down';

        // Projection
        const proj = report.profitProjection;

        container.innerHTML = `
            <div class="report-section">
                <h3>Ringkasan Periode ${report.dateRange.start} - ${report.dateRange.end}</h3>
                <div class="report-summary">
                    <div class="summary-item income">
                        <span class="summary-label">Total Pendapatan</span>
                        <span class="summary-value">${DataStore.formatCurrency(report.totalIncome)}</span>
                    </div>
                    <div class="summary-item expense">
                        <span class="summary-label">Total Pengeluaran</span>
                        <span class="summary-value">-${DataStore.formatCurrency(report.totalExpense)}</span>
                        <span class="summary-sub">Material: -${DataStore.formatCurrency(report.txExpense)}<br>Vendor: -${DataStore.formatCurrency(report.bahanExpense)}</span>
                    </div>
                    <div class="summary-item profit ${report.profit < 0 ? 'negative' : ''}">
                        <span class="summary-label">Laba Bersih</span>
                        <span class="summary-value ${report.profit < 0 ? 'negative' : ''}">${report.profit >= 0 ? '' : '-'}${DataStore.formatCurrency(Math.abs(report.profit))}</span>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h3>Analisis Matematis</h3>
                <div class="analytics-grid">
                    <div class="analytics-card">
                        <div class="analytics-icon">📊</div>
                        <div class="analytics-info">
                            <span class="analytics-label">Margin Keuntungan</span>
                            <span class="analytics-value ${report.profitMargin >= 50 ? 'positive' : report.profitMargin >= 20 ? 'neutral' : 'negative'}">${report.profitMargin}%</span>
                        </div>
                    </div>
                    <div class="analytics-card">
                        <div class="analytics-icon">📦</div>
                        <div class="analytics-info">
                            <span class="analytics-label">Efisiensi Bahan</span>
                            <span class="analytics-value ${report.materialEfficiency <= 30 ? 'positive' : report.materialEfficiency <= 50 ? 'neutral' : 'negative'}">${report.materialEfficiency}%</span>
                            <span class="analytics-desc">${report.materialEfficiency <= 30 ? 'Sangat Efisien' : report.materialEfficiency <= 50 ? 'Cukup Efisien' : 'Perlu Dioptimasi'}</span>
                        </div>
                    </div>
                    <div class="analytics-card">
                        <div class="analytics-icon">${trendDirection}</div>
                        <div class="analytics-info">
                            <span class="analytics-label">Tren Bulanan</span>
                            <span class="analytics-value ${trendClass}">${trend.changePercent >= 0 ? '+' : ''}${trend.changePercent}%</span>
                            <span class="analytics-desc">Bulan ini: ${DataStore.formatCurrency(trend.currentMonth.profit)}<br>Bulan lalu: ${DataStore.formatCurrency(trend.previousMonth.profit)}</span>
                        </div>
                    </div>
                    <div class="analytics-card">
                        <div class="analytics-icon">🔮</div>
                        <div class="analytics-info">
                            <span class="analytics-label">Proyeksi Bulan Depan</span>
                            <span class="analytics-value">${DataStore.formatCurrency(proj.nextMonthEstimate)}</span>
                            <span class="analytics-desc">Rata-rata/bulan: ${DataStore.formatCurrency(proj.averageMonthlyProfit)}<br>(${proj.dataPoints} bulan data)</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="report-section">
                <h3>Ranking Produk</h3>
                <div class="report-table-wrap">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Rank</th>
                            <th>Produk</th>
                            <th>Qty</th>
                            <th>Penjualan</th>
                            <th>Biaya</th>
                            <th>Laba</th>
                            <th>Rata-rata/Tx</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${topProductRows || '<tr><td colspan="7" style="text-align:center">Belum ada data</td></tr>'}
                    </tbody>
                </table>
                </div>
            </div>

            <div class="report-section">
                <h3>Ringkasan per Produk</h3>
                <div class="report-table-wrap">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Produk</th>
                            <th>Jumlah Qty</th>
                            <th>Total Penjualan</th>
                            <th>Laba</th>
                            <th>Margin</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${productRows || '<tr><td colspan="5" style="text-align:center">Belum ada data</td></tr>'}
                        ${productRows ? `
                        <tr class="total-row">
                            <td>TOTAL</td>
                            <td>${totalProductQty}</td>
                            <td>${DataStore.formatCurrency(totalProductRevenue)}</td>
                            <td>${DataStore.formatCurrency(totalProductProfit)}</td>
                            <td>${totalProductMargin}%</td>
                        </tr>
                        ` : ''}
                    </tbody>
                </table>
                </div>
            </div>

            ${report.expenses.length > 0 ? `
            <div class="report-section">
                <h3>Detail Belanja Vendor</h3>
                <div class="report-table-wrap">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Tanggal</th>
                            <th>Nama Vendor</th>
                            <th>Qty</th>
                            <th>Harga Satuan</th>
                            <th>Total</th>
                            <th>Link Transaksi</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${expenseRows}
                        <tr class="total-row">
                            <td colspan="4">TOTAL BELANJA VENDOR</td>
                            <td style="color: var(--danger)">-${DataStore.formatCurrency(report.bahanExpense)}</td>
                            <td colspan="2"></td>
                        </tr>
                    </tbody>
                </table>
                </div>
            </div>
            ` : ''}

            <div class="report-section">
                <h3>Detail Transaksi</h3>
                <div class="report-table-wrap">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Tanggal</th>
                            <th>Kota - Produk</th>
                            <th>Ply</th>
                            <th>Qty</th>
                            <th>No Form</th>
                            <th>Total</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transactionRows || '<tr><td colspan="7" style="text-align:center">Belum ada transaksi</td></tr>'}
                    </tbody>
                </table>
                </div>
            </div>

            <div class="report-section">
                <h3>Status Pembayaran</h3>
                <div class="report-table-wrap">
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Status</th>
                            <th>Jumlah</th>
                            <th>Total Nominal</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td><span class="transaction-status status-lunas">Lunas (Transaksi)</span></td>
                            <td>${report.paid.length}</td>
                            <td>${DataStore.formatCurrency(report.paidAmount)}</td>
                        </tr>
                        <tr>
                            <td><span class="transaction-status status-belum">Belum Bayar (Transaksi)</span></td>
                            <td>${report.unpaid.length}</td>
                            <td>${DataStore.formatCurrency(report.unpaidAmount)}</td>
                        </tr>
                        <tr>
                            <td><span class="transaction-status status-lunas">Lunas (Belanja Vendor)</span></td>
                            <td>${report.expensesPaid.length}</td>
                            <td style="color: var(--danger)">-${DataStore.formatCurrency(report.expensesPaidAmount)}</td>
                        </tr>
                        <tr>
                            <td><span class="transaction-status status-belum">Belum Bayar (Belanja Vendor)</span></td>
                            <td>${report.expensesUnpaid.length}</td>
                            <td style="color: var(--danger)">-${DataStore.formatCurrency(report.expensesUnpaidAmount)}</td>
                        </tr>
                        <tr>
                            <td><span class="transaction-status status-titip">Titip Dana (Belanja Vendor)</span></td>
                            <td>${report.expensesTitip.length}</td>
                            <td style="color: var(--danger)">-${DataStore.formatCurrency(report.expensesTitipAmount)}
                                <br><small>Sisa: ${DataStore.formatCurrency(report.expensesTitipRemaining)}</small>
                            </td>
                        </tr>
                        <tr class="total-row">
                            <td>TOTAL</td>
                            <td>${report.transactions.length + report.expenses.length}</td>
                            <td>${DataStore.formatCurrency(report.totalIncome)} / <span style="color: var(--danger)">-${DataStore.formatCurrency(report.totalExpense)}</span></td>
                        </tr>
                    </tbody>
                </table>
                </div>
            </div>

            <div class="report-section" style="text-align: right;">
                <button class="btn btn-primary" data-action="print-report">🖨️ Cetak Laporan</button>
            </div>
        `;

        Animations.fadeIn(container);
        } catch (err) {
            console.error('generateReport error:', err);
            this.showToast('Gagal generate laporan: ' + err.message, 'error');
        }
    },

    printReport() {
        window.print();
    },

    // =====================
    // QUICK ACTIONS
    // =====================

    async quickPayTransaction(id) {
        try {
            const tx = await DataStore.getTransaction(id);
            if (!tx) throw new Error('Transaksi tidak ditemukan');
            tx.paymentStatus = 'lunas';
            await DataStore.updateTransaction(id, tx);
            this.showToast('Transaksi ditandai sebagai lunas', 'success');
            await this.loadPageData(this.currentPage);
        } catch (err) {
            console.error('quickPayTransaction error:', err);
            this.showToast('Gagal update pembayaran: ' + err.message, 'error');
        }
    },

    async quickPayExpense(id) {
        try {
            const exp = await DataStore.getExpense(id);
            if (!exp) throw new Error('Belanja vendor tidak ditemukan');
            exp.paymentStatus = 'lunas';
            await DataStore.updateExpense(id, exp);
            this.showToast('Belanja vendor ditandai sebagai lunas', 'success');
            await this.loadPageData(this.currentPage);
        } catch (err) {
            console.error('quickPayExpense error:', err);
            this.showToast('Gagal update pembayaran: ' + err.message, 'error');
        }
    },

    // =====================
    // DATA BACKUP/RESTORE
    // =====================

    async exportData() {
        const data = {
            version: '3.0',
            exportDate: new Date().toISOString(),
            transactions: await DataStore.getTransactions(),
            products: await DataStore.getProducts(),
            expenses: await DataStore.getExpenses(),
            cashflow: await DataStore.getCashflow()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `media112-backup-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.showToast('Data berhasil di-export', 'success');
    },

    async importData(event) {
        const file = event.target.files[0];
        if (!file) return;

        // File size limit: 5MB
        if (file.size > 5 * 1024 * 1024) {
            this.showToast('Ukuran file terlalu besar (maksimal 5MB)', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);

                if (!data.transactions || !data.products) {
                    this.showToast('Format file tidak valid', 'error');
                    return;
                }

                // Structure validation
                if (!Array.isArray(data.transactions) || !Array.isArray(data.products)) {
                    this.showToast('Format data tidak valid: transaksi dan produk harus berupa array', 'error');
                    return;
                }

                // Record count limit
                const totalCount = data.transactions.length + data.products.length + (data.expenses || []).length + (data.cashflow || []).length;
                if (totalCount > 10000) {
                    this.showToast('Data terlalu besar (maksimal 10.000 record)', 'error');
                    return;
                }

                // Validate required fields in transactions
                for (const tx of data.transactions) {
                    if (!tx.id || !tx.cityId) {
                        this.showToast('Data transaksi tidak lengkap (id dan cityId diperlukan)', 'error');
                        return;
                    }
                }

                // Validate required fields in products/cities
                for (const city of data.products) {
                    if (!city.id || !city.name) {
                        this.showToast('Data kota tidak lengkap (id dan name diperlukan)', 'error');
                        return;
                    }
                }

                if (confirm(`Import data dari ${data.exportDate ? new Date(data.exportDate).toLocaleDateString('id-ID') : 'backup'}?\n\nTransaksi: ${data.transactions.length}\nProduk: ${data.products.length}\nPengeluaran: ${(data.expenses || []).length}\nKas: ${(data.cashflow || []).length}\n\nData lama akan diganti.`)) {
                    // Import cities and products
                    for (const city of data.products) {
                        const existing = await DataStore.getCity(city.id).catch(() => null);
                        if (existing) {
                            await DataStore.updateCity(city.id, city);
                        } else {
                            await DataStore.addCity(city);
                        }
                    }

                    // Import transactions
                    for (const tx of data.transactions) {
                        const existing = await DataStore.getTransaction(tx.id).catch(() => null);
                        if (existing) {
                            await DataStore.updateTransaction(tx.id, tx);
                        } else {
                            await DataStore.addTransaction(tx);
                        }
                    }

                    // Import expenses
                    for (const exp of (data.expenses || [])) {
                        const existing = await DataStore.getExpense(exp.id).catch(() => null);
                        if (existing) {
                            await DataStore.updateExpense(exp.id, exp);
                        } else {
                            await DataStore.addExpense(exp);
                        }
                    }

                    // Import cashflow
                    for (const cf of (data.cashflow || [])) {
                        const existing = await DataStore.getCashflowItem(cf.id).catch(() => null);
                        if (existing) {
                            await DataStore.updateCashflow(cf.id, cf);
                        } else {
                            await DataStore.addCashflow(cf);
                        }
                    }

                    await this.loadPageData(this.currentPage);
                    this.showToast(`Data berhasil di-import: ${data.transactions.length} transaksi, ${data.products.length} produk`, 'success');
                }
            } catch (err) {
                this.showToast('Gagal membaca file: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    },

    // =====================
    // TOAST NOTIFICATIONS
    // =====================

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;

        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        toast.innerHTML = `<span>${icons[type] || icons.info}</span> ${esc(message)}`;
        container.appendChild(toast);

        // Animate toast in
        Animations.toastIn(toast);

        // Animate toast out after 3 seconds
        setTimeout(() => {
            Animations.toastOut(toast, () => toast.remove());
        }, 3000);
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => App.init());
