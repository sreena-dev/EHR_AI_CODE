/**
 * Nurse Dashboard — Matches Stitch "Nurse Clinical Dashboard" design
 */
import { renderAppShell } from '../components/app-shell.js';
import { getCurrentUser } from '../api/auth.js';
import { navigate } from '../router.js';

export async function renderNurseDashboard() {
  const user = getCurrentUser();
  const name = user?.full_name || user?.staff_id || 'Nurse';

  const bodyHTML = `
    <!-- Greeting -->
    <div style="margin-bottom: 24px;">
      <h2 style="font-size: 1.5rem; font-weight: 700;">Good ${getGreeting()}, ${name}</h2>
      <p class="text-muted">Here's the current status of your assigned patients and pending tasks.</p>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card" id="card-total" style="cursor:pointer;">
        <div class="stat-icon blue">
          <span class="material-icons-outlined">people</span>
        </div>
        <div>
          <div class="stat-value">12</div>
          <div class="stat-label">Total Patients Today</div>
        </div>
      </div>
      <div class="stat-card" id="card-ocr" style="cursor:pointer;">
        <div class="stat-icon orange">
          <span class="material-icons-outlined">document_scanner</span>
        </div>
        <div>
          <div class="stat-value">3</div>
          <div class="stat-label">Pending OCR Scans</div>
        </div>
      </div>
      <div class="stat-card" id="card-review" style="cursor:pointer;">
        <div class="stat-icon red">
          <span class="material-icons-outlined">rate_review</span>
        </div>
        <div>
          <div class="stat-value">1</div>
          <div class="stat-label">Requires Manual Review</div>
        </div>
      </div>
      <div class="stat-card" id="card-completed" style="cursor:pointer;">
        <div class="stat-icon green">
          <span class="material-icons-outlined">check_circle</span>
        </div>
        <div>
          <div class="stat-value">8</div>
          <div class="stat-label">Completed Today</div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px; margin-bottom:24px; max-width: 800px;">
      <a href="#/nurse/ocr" class="btn btn-primary" style="height: 48px;">
        <span class="material-icons-outlined" style="font-size:18px">add_photo_alternate</span>
        Upload Prescription
      </a>
      <a href="#/nurse/queue" class="btn btn-secondary" style="height: 48px;">
        <span class="material-icons-outlined" style="font-size:18px">groups</span>
        View Patient Queue
      </a>
      <a href="#/nurse/vitals" class="btn btn-primary" style="height: 48px;">
        <span class="material-icons-outlined" style="font-size:18px">monitor_heart</span>
        Add Vitals
      </a>
      <a href="#/nurse/tracking" class="btn btn-secondary" style="height: 48px;">
        <span class="material-icons-outlined" style="font-size:18px">insights</span>
        Disease Tracking
      </a>
    </div>
    <!-- Recent Encounters Table -->
    <div class="card">
      <div class="card-header">
        <h3 style="font-size:1rem;">
          <span class="material-icons-outlined" style="font-size:20px; vertical-align:middle;">history</span>
          Recent Encounters
        </h3>
      </div>
      <div class="table-wrapper">
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
            <tr data-status="Completed">
              <td><strong>ENC-2026-001</strong></td>
              <td>Priya Sharma</td>
              <td><span class="badge badge-primary">Prescription OCR</span></td>
              <td><span class="badge badge-success">Completed</span></td>
              <td class="text-muted text-sm">10:30 AM</td>
            </tr>
            <tr data-status="Pending Review">
              <td><strong>ENC-2026-002</strong></td>
              <td>Rajesh Kumar</td>
              <td><span class="badge badge-info">Lab Report</span></td>
              <td><span class="badge badge-warning">Pending Review</span></td>
              <td class="text-muted text-sm">11:15 AM</td>
            </tr>
            <tr data-status="Completed">
              <td><strong>ENC-2026-003</strong></td>
              <td>Meena Devi</td>
              <td><span class="badge badge-primary">Prescription OCR</span></td>
              <td><span class="badge badge-success">Completed</span></td>
              <td class="text-muted text-sm">11:45 AM</td>
            </tr>
            <tr data-status="Low Confidence">
              <td><strong>ENC-2026-004</strong></td>
              <td>Arjun Patel</td>
              <td><span class="badge badge-primary">Prescription OCR</span></td>
              <td><span class="badge badge-error">Low Confidence</span></td>
              <td class="text-muted text-sm">12:00 PM</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  renderAppShell('Clinical Dashboard', bodyHTML, '/nurse/dashboard');

  // Interaction Logic
  const encountersBody = document.getElementById('encounters-body');
  const rows = encountersBody.querySelectorAll('tr');

  const filterTable = (status) => {
    rows.forEach(row => {
      if (status === 'all') {
        row.style.display = '';
      } else {
        row.style.display = row.dataset.status === status ? '' : 'none';
      }
    });
    // Scroll to table
    document.querySelector('.card:last-child').scrollIntoView({ behavior: 'smooth' });
  };

  document.getElementById('card-total')?.addEventListener('click', () => {
    navigate('/nurse/queue');
  });
  document.getElementById('card-ocr')?.addEventListener('click', () => {
    navigate('/nurse/ocr');
  });
  document.getElementById('card-review')?.addEventListener('click', () => filterTable('Low Confidence'));
  document.getElementById('card-completed')?.addEventListener('click', () => filterTable('Completed'));
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}
