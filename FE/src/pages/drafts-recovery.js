/**
 * Local Drafts Recovery Page — Queue of unsaved/unsynced clinical notes
 * Matches Stitch "Drafts Recovery" screen
 */
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { renderAppShell } from '../components/app-shell.js';

export async function renderDraftsRecovery() {
  // Mock drafts data
  const drafts = [
    {
      id: 1,
      patient: 'Rajesh Kumar',
      patientId: 'PAT-2851',
      encounter: 'ENC-20260221-001',
      type: 'SOAP Note',
      savedAt: '21 Feb 2026, 10:48 AM',
      reason: 'EMR sync failed',
      size: '2.4 KB',
      sections: 4,
      confidence: 0.87,
    },
    {
      id: 2,
      patient: 'Meena S.',
      patientId: 'PAT-3012',
      encounter: 'ENC-20260220-005',
      type: 'Follow-up Note',
      savedAt: '20 Feb 2026, 4:15 PM',
      reason: 'Session interrupted',
      size: '1.8 KB',
      sections: 3,
      confidence: 0.91,
    },
    {
      id: 3,
      patient: 'Arun P.',
      patientId: 'PAT-2990',
      encounter: 'ENC-20260219-002',
      type: 'SOAP Note',
      savedAt: '19 Feb 2026, 11:30 AM',
      reason: 'Manually saved',
      size: '3.1 KB',
      sections: 4,
      confidence: 0.82,
    },
  ];

  renderAppShell('Local Drafts', `
    <div style="max-width: 900px; margin: 0 auto;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
        <div>
          <h1 style="margin-bottom: 4px;">Local Drafts Recovery</h1>
          <p class="text-sm text-muted">Recover clinical notes saved locally due to sync failures or interruptions.</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary" id="sync-all-btn">
            <span class="material-icons-outlined" style="font-size: 18px;">sync</span>
            Sync All
          </button>
          <button class="btn btn-ghost" id="clear-all-btn" style="color: var(--error);">
            <span class="material-icons-outlined" style="font-size: 18px;">delete_sweep</span>
            Clear All
          </button>
        </div>
      </div>

      <!-- Summary Bar -->
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-body" style="padding: 14px 20px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; gap: 24px;">
            <div>
              <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary-600);">${drafts.length}</div>
              <div class="text-xs text-muted">Drafts Pending</div>
            </div>
            <div>
              <div style="font-size: 1.5rem; font-weight: 800; color: var(--gray-800);">${(drafts.reduce((sum, d) => sum + parseFloat(d.size), 0)).toFixed(1)} KB</div>
              <div class="text-xs text-muted">Total Size</div>
            </div>
          </div>
          <div class="alert alert-warning" style="margin: 0; padding: 8px 14px;">
            <span class="material-icons-outlined" style="font-size: 16px;">info</span>
            <span class="text-sm">Drafts are stored locally and may be lost if browser data is cleared.</span>
          </div>
        </div>
      </div>

      <!-- Drafts List -->
      <div class="drafts-list" style="display: flex; flex-direction: column; gap: 12px;">
        ${drafts.map(draft => `
          <div class="card draft-card" data-id="${draft.id}">
            <div class="card-body" style="padding: 16px 20px;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <div style="display: flex; gap: 16px; align-items: flex-start;">
                  <div style="width: 40px; height: 40px; border-radius: var(--radius-md); background: var(--warning-light); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
                    <span class="material-icons-outlined" style="font-size: 20px; color: #b45309;">description</span>
                  </div>
                  <div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                      <span style="font-weight: 600;">${draft.patient}</span>
                      <span class="badge badge-neutral">${draft.patientId}</span>
                      <span class="badge badge-info">${draft.type}</span>
                    </div>
                    <div class="text-sm text-muted" style="margin-bottom: 8px;">
                      ${draft.encounter} • Saved: ${draft.savedAt}
                    </div>
                    <div style="display: flex; gap: 12px; flex-wrap: wrap;">
                      <span class="text-xs text-muted">
                        <span class="material-icons-outlined" style="font-size: 13px; vertical-align: middle;">warning</span>
                        ${draft.reason}
                      </span>
                      <span class="text-xs text-muted">
                        <span class="material-icons-outlined" style="font-size: 13px; vertical-align: middle;">storage</span>
                        ${draft.size}
                      </span>
                      <span class="text-xs text-muted">
                        <span class="material-icons-outlined" style="font-size: 13px; vertical-align: middle;">article</span>
                        ${draft.sections} sections
                      </span>
                      <div class="confidence-badge ${draft.confidence >= 0.9 ? 'high' : draft.confidence >= 0.8 ? 'medium' : 'low'}">
                        ${Math.round(draft.confidence * 100)}%
                      </div>
                    </div>
                  </div>
                </div>
                <div style="display: flex; gap: 6px; flex-shrink: 0;">
                  <button class="btn btn-sm btn-primary sync-btn" data-id="${draft.id}" title="Sync to EMR">
                    <span class="material-icons-outlined" style="font-size: 16px;">sync</span>
                  </button>
                  <button class="btn btn-sm btn-secondary view-btn" data-id="${draft.id}" title="View Draft">
                    <span class="material-icons-outlined" style="font-size: 16px;">visibility</span>
                  </button>
                  <button class="btn btn-sm btn-ghost delete-btn" data-id="${draft.id}" title="Delete" style="color: var(--error);">
                    <span class="material-icons-outlined" style="font-size: 16px;">delete</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `, '/doctor/drafts');

  // Per-draft actions
  document.querySelectorAll('.sync-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;"></span>';
      await new Promise(r => setTimeout(r, 1500));
      const card = btn.closest('.draft-card');
      card.style.opacity = '0.5';
      showToast('Draft synced to EMR successfully!', 'success');
    });
  });

  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => navigate('/doctor/note-verification'));
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this draft? This cannot be undone.')) {
        btn.closest('.draft-card').remove();
        showToast('Draft deleted', 'info');
      }
    });
  });

  document.getElementById('sync-all-btn')?.addEventListener('click', () => {
    showToast('Syncing all drafts...', 'info');
  });

  document.getElementById('clear-all-btn')?.addEventListener('click', () => {
    if (confirm('Delete ALL local drafts? This cannot be undone.')) {
      showToast('All drafts cleared', 'info');
    }
  });
}
