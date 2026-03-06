/**
 * Admin Encounters — AIRA Clinical Workflow
 * Global encounter oversight with filters and search.
 */
import { renderAppShell } from '../components/app-shell.js';
import { fetchAllEncounters } from '../api/admin.js';

/* ── Status → badge mapping ── */
const STATUS_BADGE = {
    'Waiting': 'badge-warning',
    'Checked In': 'badge-warning',
    'In Consultation': 'badge-primary',
    'OCR Processing': 'badge-info',
    'Pending OCR': 'badge-warning',
    'Requires Review': 'badge-error',
    'Completed': 'badge-success',
    'Ready for Consult': 'badge-success',
};

const TYPE_BADGE = {
    'Prescription OCR': 'badge-primary',
    'Lab Report': 'badge-info',
    'Vitals Entry': 'badge-success',
    'Patient Registration': 'badge-neutral',
    'Standard Consult': 'badge-primary',
};

export async function renderAdminEncounters() {
    const bodyHTML = `
    <!-- Header -->
    <div style="margin-bottom:24px;">
      <h2 style="font-size: 1.5rem; font-weight: 700;">Encounter Oversight</h2>
      <p class="text-muted">View and monitor all patient encounters across the clinic.</p>
    </div>

    <!-- Filters -->
    <div class="card" style="margin-bottom:16px;">
      <div class="card-body" style="display:flex; gap:12px; flex-wrap:wrap; align-items:end;">
        <div class="form-group" style="min-width:150px;">
          <label class="form-label text-xs">Status</label>
          <select id="filter-status" class="form-select" style="padding:8px 12px; font-size:0.8125rem;">
            <option value="">All Statuses</option>
            <option value="Waiting">Waiting</option>
            <option value="Checked In">Checked In</option>
            <option value="In Consultation">In Consultation</option>
            <option value="Pending OCR">Pending OCR</option>
            <option value="Requires Review">Requires Review</option>
            <option value="Completed">Completed</option>
          </select>
        </div>
        <div class="form-group" style="min-width:140px;">
          <label class="form-label text-xs">From Date</label>
          <input type="date" id="filter-from" class="form-input" style="padding:8px 12px; font-size:0.8125rem;">
        </div>
        <div class="form-group" style="min-width:140px;">
          <label class="form-label text-xs">To Date</label>
          <input type="date" id="filter-to" class="form-input" style="padding:8px 12px; font-size:0.8125rem;">
        </div>
        <button class="btn btn-primary btn-sm" id="btn-apply-filters" style="height:38px;">
          <span class="material-icons-outlined" style="font-size:16px;">filter_alt</span>
          Apply
        </button>
        <button class="btn btn-ghost btn-sm" id="btn-clear-filters" style="height:38px;">
          Clear
        </button>
      </div>
    </div>

    <!-- Encounters Table -->
    <div class="card">
      <div class="card-header">
        <h3 style="font-size:1rem; margin:0;">
          <span class="material-icons-outlined" style="font-size:20px; vertical-align:middle;">assignment</span>
          All Encounters
        </h3>
        <span id="enc-count" class="badge badge-neutral" style="font-size:0.75rem;">Loading…</span>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Encounter ID</th>
              <th>Patient</th>
              <th>Doctor</th>
              <th>Type</th>
              <th>Status</th>
              <th>Complaint</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody id="enc-body">
            <tr>
              <td colspan="7" style="text-align:center; padding:32px; color:var(--gray-400);">
                <span class="spinner" style="margin-right:8px;"></span> Loading encounters…
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

    renderAppShell('Encounter Oversight', bodyHTML, '/admin/encounters');

    const tbody = document.getElementById('enc-body');
    const countBadge = document.getElementById('enc-count');

    /* ── Load and render encounters ── */
    async function loadEncounters(filters = {}) {
        tbody.innerHTML = `
      <tr><td colspan="7" style="text-align:center; padding:32px; color:var(--gray-400);">
        <span class="spinner" style="margin-right:8px;"></span> Loading encounters…
      </td></tr>`;

        try {
            const data = await fetchAllEncounters(filters);
            const encounters = data.encounters || [];
            countBadge.textContent = `${encounters.length} encounter${encounters.length !== 1 ? 's' : ''}`;

            if (encounters.length === 0) {
                tbody.innerHTML = `
          <tr><td colspan="7" style="text-align:center; padding:32px; color:var(--gray-400);">
            <span class="material-icons-outlined" style="font-size:24px; display:block; margin-bottom:8px;">folder_open</span>
            No encounters match the selected filters.
          </td></tr>`;
                return;
            }

            tbody.innerHTML = encounters.map(e => {
                const sBadge = STATUS_BADGE[e.status] || 'badge-neutral';
                const tBadge = TYPE_BADGE[e.type] || 'badge-neutral';
                const created = e.created_at
                    ? new Date(e.created_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                    : '—';

                return `
          <tr>
            <td><strong>${e.id}</strong></td>
            <td>${e.patient_name}</td>
            <td>${e.doctor_name}</td>
            <td><span class="badge ${tBadge}">${e.type}</span></td>
            <td><span class="badge ${sBadge}">${e.status}</span></td>
            <td class="text-muted text-sm" style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${e.chief_complaint}</td>
            <td class="text-muted text-sm">${created}</td>
          </tr>`;
            }).join('');
        } catch (err) {
            console.error('Encounters load error:', err);
            tbody.innerHTML = `
        <tr><td colspan="7" style="text-align:center; padding:24px; color:var(--error);">
          <span class="material-icons-outlined" style="font-size:20px;vertical-align:middle;">error</span>
          Failed to load encounters — ${err.message}
        </td></tr>`;
        }
    }

    // Initial load (all encounters)
    await loadEncounters();

    /* ── Filter handlers ── */
    document.getElementById('btn-apply-filters').addEventListener('click', () => {
        const filters = {};
        const status = document.getElementById('filter-status').value;
        const from = document.getElementById('filter-from').value;
        const to = document.getElementById('filter-to').value;

        if (status) filters.status = status;
        if (from) filters.date_from = from;
        if (to) filters.date_to = to;

        loadEncounters(filters);
    });

    document.getElementById('btn-clear-filters').addEventListener('click', () => {
        document.getElementById('filter-status').value = '';
        document.getElementById('filter-from').value = '';
        document.getElementById('filter-to').value = '';
        loadEncounters();
    });
}
