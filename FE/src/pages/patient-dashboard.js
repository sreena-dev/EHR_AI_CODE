/**
 * Patient Dashboard — Patient Portal Home Page
 * Shows patient profile summary, recent visits, and quick actions.
 * HIPAA-compliant: only shows the authenticated patient's own data.
 */
import { renderAppShell } from '../components/app-shell.js';
import { getCurrentUser, authFetch } from '../api/auth.js';

export async function renderPatientDashboard() {
    const user = getCurrentUser();
    const name = user?.full_name || user?.staff_id || 'Patient';
    const patientId = user?.staff_id || '';

    /* ── Build page body ── */
    const bodyHTML = `
    <!-- Greeting -->
    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 1.5rem; font-weight: 700;">Good ${getGreeting()}, ${name}</h2>
      <p class="text-muted">Welcome to your Patient Portal. View your health records and manage your information securely.</p>
    </div>

    <!-- Patient Info Card -->
    <div class="stats-grid" style="margin-bottom: 24px;">
      <div class="stat-card active">
        <div class="stat-icon blue">
          <span class="material-icons-outlined">badge</span>
        </div>
        <div>
          <div class="stat-value" style="font-size: 1rem;">${patientId}</div>
          <div class="stat-label">Patient ID</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green">
          <span class="material-icons-outlined">verified_user</span>
        </div>
        <div>
          <div class="stat-value" style="font-size: 1rem;">Active</div>
          <div class="stat-label">Account Status</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange">
          <span class="material-icons-outlined">event</span>
        </div>
        <div>
          <div class="stat-value" id="val-encounters"><span class="spinner"></span></div>
          <div class="stat-label">Total Visits</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red">
          <span class="material-icons-outlined">favorite</span>
        </div>
        <div>
          <div class="stat-value" id="val-vitals"><span class="spinner"></span></div>
          <div class="stat-label">Vitals Recorded</div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div style="display:flex; flex-direction:row; gap:16px; margin-bottom:24px; max-width: 500px;">
      <a href="#/patient/profile" class="btn btn-primary" style="height: 48px; flex:1;">
        <span class="material-icons-outlined" style="font-size:18px">person</span>
        My Profile
      </a>
      <a href="#/patient/records" class="btn btn-primary" style="height: 48px; flex:1;">
        <span class="material-icons-outlined" style="font-size:18px">description</span>
        Health Records
      </a>
    </div>

    <!-- Recent Visits -->
    <div class="card">
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
        <h3 style="font-size:1rem; margin:0;">
          <span class="material-icons-outlined" style="font-size:20px; vertical-align:middle;">history</span>
          Recent Visits
        </h3>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Visit ID</th>
              <th>Date</th>
              <th>Doctor</th>
              <th>Reason</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody id="visits-body">
            <tr>
              <td colspan="5" style="text-align:center; padding:32px; color:var(--gray-400);">
                <span class="spinner" style="margin-right:8px;"></span> Loading your visit history…
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Health Summary -->
    <div class="card" style="margin-top: 24px;">
      <div class="card-header">
        <h3 style="font-size:1rem; margin:0;">
          <span class="material-icons-outlined" style="font-size:20px; vertical-align:middle;">monitor_heart</span>
          Latest Vitals
        </h3>
      </div>
      <div id="vitals-summary" style="padding: 24px; text-align: center; color: var(--gray-400);">
        <span class="spinner" style="margin-right:8px;"></span> Loading vitals…
      </div>
    </div>
  `;

    renderAppShell('Patient Dashboard', bodyHTML, '/patient/dashboard');

    /* ── Fetch patient data ── */
    let encounterCount = 0;
    let vitalsCount = 0;

    try {
        const res = await authFetch(`/api/nurse/encounters?patient_id=${encodeURIComponent(patientId)}`);
        if (res.ok) {
            const data = await res.json();
            const encounters = data.encounters || data || [];
            encounterCount = Array.isArray(encounters) ? encounters.length : 0;

            const tbody = document.getElementById('visits-body');
            if (encounterCount === 0) {
                tbody.innerHTML = `
          <tr><td colspan="5" style="text-align:center; padding:24px; color:var(--gray-400);">
            <span class="material-icons-outlined" style="font-size:28px; display:block; margin-bottom:8px;">event_busy</span>
            No visits recorded yet.
          </td></tr>`;
            } else {
                const recent = encounters.slice(0, 10);
                tbody.innerHTML = recent.map(e => `
          <tr>
            <td><strong>${e.id || e.encounter_id || '—'}</strong></td>
            <td>${e.created_at ? new Date(e.created_at).toLocaleDateString() : e.time || '—'}</td>
            <td>${e.doctor_id || e.doctor_name || '—'}</td>
            <td>${e.reason || e.type || '—'}</td>
            <td><span class="badge ${e.status === 'completed' ? 'badge-success' : 'badge-warning'}">${e.status || '—'}</span></td>
          </tr>
        `).join('');
            }
        }
    } catch (err) {
        console.error('Failed to load encounters:', err);
        const tbody = document.getElementById('visits-body');
        if (tbody) {
            tbody.innerHTML = `
        <tr><td colspan="5" style="text-align:center; padding:24px; color:var(--gray-400);">
          <span class="material-icons-outlined" style="font-size:28px; display:block; margin-bottom:8px;">cloud_off</span>
          Could not load visit history.
        </td></tr>`;
        }
    }

    /* ── Fetch vitals ── */
    try {
        const vRes = await authFetch(`/api/nurse/vitals/${encodeURIComponent(patientId)}`);
        if (vRes.ok) {
            const vData = await vRes.json();
            const vitals = vData.vitals || vData || [];
            vitalsCount = Array.isArray(vitals) ? vitals.length : 0;

            const vitalsDiv = document.getElementById('vitals-summary');
            if (vitalsCount > 0) {
                const latest = vitals[vitals.length - 1];
                vitalsDiv.innerHTML = `
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap:16px; text-align:center;">
            ${latest.bp ? `<div><div style="font-size:0.75rem; color:var(--gray-500);">Blood Pressure</div><div style="font-size:1.25rem; font-weight:700;">${latest.bp}</div></div>` : ''}
            ${latest.heart_rate ? `<div><div style="font-size:0.75rem; color:var(--gray-500);">Heart Rate</div><div style="font-size:1.25rem; font-weight:700;">${latest.heart_rate} bpm</div></div>` : ''}
            ${latest.temperature ? `<div><div style="font-size:0.75rem; color:var(--gray-500);">Temperature</div><div style="font-size:1.25rem; font-weight:700;">${latest.temperature}°F</div></div>` : ''}
            ${latest.spo2 ? `<div><div style="font-size:0.75rem; color:var(--gray-500);">SpO₂</div><div style="font-size:1.25rem; font-weight:700;">${latest.spo2}%</div></div>` : ''}
            ${latest.weight ? `<div><div style="font-size:0.75rem; color:var(--gray-500);">Weight</div><div style="font-size:1.25rem; font-weight:700;">${latest.weight} kg</div></div>` : ''}
          </div>
          <p style="margin-top:12px; font-size:0.8125rem; color:var(--gray-400);">
            Last recorded: ${latest.recorded_at ? new Date(latest.recorded_at).toLocaleDateString() : 'Unknown'}
          </p>
        `;
            } else {
                vitalsDiv.innerHTML = `
          <div style="padding:16px; color:var(--gray-400);">
            <span class="material-icons-outlined" style="font-size:28px; display:block; margin-bottom:8px;">monitor_heart</span>
            No vitals recorded yet.
          </div>`;
            }
        }
    } catch (err) {
        console.error('Failed to load vitals:', err);
        const vitalsDiv = document.getElementById('vitals-summary');
        if (vitalsDiv) {
            vitalsDiv.innerHTML = `<div style="padding:16px; color:var(--gray-400);">Could not load vitals.</div>`;
        }
    }

    /* ── Update stat cards ── */
    const elEncounters = document.getElementById('val-encounters');
    const elVitals = document.getElementById('val-vitals');
    if (elEncounters) elEncounters.textContent = encounterCount;
    if (elVitals) elVitals.textContent = vitalsCount;
}

function getGreeting() {
    const h = new Date().getHours();
    if (h < 12) return 'Morning';
    if (h < 17) return 'Afternoon';
    return 'Evening';
}
