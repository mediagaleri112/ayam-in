/**
 * media.112 - Service Worker Registration & Cache Cleanup
 */

if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        // Unregister old service workers
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
            await reg.unregister();
        }

        // Clear all old caches
        const cacheNames = await caches.keys();
        for (const name of cacheNames) {
            await caches.delete(name);
        }

        // Register fresh service worker
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW registered:', reg.scope))
            .catch(err => console.log('SW error:', err));
    });
}
