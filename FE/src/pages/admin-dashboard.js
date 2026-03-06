/**
 * Admin Dashboard — AIRA Clinical Workflow
 * KPI overview with stat cards + inline encounters table with card-click filtering.
 * Follows the same design pattern as the nurse dashboard.
 */
import { renderAppShell } from '../components/app-shell.js';
import { getCurrentUser } from '../api/auth.js';
import { fetchAdminDashboardStats } from '../api/admin.js';

/* ── Status → badge class mapping ── */
const BADGE_MAP = {
  'Completed': 'badge-success',
  'OCR Processing': 'badge-warning',
  'Pending OCR': 'badge-warning',
  'In Consultation': 'badge-primary',
  'Waiting': 'badge-neutral',
  'Checked In': 'badge-info',
};

const TYPE_BADGE = {
  'Prescription OCR': 'badge-primary',
  'Lab Report': 'badge-info',
  'Vitals Entry': 'badge-success',
  'Patient Registration': 'badge-neutral',
};

export async function renderAdminDashboard() {
  const user = getCurrentUser();
  const name = user?.full_name || user?.staff_id || 'Admin';

  const bodyHTML = `
    <!-- Greeting -->
    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 1.5rem; font-weight: 700;">Good ${getGreeting()}, ${name}</h2>
      <p class="text-muted">Here's the operational overview of your clinic.</p>
    </div>

    <!-- KPI Stats Grid — 4 cards with click-to-filter -->
    <div class="stats-grid">
      <div class="stat-card active" id="card-total" style="cursor:pointer;" data-filter="all">
        <div class="stat-icon blue">
          <span class="material-icons-outlined">calendar_today</span>
        </div>
        <div>
          <div class="stat-value" id="val-total"><span class="spinner"></span></div>
          <div class="stat-label">Total Encounters</div>
        </div>
      </div>
      <div class="stat-card" id="card-nurses" style="cursor:pointer;" data-filter="nurses">
        <div class="stat-icon orange">
          <span class="material-icons-outlined">medical_services</span>
        </div>
        <div>
          <div class="stat-value" id="val-nurses"><span class="spinner"></span></div>
          <div class="stat-label">Nurses On Duty</div>
        </div>
      </div>
      <div class="stat-card" id="card-doctors" style="cursor:pointer;" data-filter="doctors">
        <div class="stat-icon blue">
          <span class="material-icons-outlined">stethoscope</span>
        </div>
        <div>
          <div class="stat-value" id="val-doctors"><span class="spinner"></span></div>
          <div class="stat-label">Doctors On Duty</div>
        </div>
      </div>
      <div class="stat-card" id="card-completed" style="cursor:pointer;" data-filter="Completed">
        <div class="stat-icon green">
          <span class="material-icons-outlined">check_circle</span>
        </div>
        <div>
          <div class="stat-value" id="val-completed"><span class="spinner"></span></div>
          <div class="stat-label">Completed</div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div style="display:flex; gap:12px; margin-bottom:24px; flex-wrap:wrap; max-width: 600px;">
      <a href="#/admin/staff" class="btn btn-primary" style="height: 48px; flex:1;">
        <span class="material-icons-outlined" style="font-size:18px">people</span>
        Manage Staff
      </a>
      <a href="#/admin/encounters" class="btn btn-primary" style="height: 48px; flex:1;">
        <span class="material-icons-outlined" style="font-size:18px">assignment</span>
        All Encounters
      </a>
      <a href="#/admin/audit" class="btn btn-primary" style="height: 48px; flex:1;">
        <span class="material-icons-outlined" style="font-size:18px">history</span>
        Audit Trail
      </a>
    </div>

    <!-- Alerts Panel -->
    <div class="card" style="margin-bottom: 24px;">
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
        <h3 style="font-size:1rem; margin:0;">
          <span class="material-icons-outlined" style="font-size:20px; vertical-align:middle; color: var(--warning);">notifications_active</span>
          Critical Alerts
        </h3>
        <span id="alert-count" class="badge badge-neutral" style="font-size:0.75rem;">0</span>
      </div>
      <div id="alerts-panel" style="padding: var(--space-md) var(--space-lg);">
        <div style="text-align:center; padding:16px; color:var(--gray-400);">
          <span class="spinner" style="margin-right:8px;"></span> Checking alerts…
        </div>
      </div>
    </div>

    <!-- Recent Encounters Table (inline, filterable by card clicks) -->
    <div class="card" style="margin-bottom: 24px; overflow: visible;">
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
        <h3 style="font-size:1rem; margin:0;">
          <span class="material-icons-outlined" style="font-size:20px; vertical-align:middle;">history</span>
          Recent Encounters
        </h3>
        <span id="filter-label" class="badge badge-neutral" style="font-size:0.75rem;">All</span>
      </div>
      <div style="overflow-x:auto; max-height: 420px; overflow-y:auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Encounter ID</th>
              <th>Patient</th>
              <th>Type</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody id="encounters-body">
            <tr>
              <td colspan="5" style="text-align:center; padding:32px; color:var(--gray-400);">
                <span class="spinner" style="margin-right:8px;"></span> Loading encounters…
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Summary Cards Row -->
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap:16px;">
      <div class="card">
        <div class="card-header">
          <h3 style="font-size:1rem; margin:0;">
            <span class="material-icons-outlined" style="font-size:20px; vertical-align:middle;">groups</span>
            Staff Overview
          </h3>
        </div>
        <div class="card-body">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span class="text-muted text-sm">Total Active Staff</span>
            <strong id="val-staff-total">—</strong>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span class="text-muted text-sm">Nurses</span>
            <span id="val-nurse-detail" class="text-sm">—</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span class="text-muted text-sm">Doctors</span>
            <span id="val-doctor-detail" class="text-sm">—</span>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="text-muted text-sm">Logged In Today</span>
            <span class="badge badge-primary" id="val-staff-duty">—</span>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3 style="font-size:1rem; margin:0;">
            <span class="material-icons-outlined" style="font-size:20px; vertical-align:middle;">person_search</span>
            Patient Registry
          </h3>
        </div>
        <div class="card-body">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
            <span class="text-muted text-sm">Registered Patients</span>
            <strong id="val-patients-total">—</strong>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <span class="text-muted text-sm">Total Encounters</span>
            <span class="badge badge-info" id="val-enc-total">—</span>
          </div>
        </div>
      </div>
    </div>
  `;

  renderAppShell('Admin Dashboard', bodyHTML, '/admin/dashboard');

  /* ── Fetch live data ── */
  let stats = null;
  try {
    stats = await fetchAdminDashboardStats();
  } catch (err) {
    console.error('Admin dashboard error:', err);
    document.getElementById('alerts-panel').innerHTML = `
      <div style="text-align:center; padding:16px; color:var(--error);">
        <span class="material-icons-outlined" style="font-size:20px;vertical-align:middle;">error</span>
        Failed to load dashboard — ${err.message}
      </div>`;
    return;
  }

  /* ── Populate KPI values ── */
  const enc = stats.encounters || {};
  const staff = stats.staff || {};
  const patients = stats.patients || {};
  const encounters = enc.recent || [];

  document.getElementById('val-total').textContent = enc.total || 0;
  document.getElementById('val-nurses').textContent = `${staff.nurses_on_duty || 0} / ${staff.total_nurses || 0}`;
  document.getElementById('val-doctors').textContent = `${staff.doctors_on_duty || 0} / ${staff.total_doctors || 0}`;
  document.getElementById('val-completed').textContent = enc.completed || 0;

  /* ── Staff & Patient summary cards ── */
  document.getElementById('val-staff-total').textContent = staff.total || 0;
  document.getElementById('val-nurse-detail').innerHTML =
    `<span class="badge badge-success">${staff.nurses_on_duty || 0} on duty</span> / ${staff.total_nurses || 0} total`;
  document.getElementById('val-doctor-detail').innerHTML =
    `<span class="badge badge-primary">${staff.doctors_on_duty || 0} on duty</span> / ${staff.total_doctors || 0} total`;
  document.getElementById('val-staff-duty').textContent = staff.on_duty || 0;
  document.getElementById('val-patients-total').textContent = patients.total || 0;
  document.getElementById('val-enc-total').textContent = enc.total || 0;

  /* ── Alerts panel ── */
  const alerts = stats.alerts || [];
  const alertPanel = document.getElementById('alerts-panel');
  const alertCount = document.getElementById('alert-count');

  if (alerts.length === 0) {
    alertPanel.innerHTML = `
      <div style="text-align:center; padding:16px; color:var(--success);">
        <span class="material-icons-outlined" style="font-size:24px; display:block; margin-bottom:8px;">verified</span>
        All clear — no critical alerts at this time.
      </div>`;
    alertCount.textContent = '0';
    alertCount.className = 'badge badge-success';
  } else {
    alertCount.textContent = String(alerts.length);
    alertCount.className = 'badge badge-error';
    alertPanel.innerHTML = alerts.map(a => {
      const icon = a.severity === 'critical' ? 'error' : 'warning';
      const badgeCls = a.severity === 'critical' ? 'badge-error' : 'badge-warning';
      return `
        <div style="display:flex; align-items:center; gap:12px; padding:10px 0; border-bottom:1px solid var(--gray-100);">
          <span class="material-icons-outlined" style="color:var(--${a.severity === 'critical' ? 'error' : 'warning'}); font-size:20px;">${icon}</span>
          <div style="flex:1;">
            <div style="font-size:0.875rem; font-weight:500;">${a.message}</div>
            ${a.encounter_id ? `<span class="text-muted text-xs">Encounter: ${a.encounter_id}</span>` : ''}
          </div>
          <span class="badge ${badgeCls}" style="font-size:0.7rem;">${a.severity}</span>
        </div>`;
    }).join('');
  }

  /* ── Render encounters into inline table ── */
  const tbody = document.getElementById('encounters-body');

  function formatTime(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' })
      + ', ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  }

  function renderTable(filter) {
    const filtered = filter === 'all'
      ? encounters
      : encounters.filter(e => e.status === filter);

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="5" style="text-align:center; padding:24px; color:var(--gray-400);">
          No encounters match the selected filter.
        </td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(e => `
      <tr data-status="${e.status}">
        <td><strong>${e.id}</strong></td>
        <td>${e.patient_name}</td>
        <td><span class="badge ${TYPE_BADGE[e.type] || 'badge-neutral'}">${e.type}</span></td>
        <td><span class="badge ${BADGE_MAP[e.status] || 'badge-neutral'}">${e.status}</span></td>
        <td class="text-muted text-sm">${formatTime(e.created_at)}</td>
      </tr>
    `).join('');
  }

  // Initial render — show all
  renderTable('all');

  /* ── Card click → filter inline table (like nurse dashboard) ── */
  let activeFilter = 'all';
  const cards = document.querySelectorAll('.stat-card[data-filter]');
  const filterLabel = document.getElementById('filter-label');

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const filter = card.dataset.filter;

      // "nurses" and "doctors" cards navigate to staff page instead of filtering encounters
      if (filter === 'nurses' || filter === 'doctors') {
        location.hash = '#/admin/staff';
        return;
      }

      // Toggle: clicking same card again resets to 'all'
      if (activeFilter === filter && filter !== 'all') {
        activeFilter = 'all';
      } else {
        activeFilter = filter;
      }

      // Update active styling
      cards.forEach(c => c.classList.remove('active'));
      if (activeFilter === 'all') {
        document.getElementById('card-total').classList.add('active');
        filterLabel.textContent = 'All';
        filterLabel.className = 'badge badge-neutral';
      } else {
        card.classList.add('active');
        filterLabel.textContent = activeFilter;
        filterLabel.className = `badge ${BADGE_MAP[activeFilter] || 'badge-neutral'}`;
      }

      renderTable(activeFilter);

      // Smooth scroll to the table
      document.querySelector('#encounters-body').closest('.card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}
