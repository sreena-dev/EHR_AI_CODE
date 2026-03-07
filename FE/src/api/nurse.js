/**
 * AIRA Clinical Workflow — Nurse API Service
 * Handles OCR prescription upload and results.
 */
import { authFetch, authHeaders } from './auth.js';

/**
 * Upload a prescription image for OCR processing
 * @param {Object} params
 * @param {File} params.image - Prescription image file
 * @param {string} params.encounterId - Clinical encounter ID
 * @param {string} params.patientId - Patient ID
 * @param {string} params.capturedBy - Staff ID of nurse
 * @param {string} [params.languageHint='auto'] - Language hint
 * @returns {Promise<Object>} OCR result response
 */
export async function uploadPrescription({ image, encounterId, patientId, capturedBy, languageHint = 'auto' }) {
    const formData = new FormData();
    formData.append('image', image);
    formData.append('encounter_id', encounterId);
    formData.append('patient_id', patientId);
    formData.append('captured_by', capturedBy);
    formData.append('language_hint', languageHint);

    const res = await authFetch('/api/nurse/ocr', {
        method: 'POST',
        body: formData,
        // Don't set Content-Type — browser will set multipart boundary
    });

    // Safely parse response body (may be empty if server crashed)
    let data;
    const text = await res.text();
    try {
        data = text ? JSON.parse(text) : null;
    } catch {
        // Response body wasn't valid JSON
        throw new Error('Server returned an invalid response. The OCR service may have crashed — please try again.');
    }

    if (!res.ok) {
        throw new Error(data?.detail || 'OCR processing failed');
    }

    if (!data) {
        throw new Error('Server returned an empty response. Please try again.');
    }

    return data;
}

/**
 * Fetch dashboard stats (encounters + counts) for the nurse dashboard
 * @returns {Promise<{encounters: Array, counts: {total, pending_ocr, requires_review, completed}}>}
 */
export async function fetchDashboardStats() {
    const res = await authFetch('/api/nurse/dashboard-stats');

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to load dashboard stats');
    }

    return res.json();
}

/**
 * Fetch patient queue data (patients + counts)
 * @returns {Promise<{patients: Array, counts: {total, waiting, in_progress, completed}}>}
 */
export async function fetchQueueStats() {
    const res = await authFetch('/api/nurse/queue-stats');

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to load queue data');
    }

    return res.json();
}

/**
 * Search patient registry by name, ID, or phone
 * @param {string} query
 * @returns {Promise<{patients: Array}>}
 */
export async function searchPatients(query = '') {
    const res = await authFetch(`/api/nurse/patients/search?q=${encodeURIComponent(query)}`);

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Patient search failed');
    }

    return res.json();
}

/**
 * Register a new patient
 * @param {{name:string, age:number, gender:string, phone:string, address:string, force?:boolean}} data
 * @returns {Promise<{patient: Object, message: string}>}
 */
export async function registerPatient(data) {
    const res = await authFetch('/api/nurse/patients/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    if (res.status === 409) {
        // Duplicate detected — return structured error so UI can prompt
        const body = await res.json().catch(() => ({}));
        const err = new Error(body.detail || 'Duplicate patient found');
        err.duplicate = true;
        err.existingPatient = body.existing_patient || null;
        throw err;
    }

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Patient registration failed');
    }

    return res.json();
}

/**
 * Create a new encounter and add it to the patient queue on the backend
 * @param {{patient_name:string, patient_id:string, type:string, status:string, age:number|string, gender:string, doctor:string}} data
 * @returns {Promise<{encounter: Object, message: string}>}
 */
export async function createEncounter(data) {
    const res = await authFetch('/api/nurse/encounters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to create encounter');
    }

    return res.json();
}

/**
 * Save vital measurements to the database
 * @param {{
 *   encounter_id: string,
 *   patient_id: string,
 *   recorded_by?: string,
 *   temperature?: number,
 *   pulse?: number,
 *   bp_systolic?: number,
 *   bp_diastolic?: number,
 *   resp_rate?: number,
 *   spo2?: number,
 *   weight?: number,
 *   height?: number,
 *   notes?: string
 * }} data
 * @returns {Promise<{message: string, vitals_id: number}>}
 */
export async function saveVitals(data) {
    const res = await authFetch('/api/nurse/vitals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || 'Failed to save vitals');
    }

    return res.json();
}
