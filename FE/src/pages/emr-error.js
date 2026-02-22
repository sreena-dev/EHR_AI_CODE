/**
 * EMR Sync Error Page — Error state for EMR sync failures
 * Matches Stitch "EMR Sync Failure Error" screen
 */
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { renderAppShell } from '../components/app-shell.js';

export async function renderEMRError() {

    // Mock error data
    const error = {
        code: 'EMR-SYNC-5003',
        timestamp: '21 Feb 2026, 10:48:22 AM',
        patient: 'Rajesh Kumar',
        patientId: 'PAT-2851',
        encounter: 'ENC-20260221-001',
        noteType: 'SOAP Clinical Note',
        message: 'Connection to EMR server timed out after 30 seconds. The clinical note was saved locally but could not be synced to the central EMR system.',
        retries: 3,
    };

    renderAppShell('EMR Sync Error', `
    <div class="page-content" style="display: flex; justify-content: center;">
      <div style="max-width: 640px; width: 100%; padding-top: 32px;">
        <!-- Error Icon -->
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="width: 80px; height: 80px; border-radius: 50%; background: var(--error-light); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px;">
            <span class="material-icons-outlined" style="font-size: 40px; color: var(--error);">sync_problem</span>
          </div>
          <h1 style="margin-bottom: 8px; color: var(--error);">EMR Sync Failed</h1>
          <p class="text-muted">The clinical note could not be saved to the EMR system. Your data is safe — it has been saved locally.</p>
        </div>

        <!-- Error Details Card -->
        <div class="card" style="margin-bottom: 20px; border-color: var(--error); border-width: 1.5px;">
          <div class="card-header" style="background: var(--error-light); border-bottom: 1px solid #fecaca;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="material-icons-outlined" style="font-size: 18px; color: var(--error);">error_outline</span>
              <span style="font-weight: 600; color: var(--error);">Error Details</span>
            </div>
            <span class="badge badge-error">${error.code}</span>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="summary-row">
              <span class="summary-label">Timestamp</span>
              <span class="summary-value">${error.timestamp}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Patient</span>
              <span class="summary-value">${error.patient} (${error.patientId})</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Encounter</span>
              <span class="summary-value">${error.encounter}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Note Type</span>
              <span class="summary-value">${error.noteType}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Retry Attempts</span>
              <span class="summary-value" style="color: var(--error);">${error.retries} failed</span>
            </div>
          </div>
        </div>

        <!-- Error Message -->
        <div class="alert alert-warning" style="margin-bottom: 24px;">
          <span class="material-icons-outlined" style="font-size: 18px;">info</span>
          <div>
            <span style="font-weight: 600;">What happened:</span>
            <p style="margin-top: 4px; font-size: 0.8125rem;">${error.message}</p>
          </div>
        </div>

        <!-- Actions -->
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button class="btn btn-primary btn-lg btn-block" id="retry-sync-btn">
            <span class="material-icons-outlined" style="font-size: 18px;">sync</span>
            Retry Sync Now
          </button>
          <button class="btn btn-secondary btn-block" id="save-local-btn">
            <span class="material-icons-outlined" style="font-size: 18px;">save</span>
            Save as Local Draft
          </button>
          <button class="btn btn-ghost btn-block" id="export-btn">
            <span class="material-icons-outlined" style="font-size: 18px;">download</span>
            Export as PDF
          </button>
        </div>

        <!-- Help -->
        <div class="card" style="margin-top: 24px; background: var(--gray-50);">
          <div class="card-body" style="padding: 16px 20px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <span class="material-icons-outlined" style="font-size: 18px; color: var(--info);">support_agent</span>
              <span style="font-weight: 600; font-size: 0.875rem;">Need Help?</span>
            </div>
            <p class="text-sm text-muted" style="margin-bottom: 8px;">
              If this issue persists, contact IT support with the error code above.
            </p>
            <div style="display: flex; gap: 16px;">
              <a href="#" style="font-size: 0.8125rem; display: flex; align-items: center; gap: 4px;">
                <span class="material-icons-outlined" style="font-size: 14px;">phone</span>
                ext-555
              </a>
              <a href="mailto:it-support@clinic.org" style="font-size: 0.8125rem; display: flex; align-items: center; gap: 4px;">
                <span class="material-icons-outlined" style="font-size: 14px;">email</span>
                it-support@clinic.org
              </a>
            </div>
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px;">
          <a href="#/doctor/dashboard" style="font-size: 0.875rem; display: inline-flex; align-items: center; gap: 4px; color: var(--gray-500);">
            <span class="material-icons-outlined" style="font-size: 16px;">arrow_back</span>
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  `, '/doctor/notes');

    // Retry sync
    document.getElementById('retry-sync-btn').addEventListener('click', async () => {
        const btn = document.getElementById('retry-sync-btn');
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> Retrying...';

        await new Promise(r => setTimeout(r, 2000));

        // Simulate random success/failure
        if (Math.random() > 0.5) {
            showToast('EMR sync successful!', 'success');
            setTimeout(() => navigate('/doctor/dashboard'), 1000);
        } else {
            showToast('Sync failed again — try later or save locally', 'error');
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-outlined" style="font-size: 18px;">sync</span> Retry Sync Now';
        }
    });

    document.getElementById('save-local-btn').addEventListener('click', () => {
        showToast('Note saved as local draft', 'success');
    });

    document.getElementById('export-btn').addEventListener('click', () => {
        showToast('PDF export coming soon', 'info');
    });
}
