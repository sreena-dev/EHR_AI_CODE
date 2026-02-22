/**
 * EMR Save Confirmation — Success page after note saved to EMR
 * Matches Stitch "EMR Save Confirmation" screen
 */
import { navigate } from '../router.js';
import { renderAppShell } from '../components/app-shell.js';

export async function renderEMRSuccess() {
    const saveData = {
        patient: 'Harold Finch',
        patientId: 'PAT-4281',
        encounterId: 'ENC-20260221-012',
        verifiedBy: 'Dr. Anand Krishnamurthy',
        timestamp: '21 Feb 2026, 10:58 AM',
        noteId: 'NOTE-20260221-047',
        activityLog: [
            { time: '10:58 AM', action: 'Clinical note verified and signed', icon: 'verified', color: 'var(--success)' },
            { time: '10:58 AM', action: 'EMR sync initiated', icon: 'sync', color: 'var(--primary-500)' },
            { time: '10:58 AM', action: 'Master Patient Index matched', icon: 'people', color: 'var(--info)' },
            { time: '10:58 AM', action: 'Note saved to EMR successfully', icon: 'check_circle', color: 'var(--success)' },
            { time: '10:58 AM', action: 'Audit trail recorded', icon: 'history', color: 'var(--gray-500)' },
        ],
    };

    renderAppShell('EMR Confirmation', `
    <div style="max-width: 640px; margin: 0 auto; padding-top: 24px;">
      <!-- Success Icon -->
      <div style="text-align: center; margin-bottom: 28px;">
        <div style="width: 72px; height: 72px; border-radius: 50%; background: var(--success-light); display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px;">
          <span class="material-icons-outlined" style="font-size: 40px; color: var(--success);">check_circle</span>
        </div>
        <h1 style="margin-bottom: 4px;">Note Successfully Saved to EMR</h1>
        <p class="text-sm text-muted">The clinical documentation has been synchronized and verified against the master patient index.</p>
      </div>

      <!-- Save Details -->
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-body" style="padding: 0;">
          <div class="summary-row">
            <span class="summary-label">Patient</span>
            <span class="summary-value" style="font-weight: 600;">${saveData.patient} <span class="badge badge-neutral">${saveData.patientId}</span></span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Encounter ID</span>
            <span class="summary-value">${saveData.encounterId}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Note ID</span>
            <span class="summary-value" style="color: var(--primary-600); font-weight: 600;">${saveData.noteId}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Verified By</span>
            <span class="summary-value">${saveData.verifiedBy}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">Timestamp</span>
            <span class="summary-value">${saveData.timestamp}</span>
          </div>
        </div>
      </div>

      <!-- Activity Log -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <h3 style="margin:0; display: flex; align-items: center; gap: 8px;">
            <span class="material-icons-outlined" style="font-size: 18px; color: var(--gray-500);">history</span>
            Recent Activity Log
          </h3>
        </div>
        <div class="card-body" style="display: flex; flex-direction: column; gap: 12px;">
          ${saveData.activityLog.map(entry => `
            <div style="display: flex; align-items: center; gap: 12px;">
              <span class="material-icons-outlined" style="font-size: 20px; color: ${entry.color};">${entry.icon}</span>
              <div style="flex: 1;">
                <span class="text-sm">${entry.action}</span>
              </div>
              <span class="text-xs text-muted">${entry.time}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Actions -->
      <div style="display: flex; gap: 12px; justify-content: center;">
        <a href="#/doctor/dashboard" class="btn btn-primary" style="text-decoration: none;">
          <span class="material-icons-outlined" style="font-size: 18px;">dashboard</span>
          Back to Dashboard
        </a>
        <button class="btn btn-secondary" id="view-note-btn">
          <span class="material-icons-outlined" style="font-size: 18px;">description</span>
          View Saved Note
        </button>
      </div>
    </div>
  `, '/doctor/notes');

    document.getElementById('view-note-btn')?.addEventListener('click', () => {
        navigate('/doctor/note-verification');
    });
}
