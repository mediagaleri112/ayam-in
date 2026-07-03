/**
 * media.112 - Animations (Anime.js)
 */

const Animations = {

    // Page transition: stagger children fade in
    pageTransition(container) {
        const children = container.querySelectorAll('.stats-grid, .dashboard-grid, .page-header, .transactions-list, .products-grid, .expense-summary-cards, .cashflow-balance-card, .cashflow-summary-cards, .report-controls, .report-content, .card');
        if (!children.length) return;

        anime({
            targets: children,
            opacity: [0, 1],
            translateY: [20, 0],
            duration: 400,
            delay: anime.stagger(60),
            easing: 'easeOutCubic'
        });
    },

    // List items stagger animation
    listStagger(container) {
        const items = container.querySelectorAll('.transaction-item, .product-card');
        if (!items.length) return;

        anime({
            targets: items,
            opacity: [0, 1],
            translateY: [15, 0],
            scale: [0.98, 1],
            duration: 350,
            delay: anime.stagger(40),
            easing: 'easeOutCubic'
        });
    },

    // Modal open - overlayId is the .modal-overlay, dialog is the inner .modal
    modalOpen(overlayId) {
        const overlay = document.getElementById(overlayId);
        const dialog = overlay.querySelector('.modal');
        overlay.classList.add('active');
        overlay.style.opacity = '1';

        anime({
            targets: dialog,
            scale: [0.85, 1],
            opacity: [0, 1],
            translateY: [30, 0],
            duration: 300,
            easing: 'easeOutBack'
        });
    },

    // Modal close
    modalClose(overlayId, callback) {
        const overlay = document.getElementById(overlayId);
        const dialog = overlay.querySelector('.modal');

        anime({
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

    // Count-up number animation
    countUp(element, targetValue) {
        const obj = { value: 0 };
        anime({
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

    // Count-up for plain numbers (not currency)
    countUpNumber(element, targetValue) {
        const obj = { value: 0 };
        anime({
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

    // Button press bounce
    buttonPress(element) {
        anime({
            targets: element,
            scale: [1, 0.92, 1.03, 1],
            duration: 300,
            easing: 'easeOutCubic'
        });
    },

    // Toast slide in from right
    toastIn(element) {
        anime({
            targets: element,
            translateX: [120, 0],
            opacity: [0, 1],
            duration: 350,
            easing: 'easeOutCubic'
        });
    },

    // Toast slide out to right
    toastOut(element, callback) {
        anime({
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

    // Delete shake animation
    shake(element) {
        anime({
            targets: element,
            translateX: [0, -8, 8, -6, 6, -3, 3, 0],
            duration: 400,
            easing: 'easeOutCubic'
        });
    },

    // Stat cards entrance
    statCardsEntrance() {
        const cards = document.querySelectorAll('.stat-card');
        if (!cards.length) return;

        anime({
            targets: cards,
            opacity: [0, 1],
            translateY: [25, 0],
            scale: [0.95, 1],
            duration: 450,
            delay: anime.stagger(80),
            easing: 'easeOutCubic'
        });
    },

    // Progress bar animation
    progressBar(element, targetWidth) {
        anime({
            targets: element,
            width: [0, targetWidth + '%'],
            duration: 800,
            easing: 'easeOutCubic'
        });
    },

    // Fade in element
    fadeIn(element, duration = 300) {
        anime({
            targets: element,
            opacity: [0, 1],
            translateY: [10, 0],
            duration: duration,
            easing: 'easeOutCubic'
        });
    }
};
