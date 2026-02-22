/**
 * Patient Queue Page — Matches Stitch "Patient Queue" design
 * Note: No dedicated backend endpoint yet — displays mock data
 */
import { renderAppShell } from '../components/app-shell.js';
import { getCurrentUser } from '../api/auth.js';

export async function renderPatientQueue() {
  const bodyHTML = `
    <div style="margin-bottom:24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
      <div>
        <h2>Patient Queue</h2>
        <p class="text-muted text-sm">Manage patients waiting for consultation</p>
      </div>
      <div style="display:flex; gap:8px;">
        <div style="position:relative;">
          <span class="material-icons-outlined" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:18px;color:var(--gray-400);">search</span>
          <input type="text" class="form-input" placeholder="Search patients..." style="padding-left:36px; width:240px;" id="queue-search" />
        </div>
        <select class="form-select" style="width:160px;" id="queue-filter">
          <option value="all">All Patients</option>
          <option value="waiting">Waiting</option>
          <option value="in-progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>
    </div>

    <!-- Queue Stats -->
    <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr);">
      <div class="stat-card">
        <div class="stat-icon blue"><span class="material-icons-outlined">groups</span></div>
        <div>
          <div class="stat-value">16</div>
          <div class="stat-label">Total Today</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange"><span class="material-icons-outlined">hourglass_top</span></div>
        <div>
          <div class="stat-value">5</div>
          <div class="stat-label">Waiting</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon blue"><span class="material-icons-outlined">pending_actions</span></div>
        <div>
          <div class="stat-value">3</div>
          <div class="stat-label">In Progress</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><span class="material-icons-outlined">check_circle</span></div>
        <div>
          <div class="stat-value">8</div>
          <div class="stat-label">Completed</div>
        </div>
      </div>
    </div>

    <!-- Queue Table -->
    <div class="card">
      <div class="table-wrapper">
        <table class="data-table" id="queue-table">
          <thead>
            <tr>
              <th>Token</th>
              <th>Patient Name</th>
              <th>Age / Gender</th>
              <th>Reason</th>
              <th>Doctor</th>
              <th>Status</th>
              <th>Wait Time</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="queue-body">
            <tr>
              <td><strong>#001</strong></td>
              <td>Priya Sharma</td>
              <td>28 / F</td>
              <td>Follow-up</td>
              <td>Dr. Kumar</td>
              <td><span class="badge badge-success">In Consultation</span></td>
              <td>-</td>
              <td><a href="#/doctor/consultation" class="btn btn-sm btn-ghost">View</a></td>
            </tr>
            <tr>
              <td><strong>#002</strong></td>
              <td>Rajesh Kumar</td>
              <td>45 / M</td>
              <td>New Visit — Chest Pain</td>
              <td>Dr. Kumar</td>
              <td><span class="badge badge-warning">Waiting</span></td>
              <td>15 min</td>
              <td>
                <button class="btn btn-sm btn-primary start-btn">Start</button>
                <button class="btn btn-sm btn-ghost">Edit</button>
              </td>
            </tr>
            <tr>
              <td><strong>#003</strong></td>
              <td>Meena Devi</td>
              <td>62 / F</td>
              <td>Lab Review</td>
              <td>Dr. Priya</td>
              <td><span class="badge badge-warning">Waiting</span></td>
              <td>22 min</td>
              <td>
                <button class="btn btn-sm btn-primary start-btn">Start</button>
                <button class="btn btn-sm btn-ghost">Edit</button>
              </td>
            </tr>
            <tr>
              <td><strong>#004</strong></td>
              <td>Arjun Patel</td>
              <td>35 / M</td>
              <td>Prescription Refill</td>
              <td>Dr. Kumar</td>
              <td><span class="badge badge-warning">Waiting</span></td>
              <td>30 min</td>
              <td>
                <button class="btn btn-sm btn-primary start-btn">Start</button>
                <button class="btn btn-sm btn-ghost">Edit</button>
              </td>
            </tr>
            <tr>
              <td><strong>#005</strong></td>
              <td>Lakshmi R.</td>
              <td>50 / F</td>
              <td>New Visit — Diabetes</td>
              <td>Dr. Priya</td>
              <td><span class="badge badge-neutral">Checked In</span></td>
              <td>5 min</td>
              <td>
                <button class="btn btn-sm btn-primary start-btn">Start</button>
                <button class="btn btn-sm btn-ghost">Edit</button>
              </td>
            </tr>
            <tr>
              <td><strong>#006</strong></td>
              <td>Suresh M.</td>
              <td>70 / M</td>
              <td>Follow-up — Heart</td>
              <td>Dr. Kumar</td>
              <td><span class="badge badge-info">OCR Processing</span></td>
              <td>8 min</td>
              <td><a href="#/nurse/ocr-results" class="btn btn-sm btn-ghost">View</a></td>
            </tr>
          </tbody>
      </div>
    </div>

    <div style="margin-top:16px; text-align:center;">
      <p class="text-sm text-muted">
        <span class="material-icons-outlined" style="font-size:14px;vertical-align:middle;">info</span>
        Patient queue data will be live once backend endpoint is implemented
      </p>
    </div>
  `;

  renderAppShell('Patient Queue', bodyHTML, '/nurse/queue');

  // Start button listeners
  document.querySelectorAll('.start-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const user = getCurrentUser();
      if (user?.role === 'doctor') {
        location.hash = '#/doctor/consultation';
      } else {
        location.hash = '#/nurse/ocr';
      }
    });
  });

  // Search filter (client-side)
  document.getElementById('queue-search')?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase();
    const rows = document.querySelectorAll('#queue-body tr');
    rows.forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(query) ? '' : 'none';
    });
  });
}
