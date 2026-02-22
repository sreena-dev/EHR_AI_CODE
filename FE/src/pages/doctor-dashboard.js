/**
 * Doctor Dashboard — Matches Stitch "Doctor Dashboard - Overview" design
 */
import { renderAppShell } from '../components/app-shell.js';
import { getCurrentUser } from '../api/auth.js';

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
          <div class="stat-value">8</div>
          <div class="stat-label">Appointments Today</div>
        </div>
      </div>
      <div class="stat-card" id="card-pending" style="cursor:pointer;">
        <div class="stat-icon orange">
          <span class="material-icons-outlined">mic</span>
        </div>
        <div>
          <div class="stat-value">2</div>
          <div class="stat-label">Pending Transcriptions</div>
        </div>
      </div>
      <div class="stat-card" id="card-review" style="cursor:pointer;">
        <div class="stat-icon red">
          <span class="material-icons-outlined">description</span>
        </div>
        <div>
          <div class="stat-value">3</div>
          <div class="stat-label">Pending Notes</div>
        </div>
      </div>
      <div class="stat-card" id="card-completed" style="cursor:pointer;">
        <div class="stat-icon green">
          <span class="material-icons-outlined">task_alt</span>
        </div>
        <div>
          <div class="stat-value">5</div>
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
      <a href="#/doctor/note-verification" class="btn btn-secondary">
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
      <div class="card-header">
        <h3 style="font-size:1rem;">
          <span class="material-icons-outlined" style="font-size:20px; vertical-align:middle;">schedule</span>
          Upcoming Patients
        </h3>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Patient</th>
              <th>Reason</th>
              <th>OCR Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="encounters-body">
            <tr data-status="OCR Complete">
              <td><strong>2:00 PM</strong></td>
              <td>Priya Sharma</td>
              <td>Follow-up</td>
              <td><span class="badge badge-success">OCR Complete</span></td>
              <td><a href="#/doctor/consultation" class="btn btn-sm btn-primary">Start</a></td>
            </tr>
            <tr data-status="Pending">
              <td><strong>2:30 PM</strong></td>
              <td>Rajesh Kumar</td>
              <td>New Visit</td>
              <td><span class="badge badge-warning">Pending</span></td>
              <td><a href="#/doctor/consultation" class="btn btn-sm btn-secondary">Prepare</a></td>
            </tr>
            <tr data-status="OCR Complete">
              <td><strong>3:00 PM</strong></td>
              <td>Meena Devi</td>
              <td>Lab Review</td>
              <td><span class="badge badge-success">OCR Complete</span></td>
              <td><a href="#/doctor/consultation" class="btn btn-sm btn-primary">Start</a></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  renderAppShell('Doctor Dashboard', bodyHTML, '/doctor/dashboard');

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

  document.getElementById('card-appointments')?.addEventListener('click', () => {
    location.hash = '#/doctor/schedule';
  });
  document.getElementById('card-pending')?.addEventListener('click', () => filterTable('Pending'));
  document.getElementById('card-review')?.addEventListener('click', () => {
    // For review, we link to the actual review page
    location.hash = '#/doctor/note-verification';
  });
  document.getElementById('card-completed')?.addEventListener('click', () => filterTable('Completed'));
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Morning';
  if (h < 17) return 'Afternoon';
  return 'Evening';
}
