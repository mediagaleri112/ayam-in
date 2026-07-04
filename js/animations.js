/**
 * media.112 - Animations (Anime.js)
 * All methods gracefully degrade when anime.js is unavailable
 */

const Animations = {

    _anime() {
        return typeof anime !== 'undefined' ? anime : null;
    },

    pageTransition(container) {
        const children = container.querySelectorAll('.stats-grid, .dashboard-grid, .page-header, .transactions-list, .products-grid, .expense-summary-cards, .cashflow-balance-card, .cashflow-summary-cards, .report-controls, .report-content, .card');
        if (!children.length) return;
        const a = this._anime();
        if (!a) { children.forEach(c => c.style.opacity = '1'); return; }

        a({
            targets: children,
            opacity: [0, 1],
            translateY: [20, 0],
            duration: 400,
            delay: a.stagger(60),
            easing: 'easeOutCubic'
        });
    },

    listStagger(container) {
        const items = container.querySelectorAll('.transaction-item, .product-card');
        if (!items.length) return;
        const a = this._anime();
        if (!a) { items.forEach(c => c.style.opacity = '1'); return; }

        a({
            targets: items,
            opacity: [0, 1],
            translateY: [15, 0],
            scale: [0.98, 1],
            duration: 350,
            delay: a.stagger(40),
            easing: 'easeOutCubic'
        });
    },

    modalOpen(overlayId) {
        const overlay = document.getElementById(overlayId);
        const dialog = overlay.querySelector('.modal');
        overlay.classList.add('active');
        overlay.style.opacity = '1';
        const a = this._anime();
        if (!a) return;

        a({
            targets: dialog,
            scale: [0.85, 1],
            opacity: [0, 1],
            translateY: [30, 0],
            duration: 300,
            easing: 'easeOutBack'
        });
    },

    modalClose(overlayId, callback) {
        const overlay = document.getElementById(overlayId);
        const dialog = overlay.querySelector('.modal');
        const a = this._anime();
        if (!a) {
            overlay.classList.remove('active');
            overlay.style.opacity = '';
            dialog.style.transform = '';
            dialog.style.opacity = '';
            if (callback) callback();
            return;
        }

        a({
            targets: dialog,
            scale: [1, 0.9],
            opacity: [1, 0],
            translateY: [0, 15],
            duration: 200,
            easing: 'easeInCubic',
            complete: () => {
                overlay.classList.remove('active');
                overlay.style.opacity = '';
                dialog.style.transform = '';
                dialog.style.opacity = '';
                if (callback) callback();
            }
        });
    },

    countUp(element, targetValue) {
        const a = this._anime();
        if (!a) { element.textContent = DataStore.formatCurrency(targetValue); return; }
        const obj = { value: 0 };
        a({
            targets: obj,
            value: targetValue,
            duration: 800,
            easing: 'easeOutExpo',
            round: 1,
            update: () => {
                element.textContent = DataStore.formatCurrency(Math.round(obj.value));
            }
        });
    },

    countUpNumber(element, targetValue) {
        const a = this._anime();
        if (!a) { element.textContent = Math.round(targetValue); return; }
        const obj = { value: 0 };
        a({
            targets: obj,
            value: targetValue,
            duration: 600,
            easing: 'easeOutExpo',
            round: 1,
            update: () => {
                element.textContent = Math.round(obj.value);
            }
        });
    },

    buttonPress(element) {
        const a = this._anime();
        if (!a) return;
        a({
            targets: element,
            scale: [1, 0.92, 1.03, 1],
            duration: 300,
            easing: 'easeOutCubic'
        });
    },

    toastIn(element) {
        const a = this._anime();
        if (!a) { element.style.opacity = '1'; return; }
        a({
            targets: element,
            translateX: [120, 0],
            opacity: [0, 1],
            duration: 350,
            easing: 'easeOutCubic'
        });
    },

    toastOut(element, callback) {
        const a = this._anime();
        if (!a) { if (callback) callback(); return; }
        a({
            targets: element,
            translateX: [0, 120],
            opacity: [1, 0],
            duration: 300,
            easing: 'easeInCubic',
            complete: () => {
                if (callback) callback();
            }
        });
    },

    shake(element) {
        const a = this._anime();
        if (!a) return;
        a({
            targets: element,
            translateX: [0, -8, 8, -6, 6, -3, 3, 0],
            duration: 400,
            easing: 'easeOutCubic'
        });
    },

    statCardsEntrance() {
        const cards = document.querySelectorAll('.stat-card');
        if (!cards.length) return;
        const a = this._anime();
        if (!a) { cards.forEach(c => c.style.opacity = '1'); return; }

        a({
            targets: cards,
            opacity: [0, 1],
            translateY: [25, 0],
            scale: [0.95, 1],
            duration: 450,
            delay: a.stagger(80),
            easing: 'easeOutCubic'
        });
    },

    progressBar(element, targetWidth) {
        const a = this._anime();
        if (!a) { element.style.width = targetWidth + '%'; return; }
        a({
            targets: element,
            width: [0, targetWidth + '%'],
            duration: 800,
            easing: 'easeOutCubic'
        });
    },

    fadeIn(element, duration = 300) {
        const a = this._anime();
        if (!a) { element.style.opacity = '1'; return; }
        a({
            targets: element,
            opacity: [0, 1],
            translateY: [10, 0],
            duration: duration,
            easing: 'easeOutCubic'
        });
    }
};
