/**
 * Admin Audit Trail — AIRA Clinical Workflow
 * HIPAA compliance audit log viewer with timestamped activities.
 */
import { renderAppShell } from '../components/app-shell.js';
import { fetchAuditLog } from '../api/admin.js';

/* ── Action type badge mapping ── */
const ACTION_BADGE = {
    'Waiting': { cls: 'badge-warning', icon: 'hourglass_top' },
    'Checked In': { cls: 'badge-info', icon: 'how_to_reg' },
    'In Consultation': { cls: 'badge-primary', icon: 'mic' },
    'OCR Processing': { cls: 'badge-info', icon: 'document_scanner' },
    'Pending OCR': { cls: 'badge-warning', icon: 'document_scanner' },
    'Requires Review': { cls: 'badge-error', icon: 'rate_review' },
    'Completed': { cls: 'badge-success', icon: 'check_circle' },
    'Ready for Consult': { cls: 'badge-success', icon: 'event_available' },
};

export async function renderAdminAudit() {
    const bodyHTML = `
    <!-- Header -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
      <div>
        <h2 style="font-size: 1.5rem; font-weight: 700;">Audit Trail</h2>
        <p class="text-muted">HIPAA-compliant activity log of all workflow state transitions.</p>
      </div>
      <div style="display:flex; gap:8px; align-items:center;">
        <span class="badge badge-success">
          <span class="material-icons-outlined" style="font-size:14px;">verified_user</span>
          HIPAA Compliant
        </span>
        <select id="audit-limit" class="form-select" style="padding:6px 12px; font-size:0.8125rem; width:auto;">
          <option value="25">Last 25</option>
          <option value="50" selected>Last 50</option>
          <option value="100">Last 100</option>
          <option value="250">Last 250</option>
        </select>
        <button class="btn btn-secondary btn-sm" id="btn-refresh">
          <span class="material-icons-outlined" style="font-size:16px;">refresh</span>
          Refresh
        </button>
      </div>
    </div>

    <!-- Audit Log Table -->
    <div class="card">
      <div class="card-header">
        <h3 style="font-size:1rem; margin:0;">
          <span class="material-icons-outlined" style="font-size:20px; vertical-align:middle;">history</span>
          Activity Log
        </h3>
        <span id="audit-count" class="badge badge-neutral" style="font-size:0.75rem;">Loading…</span>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Encounter</th>
              <th>From State</th>
              <th>To State</th>
              <th>Triggered By</th>
              <th>Notes</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody id="audit-body">
            <tr>
              <td colspan="7" style="text-align:center; padding:32px; color:var(--gray-400);">
                <span class="spinner" style="margin-right:8px;"></span> Loading audit trail…
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

    renderAppShell('Audit Trail', bodyHTML, '/admin/audit');

    const tbody = document.getElementById('audit-body');
    const countBadge = document.getElementById('audit-count');

    /* ── Load audit entries ── */
    async function loadAudit(limit = 50) {
        tbody.innerHTML = `
      <tr><td colspan="7" style="text-align:center; padding:32px; color:var(--gray-400);">
        <span class="spinner" style="margin-right:8px;"></span> Loading audit trail…
      </td></tr>`;

        try {
            const data = await fetchAuditLog(limit);
            const entries = data.audit_log || [];
            countBadge.textContent = `${entries.length} entr${entries.length !== 1 ? 'ies' : 'y'}`;

            if (entries.length === 0) {
                tbody.innerHTML = `
          <tr><td colspan="7" style="text-align:center; padding:32px; color:var(--gray-400);">
            <span class="material-icons-outlined" style="font-size:24px; display:block; margin-bottom:8px;">playlist_remove</span>
            No audit entries found. Activities will appear here as staff interact with the system.
          </td></tr>`;
                return;
            }

            tbody.innerHTML = entries.map(entry => {
                const ts = entry.timestamp
                    ? new Date(entry.timestamp).toLocaleString('en-IN', {
                        year: 'numeric', month: 'short', day: 'numeric',
                        hour: '2-digit', minute: '2-digit', second: '2-digit',
                    })
                    : '—';

                const fromBadge = ACTION_BADGE[entry.from_state] || { cls: 'badge-neutral', icon: 'arrow_back' };
                const toBadge = ACTION_BADGE[entry.to_state] || { cls: 'badge-neutral', icon: 'arrow_forward' };

                const flags = (entry.safety_flags || []);
                const flagsHTML = flags.length > 0
                    ? flags.map(f => `<span class="badge badge-error" style="font-size:0.65rem;">${f}</span>`).join(' ')
                    : '<span class="text-muted text-xs">—</span>';

                return `
          <tr>
            <td class="text-sm" style="white-space:nowrap;">${ts}</td>
            <td><strong>${entry.encounter_id}</strong></td>
            <td><span class="badge ${fromBadge.cls}" style="font-size:0.7rem;">
              <span class="material-icons-outlined" style="font-size:12px;">${fromBadge.icon}</span>
              ${entry.from_state}
            </span></td>
            <td><span class="badge ${toBadge.cls}" style="font-size:0.7rem;">
              <span class="material-icons-outlined" style="font-size:12px;">${toBadge.icon}</span>
              ${entry.to_state}
            </span></td>
            <td class="text-sm">${entry.triggered_by}</td>
            <td class="text-muted text-sm" style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${entry.notes || ''}">${entry.notes || '—'}</td>
            <td>${flagsHTML}</td>
          </tr>`;
            }).join('');
        } catch (err) {
            console.error('Audit load error:', err);
            tbody.innerHTML = `
        <tr><td colspan="7" style="text-align:center; padding:24px; color:var(--error);">
          <span class="material-icons-outlined" style="font-size:20px;vertical-align:middle;">error</span>
          Failed to load audit trail — ${err.message}
        </td></tr>`;
        }
    }

    // Initial load
    await loadAudit(50);

    /* ── Refresh & limit controls ── */
    document.getElementById('btn-refresh').addEventListener('click', () => {
        const limit = parseInt(document.getElementById('audit-limit').value, 10);
        loadAudit(limit);
    });

    document.getElementById('audit-limit').addEventListener('change', (e) => {
        loadAudit(parseInt(e.target.value, 10));
    });
}
