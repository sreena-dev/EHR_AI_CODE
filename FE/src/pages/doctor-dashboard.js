/**
 * Doctor Dashboard — Matches Stitch "Doctor Dashboard - Overview" design
 * Upcoming Patients are fetched live from nurse-created encounters.
 */
import { renderAppShell } from '../components/app-shell.js';
import { getCurrentUser } from '../api/auth.js';
import { fetchUpcomingPatients } from '../api/doctor.js';

/* ── Status → badge mapping ── */
const STATUS_BADGE = {
  'Waiting': { cls: 'badge-warning', label: 'Waiting' },
  'Checked In': { cls: 'badge-warning', label: 'Checked In' },
  'Ready for Consult': { cls: 'badge-success', label: 'Ready' },
  'OCR Processing': { cls: 'badge-info', label: 'Processing' },
  'In Consultation': { cls: 'badge-primary', label: 'In Consult' },
  'Completed': { cls: 'badge-success', label: 'Complete' },
  'OCR Review Needed': { cls: 'badge-error', label: 'OCR Review' },
  'Pending OCR': { cls: 'badge-warning', label: 'Pending OCR' },
};

export async function renderDoctorDashboard() {
  const user = getCurrentUser();
  const name = user?.full_name || user?.staff_id || 'Doctor';

  const bodyHTML = `
    <!-- Greeting -->
    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 1.5rem; font-weight: 700;">Good ${getGreeting()}, Dr. ${name}</h2>
      <p class="text-muted">Here's your clinical overview for today.</p>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card" id="card-appointments" style="cursor:pointer;">
        <div class="stat-icon blue">
          <span class="material-icons-outlined">event_note</span>
        </div>
        <div>
          <div class="stat-value" id="val-total"><span class="spinner"></span></div>
          <div class="stat-label">Appointments Today</div>
        </div>
      </div>
      <div class="stat-card" id="card-pending" style="cursor:pointer;">
        <div class="stat-icon orange">
          <span class="material-icons-outlined">hourglass_top</span>
        </div>
        <div>
          <div class="stat-value" id="val-waiting"><span class="spinner"></span></div>
          <div class="stat-label">Waiting Patients</div>
        </div>
      </div>
      <div class="stat-card" id="card-review" style="cursor:pointer;">
        <div class="stat-icon red">
          <span class="material-icons-outlined">description</span>
        </div>
        <div>
          <div class="stat-value" id="val-in-progress"><span class="spinner"></span></div>
          <div class="stat-label">In Progress</div>
        </div>
      </div>
      <div class="stat-card" id="card-completed" style="cursor:pointer;">
        <div class="stat-icon green">
          <span class="material-icons-outlined">task_alt</span>
        </div>
        <div>
          <div class="stat-value" id="val-completed"><span class="spinner"></span></div>
          <div class="stat-label">Completed Today</div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div style="display:flex; gap:12px; margin-bottom:24px; flex-wrap:wrap;">
      <a href="#/doctor/consultation" class="btn btn-primary">
        <span class="material-icons-outlined" style="font-size:18px">mic</span>
        Start Consultation
      </a>
      <a href="#/doctor/drafts" class="btn btn-secondary">
        <span class="material-icons-outlined" style="font-size:18px">description</span>
        Review Notes
      </a>
      <a href="#/doctor/queue" class="btn btn-secondary">
        <span class="material-icons-outlined" style="font-size:18px">groups</span>
        Patient Queue
      </a>
    </div>

    <!-- Upcoming Patients -->
    <div class="card">
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
        <h3 style="font-size:1rem; margin:0;">
          <span class="material-icons-outlined" style="font-size:20px; vertical-align:middle;">schedule</span>
          Upcoming Patients
        </h3>
        <span id="patient-count-badge" class="badge badge-neutral" style="font-size:0.75rem;">0 patients</span>
      </div>
      <div class="table-wrapper table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Patient</th>
              <th>Chief Complaint</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="encounters-body">
            <tr>
              <td colspan="5" style="text-align:center; padding:32px; color:var(--gray-400);">
                <span class="spinner" style="margin-right:8px;"></span> Loading upcoming patients…
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  renderAppShell('Doctor Dashboard', bodyHTML, '/doctor/dashboard');

  /* ── Fetch live data from backend (database-backed) ── */
  const tbody = document.getElementById('encounters-body');
  let upcoming = [];
  let counts = { total: 0, waiting: 0, in_progress: 0, completed: 0 };

  try {
    const data = await fetchUpcomingPatients();
    upcoming = data.upcoming || [];
    counts = data.counts || counts;
  } catch (err) {
    console.error('Failed to fetch upcoming patients:', err);
    tbody.innerHTML = `
      <tr><td colspan="5" style="text-align:center; padding:24px; color:var(--error);">
        <span class="material-icons-outlined" style="font-size:20px;vertical-align:middle;">error</span>
        Failed to load patients — ${err.message}
      </td></tr>`;
  }

  /* ── Populate stat cards ── */
  document.getElementById('val-total').textContent = counts.total;
  document.getElementById('val-waiting').textContent = counts.waiting;
  document.getElementById('val-in-progress').textContent = counts.in_progress;
  document.getElementById('val-completed').textContent = counts.completed;

  /* ── Render upcoming patients table ── */
  const countBadge = document.getElementById('patient-count-badge');
  if (countBadge) {
    countBadge.textContent = `${upcoming.length} patient${upcoming.length !== 1 ? 's' : ''}`;
  }

  if (upcoming.length === 0) {
    tbody.innerHTML = `
      <tr><td colspan="5" style="text-align:center; padding:32px; color:var(--gray-400);">
        <span class="material-icons-outlined" style="font-size:24px; display:block; margin-bottom:8px;">event_available</span>
        No upcoming patients yet. Patients will appear here once the nurse creates new encounters.
      </td></tr>`;
  } else {
    tbody.innerHTML = upcoming.map(enc => {
      const badge = STATUS_BADGE[enc.status] || { cls: 'badge-neutral', label: enc.status };
      const isReady = enc.status === 'Ready for Consult' || enc.status === 'Completed' || enc.status === 'Checked In';
      const actionBtn = isReady
        ? `<a href="#/doctor/consultation?encounter=${enc.id}&patient=${enc.patient_id}" class="btn btn-sm btn-primary">Start</a>`
        : `<a href="#/doctor/consultation?encounter=${enc.id}&patient=${enc.patient_id}" class="btn btn-sm btn-secondary">Prepare</a>`;

      return `
        <tr data-status="${enc.status}">
          <td><strong>${enc.time}</strong></td>
          <td>${enc.patient_name}</td>
          <td>${enc.type || '—'}</td>
          <td><span class="badge ${badge.cls}">${badge.label}</span></td>
          <td>${actionBtn}</td>
        </tr>`;
    }).join('');
  }

  /* ── Card click navigation ── */
  document.getElementById('card-appointments')?.addEventListener('click', () => {
    location.hash = '#/doctor/schedule';
  });
  document.getElementById('card-pending')?.addEventListener('click', () => {
    location.hash = '#/doctor/queue';
  });
  document.getElementById('card-review')?.addEventListener('click', () => {
    location.hash = '#/doctor/drafts';
  });
  document.getElementById('card-completed')?.addEventListener('click', () => {
    // Filter to show only completed in the table
    const rows = tbody.querySelectorAll('tr[data-status]');
    rows.forEach(row => {
      row.style.display = row.dataset.status === 'Completed' ? '' : 'none';
    });
  });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}
