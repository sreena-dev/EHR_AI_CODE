/**
 * AIRA Clinical Workflow — Client-Side Hash Router
 * Simple hash-based SPA router.
 */

const routes = {};
let currentCleanup = null;

/**
 * Register a route
 * @param {string} path - Hash path (e.g., '/login')
 * @param {Function} handler - Async function that renders the page, returns optional cleanup fn
 */
export function route(path, handler) {
    routes[path] = handler;
}

/** Navigate to a path */
export function navigate(path) {
    window.location.hash = '#' + path;
}

/** Get current route path */
export function currentPath() {
    return window.location.hash.slice(1) || '/login';
}

/** Initialize the router */
export function startRouter() {
    async function handleRoute() {
        // Cleanup previous page
        if (typeof currentCleanup === 'function') {
            currentCleanup();
            currentCleanup = null;
        }

        const path = currentPath();
        const handler = routes[path] || routes['/login'];

        if (handler) {
            try {
                currentCleanup = await handler();
            } catch (err) {
                console.error('Route error:', err);
                document.getElementById('app').innerHTML = `
          <div style="padding: 48px; text-align: center;">
            <h2>Something went wrong</h2>
            <p style="color: var(--gray-500);">${err.message}</p>
            <a href="#/login" style="margin-top: 16px; display: inline-block;">Back to Login</a>
          </div>
        `;
            }
        }
    }

    window.addEventListener('hashchange', handleRoute);
    handleRoute();
}
