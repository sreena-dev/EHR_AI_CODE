/**
 * AIRA Clinical Workflow — Admin API Service
 * Handles admin dashboard stats, staff management, encounters, and audit log.
 */
import { authFetch } from './auth.js';

/**
 * Fetch admin dashboard KPI stats
 * @returns {Promise<{encounters, staff, patients, alerts}>}
 */
export async function fetchAdminDashboardStats() {
    const res = await authFetch('/api/admin/dashboard-stats');
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to load admin dashboard stats');
    }
    return res.json();
}

/**
 * Fetch all staff members
 * @returns {Promise<{staff: Array, total: number}>}
 */
export async function fetchAllStaff() {
    const res = await authFetch('/api/admin/staff');
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to load staff list');
    }
    return res.json();
}

/**
 * Create a new staff member
 * @param {{staff_id, full_name, role, password, department?}} data
 * @returns {Promise<{message, staff}>}
 */
export async function createStaff(data) {
    const res = await authFetch('/api/admin/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create staff member');
    }
    return res.json();
}

/**
 * Update a staff member's profile
 * @param {string} staffId
 * @param {{full_name?, role?, department?, status?}} data
 * @returns {Promise<{message, staff}>}
 */
export async function updateStaff(staffId, data) {
    const res = await authFetch(`/api/admin/staff/${encodeURIComponent(staffId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to update staff member');
    }
    return res.json();
}

/**
 * Fetch all encounters with optional filters
 * @param {{status?, doctor?, date_from?, date_to?, limit?}} filters
 * @returns {Promise<{encounters: Array, total: number}>}
 */
export async function fetchAllEncounters(filters = {}) {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.doctor) params.set('doctor', filters.doctor);
    if (filters.date_from) params.set('date_from', filters.date_from);
    if (filters.date_to) params.set('date_to', filters.date_to);
    if (filters.limit) params.set('limit', String(filters.limit));

    const qs = params.toString();
    const url = `/api/admin/encounters${qs ? `?${qs}` : ''}`;

    const res = await authFetch(url);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to load encounters');
    }
    return res.json();
}

/**
 * Fetch audit trail log
 * @param {number} [limit=50]
 * @returns {Promise<{audit_log: Array, total: number}>}
 */
export async function fetchAuditLog(limit = 50) {
    const res = await authFetch(`/api/admin/audit-log?limit=${limit}`);
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to load audit log');
    }
    return res.json();
}
