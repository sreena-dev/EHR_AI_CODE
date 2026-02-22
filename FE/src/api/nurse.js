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

    const data = await res.json();

    if (!res.ok) {
        throw new Error(data.detail || 'OCR processing failed');
    }

    return data;
}
