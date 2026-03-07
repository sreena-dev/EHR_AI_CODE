/**
 * Nurse Dashboard — Matches Stitch "Nurse Clinical Dashboard" design
 * Fetches live stats from GET /api/nurse/dashboard-stats
 */
import { renderAppShell } from '../components/app-shell.js';
import { getCurrentUser } from '../api/auth.js';
import { fetchDashboardStats } from '../api/nurse.js';

/* ── Status → badge class mapping ── */
const BADGE_MAP = {
  'Completed': 'badge-success',
  'Pending OCR': 'badge-warning',
  'Requires Review': 'badge-error',
};

/* ── Status → document type badge ── */
const TYPE_BADGE = {
  'Prescription OCR': 'badge-primary',
  'Lab Report': 'badge-info',
  'Vitals Entry': 'badge-success',
  'Patient Registration': 'badge-neutral',
};

export async function renderNurseDashboard() {
  const user = getCurrentUser();
  const name = user?.full_name || user?.staff_id || 'Nurse';

  /* ── Render shell with loading skeleton first ── */
  const bodyHTML = `
    <!-- Greeting -->
    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 1.5rem; font-weight: 700;">Good ${getGreeting()}, ${name}</h2>
      <p class="text-muted">Here's the current status of your assigned patients and pending tasks.</p>
    </div>

    <!-- Stats Grid (values filled by JS) -->
    <div class="stats-grid">
      <div class="stat-card active" id="card-total" style="cursor:pointer;" data-filter="all">
        <div class="stat-icon blue">
          <span class="material-icons-outlined">people</span>
        </div>
        <div>
          <div class="stat-value" id="val-total"><span class="spinner"></span></div>
          <div class="stat-label">Total Patients Today</div>
        </div>
      </div>
      <div class="stat-card" id="card-ocr" style="cursor:pointer;" data-filter="Pending OCR">
        <div class="stat-icon orange">
          <span class="material-icons-outlined">document_scanner</span>
        </div>
        <div>
          <div class="stat-value" id="val-ocr"><span class="spinner"></span></div>
          <div class="stat-label">Pending OCR Scans</div>
        </div>
      </div>
      <div class="stat-card" id="card-review" style="cursor:pointer;" data-filter="Requires Review">
        <div class="stat-icon red">
          <span class="material-icons-outlined">rate_review</span>
        </div>
        <div>
          <div class="stat-value" id="val-review"><span class="spinner"></span></div>
          <div class="stat-label">Requires Manual Review</div>
        </div>
      </div>
      <div class="stat-card" id="card-completed" style="cursor:pointer;" data-filter="Completed">
        <div class="stat-icon green">
          <span class="material-icons-outlined">check_circle</span>
        </div>
        <div>
          <div class="stat-value" id="val-completed"><span class="spinner"></span></div>
          <div class="stat-label">Completed Today</div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div style="display:flex; flex-direction:row; gap:16px; margin-bottom:24px; max-width: 500px;">
      <a href="#/nurse/ocr" class="btn btn-primary" style="height: 48px; flex:1; ">
        <span class="material-icons-outlined" style="font-size:18px">add_photo_alternate</span>
        Upload Prescription
      </a>
      
      <!-- a href="#/nurse/queue" class="btn btn-secondary" style="height: 48px;">
        <span class="material-icons-outlined" style="font-size:18px">groups</span>
        View Patient Queue
      </a -->
      <a href="#/nurse/vitals" class="btn btn-primary" style="height: 48px; flex:1;">
        <span class="material-icons-outlined" style="font-size:18px">monitor_heart</span>
        Add Vitals
      </a>
    </div>

    <!-- Recent Encounters Table -->
    <div class="card">
      <div class="card-header" style="display:flex; justify-content:space-between; align-items:center;">
        <h3 style="font-size:1rem; margin:0;">
          <span class="material-icons-outlined" style="font-size:20px; vertical-align:middle;">history</span>
          Recent Encounters
        </h3>
        <span id="filter-label" class="badge badge-neutral" style="font-size:0.75rem;">All</span>
      </div>
      <div class="table-wrapper table-scroll">
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
  `;

  renderAppShell('Clinical Dashboard', bodyHTML, '/nurse/dashboard');

  /* ── Fetch data from backend (database-backed) ── */
  let encounters = [];
  let counts = { total: 0, pending_ocr: 0, requires_review: 0, completed: 0 };

  try {
    const data = await fetchDashboardStats();
    encounters = data.encounters || [];
    counts = data.counts || counts;
  } catch (err) {
    console.error('Dashboard stats error:', err);
    document.getElementById('encounters-body').innerHTML = `
      <tr><td colspan="5" style="text-align:center; padding:24px; color:var(--error);">
        <span class="material-icons-outlined" style="font-size:20px;vertical-align:middle;">error</span>
        Failed to load dashboard data — ${err.message}
      </td></tr>`;
  }

  /* ── Populate stat card values ── */
  document.getElementById('val-total').textContent = counts.total;
  document.getElementById('val-ocr').textContent = counts.pending_ocr;
  document.getElementById('val-review').textContent = counts.requires_review;
  document.getElementById('val-completed').textContent = counts.completed;

  /* ── Render encounters into table ── */
  const tbody = document.getElementById('encounters-body');

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
        <td class="text-muted text-sm">${e.time}</td>
      </tr>
    `).join('');
  }

  // Initial render — show all
  renderTable('all');

  /* ── Card click → filter table ── */
  let activeFilter = 'all';
  const cards = document.querySelectorAll('.stat-card[data-filter]');
  const filterLabel = document.getElementById('filter-label');

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const filter = card.dataset.filter;

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
      document.querySelector('.card').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  });
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}
