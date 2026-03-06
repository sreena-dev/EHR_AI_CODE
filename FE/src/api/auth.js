/**
 * AIRA Clinical Workflow — Auth API Service
 * Handles JWT login, token management, and session control.
 */

const TOKEN_KEY = 'aira_access_token';
const REFRESH_KEY = 'aira_refresh_token';
const USER_KEY = 'aira_user';

/** Get stored access token */
export function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
}

/** Get current user profile from storage */
export function getCurrentUser() {
    const raw = sessionStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
}

/** Check if user is authenticated */
export function isAuthenticated() {
    return !!getToken();
}

/** Get authorization headers for API requests */
export function authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Login with staff credentials
 * @param {string} staffId - Staff ID
 * @param {string} password - Password
 * @returns {Promise<Object>} Login response with token and user info
 */
export async function login(staffId, password) {
    const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId, password }),
    });

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.detail || data.message || 'Login failed');
    }

    // Store tokens and user data
    if (data.token) {
        sessionStorage.setItem(TOKEN_KEY, data.token.access_token);
        sessionStorage.setItem(REFRESH_KEY, data.token.refresh_token);
        sessionStorage.setItem(USER_KEY, JSON.stringify({
            staff_id: data.token.staff_id,
            role: data.token.role,
            full_name: data.token.staff_id, // Backend may not return name
        }));
    }

    return data;
}

/** Logout — clear all session data */
export function logout() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem(USER_KEY);
}

/**
 * Make an authenticated API request
 * @param {string} url - API URL
 * @param {Object} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function authFetch(url, options = {}) {
    const headers = {
        ...authHeaders(),
        ...options.headers,
    };

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
        // Token expired — redirect to login
        logout();
        const user = getCurrentUser();
        if (user?.role === 'patient') {
            window.location.hash = '#/patient-login';
        } else {
            window.location.hash = '#/login';
        }
        throw new Error('Session expired. Please login again.');
    }

    return res;
}

/**
 * Login with patient credentials
 * @param {string} patientId - Patient ID (e.g. PID-10001)
 * @param {string} password - Password
 * @returns {Promise<Object>} Login response with token and patient info
 */
export async function patientLogin(patientId, password) {
    const res = await fetch('/api/auth/patient/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patientId, password }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
        throw new Error(data.detail || data.message || 'Login failed');
    }

    // Store tokens and user data
    if (data.token) {
        sessionStorage.setItem(TOKEN_KEY, data.token.access_token);
        sessionStorage.setItem(REFRESH_KEY, data.token.refresh_token);
        sessionStorage.setItem(USER_KEY, JSON.stringify({
            staff_id: data.token.staff_id,
            role: data.token.role,
            full_name: data.patient?.name || data.token.staff_id,
        }));
    }

    return data;
}

