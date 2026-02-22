/**
 * AIRA Clinical Workflow — Doctor API Service
 * Handles transcription, note generation, and verification.
 */
import { authFetch } from './auth.js';

/**
 * Transcribe consultation audio
 * @param {Object} params
 * @param {File} params.audio - Audio file (WAV/MP3)
 * @param {string} params.encounterId - Encounter ID
 * @param {string} params.patientId - Patient ID
 * @param {string} [params.languageHint] - Language hint
 * @returns {Promise<Object>} Transcription result
 */
export async function transcribeAudio({ audio, encounterId, patientId, languageHint }) {
    const formData = new FormData();
    formData.append('audio', audio);
    formData.append('encounter_id', encounterId);
    formData.append('patient_id', patientId);
    if (languageHint) formData.append('language_hint', languageHint);

    const res = await authFetch('/api/doctor/transcribe', {
        method: 'POST',
        body: formData,
    });

    const data = await res.json();
    if (!res.ok && res.status !== 202) {
        throw new Error(data.detail || 'Transcription failed');
    }
    return data;
}

/**
 * Generate clinical note draft from transcript + OCR data
 * @param {string} encounterId
 * @param {string} patientId
 * @returns {Promise<Object>} Generated note draft
 */
export async function generateNote(encounterId, patientId) {
    const formData = new FormData();
    formData.append('encounter_id', encounterId);
    formData.append('patient_id', patientId);

    const res = await authFetch('/api/doctor/generate-note', {
        method: 'POST',
        body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.detail || 'Note generation failed');
    }
    return data;
}

/**
 * Verify and save clinical note to EMR
 * @param {string} encounterId
 * @param {string} patientId
 * @param {string} verifiedNote - Doctor-approved note text
 * @returns {Promise<Object>} Verification result
 */
export async function verifyNote(encounterId, patientId, verifiedNote) {
    const formData = new FormData();
    formData.append('encounter_id', encounterId);
    formData.append('patient_id', patientId);
    formData.append('verified_note', verifiedNote);

    const res = await authFetch('/api/doctor/verify-note', {
        method: 'POST',
        body: formData,
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.detail || 'Note verification failed');
    }
    return data;
}
