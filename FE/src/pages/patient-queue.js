/**
 * Patient Queue Page — Design-System Compliant
 * Fetches live patient data from GET /api/nurse/queue-stats
 */
import { renderAppShell } from '../components/app-shell.js';
import { getCurrentUser } from '../api/auth.js';
import { fetchQueueStats, searchPatients, createEncounter } from '../api/nurse.js';
import { showToast } from '../components/toast.js';

/* ── Status → badge class mapping ── */
const BADGE_MAP = {
  'Waiting': 'badge-warning',
  'Checked In': 'badge-neutral',
  'In Consultation': 'badge-success',
  'OCR Processing': 'badge-info',
  'Completed': 'badge-success',
};

/* ── Status group labels for stat cards ── */
const FILTER_GROUPS = {
  all: () => true,
  waiting: s => s === 'Waiting' || s === 'Checked In',
  in_progress: s => s === 'In Consultation' || s === 'OCR Processing',
  completed: s => s === 'Completed',
};

export async function renderPatientQueue() {
  const user = getCurrentUser();

  const bodyHTML = `
    <style>
      @keyframes fadeIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }

      /* ── Filter Dropdown ── */
      .filter-dropdown { position: relative; }
      .filter-toggle {
        display: flex; align-items: center; gap: 8px; justify-content: space-between;
        min-width: 170px; height: 42px; padding: 0 14px;
        background: white; border: 1px solid var(--gray-200); border-radius: var(--radius-md);
        font-size: 0.875rem; font-weight: 500; color: var(--gray-700);
        cursor: pointer; transition: all var(--transition-fast);
      }
      .filter-toggle:hover { border-color: var(--primary-500); }
      .filter-toggle.open { border-color: var(--primary-500); box-shadow: 0 0 0 3px var(--primary-100); }
      .filter-menu {
        display: none; position: absolute; top: calc(100% + 6px); right: 0; z-index: 50;
        width: 220px; background: white; border: 1px solid var(--gray-200);
        border-radius: var(--radius-lg); box-shadow: var(--shadow-xl); padding: 6px 0;
        animation: fadeIn 0.2s ease-out;
      }
      .filter-menu.open { display: block; }
      .filter-menu-header {
        padding: 8px 16px; font-size: 0.625rem; font-weight: 700; color: var(--gray-400);
        text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1px solid var(--gray-100); margin-bottom: 4px;
      }
      .filter-option {
        display: flex; align-items: center; justify-content: space-between;
        width: 100%; padding: 10px 16px; border: none; background: none;
        font-size: 0.875rem; color: var(--gray-700); cursor: pointer; text-align: left;
        transition: background var(--transition-fast);
      }
      .filter-option:hover { background: var(--primary-50); }
      .filter-option.selected { background: var(--gray-50); font-weight: 600; }
      .filter-option .dot { width: 8px; height: 8px; border-radius: 50%; margin-right: 10px; display: inline-block; }
      .filter-option .check { font-size: 18px; color: var(--primary-500); opacity: 0; }
      .filter-option.selected .check { opacity: 1; }

      /* ── New Encounter Modal ── */
      .encounter-modal-overlay {
        position: fixed; inset: 0; z-index: 3000;
        display: none; align-items: center; justify-content: center; padding: 16px;
        background: rgba(15, 23, 42, 0.6); backdrop-filter: blur(4px);
      }
      .encounter-modal-overlay.visible { display: flex; }
      .encounter-modal {
        background: white; width: 100%; max-width: 640px; border-radius: var(--radius-xl);
        box-shadow: var(--shadow-xl); display: flex; flex-direction: column; max-height: 90vh; overflow: hidden;
        animation: modalSlide 0.3s ease;
      }
      @keyframes modalSlide { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      .encounter-modal-header {
        padding: 20px 24px; border-bottom: 1px solid var(--gray-100);
        display: flex; justify-content: space-between; align-items: center;
      }
      .encounter-modal-header h2 { font-size: 1.25rem; font-weight: 700; margin: 0; }
      .encounter-modal-header p { color: var(--gray-400); font-size: 0.875rem; margin: 4px 0 0; }
      .encounter-modal-body { flex: 1; overflow-y: auto; padding: 24px; }
      .encounter-modal-footer {
        padding: 16px 24px; background: var(--gray-50); border-top: 1px solid var(--gray-100);
        display: flex; justify-content: flex-end; gap: 12px;
      }
      .section-label { font-size: 0.7rem; font-weight: 700; color: var(--gray-400); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; }
      .form-field { margin-bottom: 20px; }
      .form-field label { display: block; font-size: 0.875rem; font-weight: 600; color: var(--gray-700); margin-bottom: 6px; }
      .form-field label .req { color: var(--error); }
      .form-field input, .form-field textarea, .form-field select {
        width: 100%; padding: 10px 14px; background: var(--gray-50); border: 1px solid var(--gray-200);
        border-radius: var(--radius-md); font-size: 0.875rem; font-family: inherit;
        transition: all var(--transition-fast);
      }
      .form-field input:focus, .form-field textarea:focus, .form-field select:focus {
        outline: none; border-color: var(--primary-500); box-shadow: 0 0 0 3px var(--primary-100);
      }
      .symptom-chip {
        display: inline-block; padding: 4px 12px; background: var(--gray-100); border: 1px solid var(--gray-200);
        border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 500; color: var(--gray-600);
        cursor: pointer; transition: all var(--transition-fast);
      }
      .symptom-chip:hover { background: var(--primary-50); color: var(--primary-500); border-color: var(--primary-200); }
      .warning-banner {
        display: flex; gap: 10px; padding: 12px 16px; background: var(--error-light); border: 1px solid #fca5a5;
        border-radius: var(--radius-md); margin-top: 8px;
      }
      .warning-banner p { font-size: 0.875rem; font-weight: 500; color: #991b1b; margin: 0; }

      /* ── Export Modal ── */
      .export-overlay {
        position: fixed; inset: 0; z-index: 2000;
        display: none; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.5); backdrop-filter: blur(2px);
      }
      .export-overlay.visible { display: flex; }
      .export-panel {
        background: white; border-radius: var(--radius-lg); width: 100%; max-width: 460px;
        box-shadow: var(--shadow-xl); animation: modalSlide 0.3s ease;
      }
      .export-header { padding: 16px 20px; border-bottom: 1px solid var(--gray-100); display: flex; justify-content: space-between; align-items: center; }
      .export-body { padding: 24px; text-align: center; }
      .export-footer { padding: 16px 20px; border-top: 1px solid var(--gray-100); display: flex; gap: 12px; justify-content: center; }
      .progress-bar { width: 100%; height: 8px; background: var(--gray-100); border-radius: 4px; margin: 20px 0; overflow: hidden; }
      .progress-fill { width: 0%; height: 100%; background: var(--primary-500); transition: width 0.3s ease; }
      .spinner-lg { border: 3px solid var(--gray-100); border-top: 3px solid var(--primary-500); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; display: inline-block; }
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

      .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
      @media (max-width: 600px) { .two-col { grid-template-columns: 1fr; } }
    </style>

    <!-- Header -->
    <div style="margin-bottom:24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
      <div>
        <h2>Patient Queue</h2>
        <p class="text-muted text-sm">Manage patients waiting for consultation</p>
      </div>
      <div style="display:flex; gap:12px; align-items:center; flex-wrap:wrap;">
        <button class="btn btn-primary" id="new-encounter-btn" style="height:42px;">
          <span class="material-icons-outlined" style="font-size:18px">add</span>
          New Encounter
        </button>
        <button class="btn btn-secondary" id="export-queue-btn" style="height:42px;">
          <span class="material-icons-outlined" style="font-size:18px">download</span>
          Export Queue
        </button>
        <div style="position:relative;">
          <span class="material-icons-outlined" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:18px;color:var(--gray-400);">search</span>
          <input type="text" class="form-input" placeholder="Search patients..." style="padding-left:40px;width:260px;height:42px;" id="queue-search" />
        </div>

        <!-- Filter Dropdown -->
        <div class="filter-dropdown">
          <button class="filter-toggle" id="queue-filter-btn">
            <span style="display:flex;align-items:center;gap:8px;">
              <span class="material-icons-outlined" style="font-size:20px;color:var(--gray-400);">filter_list</span>
              <span id="filter-label-text">All Patients</span>
            </span>
            <span class="material-icons" style="font-size:18px;color:var(--gray-400);">expand_more</span>
          </button>
          <div class="filter-menu" id="queue-dropdown-menu">
            <div class="filter-menu-header">Filter by Status</div>
            <button class="filter-option selected" data-value="all">
              <span>All Patients</span>
              <span class="material-icons check">check</span>
            </button>
            <button class="filter-option" data-value="Waiting">
              <span><span class="dot" style="background:var(--warning);"></span>Waiting</span>
              <span class="material-icons check">check</span>
            </button>
            <button class="filter-option" data-value="In Consultation">
              <span><span class="dot" style="background:var(--primary-500);"></span>In Progress</span>
              <span class="material-icons check">check</span>
            </button>
            <button class="filter-option" data-value="OCR Processing">
              <span><span class="dot" style="background:var(--info);"></span>OCR Processing</span>
              <span class="material-icons check">check</span>
            </button>
            <button class="filter-option" data-value="Completed">
              <span><span class="dot" style="background:var(--success);"></span>Completed</span>
              <span class="material-icons check">check</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid" style="grid-template-columns: repeat(4, 1fr);">
      <div class="stat-card active" id="card-total" style="cursor:pointer;" data-filter="all">
        <div class="stat-icon blue"><span class="material-icons-outlined">groups</span></div>
        <div>
          <div class="stat-value" id="val-total"><span class="spinner"></span></div>
          <div class="stat-label">Total Today</div>
        </div>
      </div>
      <div class="stat-card" id="card-waiting" style="cursor:pointer;" data-filter="waiting">
        <div class="stat-icon orange"><span class="material-icons-outlined">hourglass_top</span></div>
        <div>
          <div class="stat-value" id="val-waiting"><span class="spinner"></span></div>
          <div class="stat-label">Waiting</div>
        </div>
      </div>
      <div class="stat-card" id="card-progress" style="cursor:pointer;" data-filter="in_progress">
        <div class="stat-icon blue"><span class="material-icons-outlined">pending_actions</span></div>
        <div>
          <div class="stat-value" id="val-progress"><span class="spinner"></span></div>
          <div class="stat-label">In Progress</div>
        </div>
      </div>
      <div class="stat-card" id="card-completed" style="cursor:pointer;" data-filter="completed">
        <div class="stat-icon green"><span class="material-icons-outlined">check_circle</span></div>
        <div>
          <div class="stat-value" id="val-completed"><span class="spinner"></span></div>
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
              <td colspan="8" style="text-align:center; padding:32px; color:var(--gray-400);">
                <span class="spinner" style="margin-right:8px;"></span> Loading queue…
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- New Patient Encounter Modal -->
    <div id="new-encounter-modal" class="encounter-modal-overlay">
      <div class="encounter-modal">
        <div class="encounter-modal-header">
          <div>
            <h2>Additional Patient Details</h2>
            <p>Enter patient details to start consultation</p>
          </div>
          <span class="close-modal" id="close-new-encounter-modal" style="font-size:28px;cursor:pointer;color:var(--gray-400);">&times;</span>
        </div>
        <div class="encounter-modal-body">
          <div class="section-label">Patient Identification</div>
          <div class="form-field">
            <label>Patient ID <span class="req">*</span></label>
            <div style="position:relative;">
              <input type="text" id="enc-patient-id" placeholder="Format: PID-XXXXX" style="font-weight:600;padding-right:40px;" />
            </div>
          </div>
          <div class="form-field">
            <label>Patient Name <span class="req">*</span></label>
            <div style="position:relative;">
              <span class="material-icons" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--gray-400);font-size:18px;">search</span>
              <input type="text" id="enc-patient-name" placeholder="Search by name, ID or phone..." style="padding-left:40px;" />
              <div id="enc-search-results" style="position:absolute;top:100%;left:0;right:0;z-index:10;background:white;border:1px solid var(--gray-200);border-radius:var(--radius-md);max-height:200px;overflow-y:auto;display:none;box-shadow:var(--shadow-lg);"></div>
            </div>
          </div>

          <div class="section-label" style="margin-top:24px;">Encounter Details</div>
          <div class="form-field">
            <label>Chief Complaint</label>
            <textarea id="chief-complaint-textarea" rows="3" placeholder="Describe symptoms..."></textarea>
            <div style="margin-top:8px; display:flex; flex-wrap:wrap; gap:6px;">
              <span class="symptom-chip symptom-tag" data-symptom="Fever">+ Fever</span>
              <span class="symptom-chip symptom-tag" data-symptom="Cough">+ Cough</span>
              <span class="symptom-chip symptom-tag" data-symptom="Headache">+ Headache</span>
            </div>
          </div>
          <div class="two-col">
            <div class="form-field">
              <label>Language</label>
              <select id="enc-language">
                <option value="en">English</option>
                <option value="ta">Tamil</option>
                <option value="hi">Hindi</option>
              </select>
            </div>
            <div class="form-field">
              <label>Visit Type</label>
              <select id="enc-visit-type">
                <option value="Standard Consult">Standard Consult</option>
                <option value="Follow-up">Follow-up</option>
                <option value="Emergency">Emergency</option>
              </select>
            </div>
          </div>

          <div class="warning-banner">
            <span class="material-icons" style="color:var(--error);font-size:20px;">warning</span>
            <p>Tamil patients require manual verification before EMR save</p>
          </div>
        </div>
        <div class="encounter-modal-footer">
          <button class="btn btn-secondary" id="cancel-new-encounter-btn">Cancel</button>
          <button class="btn btn-primary" id="save-new-encounter-btn" style="display:flex;align-items:center;gap:6px;">
            <span>Save & Proceed</span>
            <span class="material-icons" style="font-size:18px;">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Data Export Modal -->
    <div id="export-modal" class="export-overlay">
      <div class="export-panel">
        <div class="export-header">
          <h3 style="margin:0;">Data Export Progress</h3>
          <span class="close-modal" id="close-export-modal" style="font-size:24px;cursor:pointer;color:var(--gray-400);">&times;</span>
        </div>
        <div class="export-body">
          <div id="export-status-icon" style="margin-bottom:16px;">
            <div class="spinner-lg"></div>
          </div>
          <h4 id="export-status-title" style="margin-bottom:8px;">Preparing export...</h4>
          <p id="export-status-msg" class="text-sm text-muted">Gathering clinical records and patient data.</p>
          <div class="progress-bar">
            <div class="progress-fill" id="export-progress-fill"></div>
          </div>
          <div style="display:flex; justify-content:space-between;" class="text-xs text-muted">
            <span id="export-progress-percent">0%</span>
            <span id="export-progress-items">0 / 0 records</span>
          </div>
        </div>
        <div class="export-footer" id="export-footer">
          <button class="btn btn-secondary" id="cancel-export-btn" style="flex:1;">Cancel</button>
        </div>
      </div>
    </div>
  `;

  const activePath = user?.role === 'doctor' ? '/doctor/queue' : '/nurse/queue';
  renderAppShell('Patient Queue', bodyHTML, activePath);

  /* ═══════════════ DATA FETCHING (database-backed) ═══════════════ */
  let patients = [];
  let counts = { total: 0, waiting: 0, in_progress: 0, completed: 0 };

  try {
    const data = await fetchQueueStats();
    patients = data.patients || [];
    counts = data.counts || counts;
  } catch (err) {
    console.error('Queue stats error:', err);
    document.getElementById('queue-body').innerHTML = `
      <tr><td colspan="8" style="text-align:center; padding:24px; color:var(--error);">
        <span class="material-icons-outlined" style="font-size:20px;vertical-align:middle;">error</span>
        Failed to load queue — ${err.message}
      </td></tr>`;
  }

  /* ── Populate stat card values ── */
  document.getElementById('val-total').textContent = counts.total;
  document.getElementById('val-waiting').textContent = counts.waiting;
  document.getElementById('val-progress').textContent = counts.in_progress;
  document.getElementById('val-completed').textContent = counts.completed;

  /* ═══════════════ TABLE RENDERING ═══════════════ */
  const tbody = document.getElementById('queue-body');
  let currentSearch = '';
  let currentCardFilter = 'all';      // from stat cards
  let currentDropdownFilter = 'all';  // from dropdown

  function renderTable() {
    const filtered = patients.filter(p => {
      // Card filter
      const cardFn = FILTER_GROUPS[currentCardFilter] || (() => true);
      if (!cardFn(p.status)) return false;

      // Dropdown filter (more specific)
      if (currentDropdownFilter !== 'all' && p.status !== currentDropdownFilter) return false;

      // Search
      if (currentSearch) {
        const hay = `${p.token} ${p.name} ${p.reason} ${p.doctor} ${p.status}`.toLowerCase();
        if (!hay.includes(currentSearch.toLowerCase())) return false;
      }
      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `
        <tr><td colspan="8" style="text-align:center; padding:24px; color:var(--gray-400);">
          No patients match the selected filter.
        </td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(p => {
      const badgeClass = BADGE_MAP[p.status] || 'badge-neutral';
      const isActionable = p.status === 'Waiting' || p.status === 'Checked In';
      const isViewing = p.status === 'In Consultation' || p.status === 'OCR Processing';

      let actions = '';
      if (isActionable) {
        actions = `
          <button class="btn btn-sm btn-primary start-btn">Start</button>
          <button class="btn btn-sm btn-ghost">Edit</button>`;
      } else if (isViewing) {
        actions = `<a href="#/${user?.role === 'doctor' ? 'doctor/consultation' : 'nurse/ocr'}" class="btn btn-sm btn-ghost">View</a>`;
      } else {
        actions = `<span class="text-muted text-sm">—</span>`;
      }

      return `
        <tr data-status="${p.status}">
          <td><strong>${p.token}</strong></td>
          <td>${p.name}</td>
          <td>${p.age} / ${p.gender}</td>
          <td>${p.reason}</td>
          <td>${p.doctor}</td>
          <td><span class="badge ${badgeClass}">${p.status}</span></td>
          <td>${p.wait_time}</td>
          <td>${actions}</td>
        </tr>`;
    }).join('');

    // Bind start buttons
    tbody.querySelectorAll('.start-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (user?.role === 'doctor') {
          location.hash = '#/doctor/consultation';
        } else {
          location.hash = '#/nurse/ocr';
        }
      });
    });
  }

  renderTable();

  /* ═══════════════ STAT CARD FILTERING ═══════════════ */
  const statCards = document.querySelectorAll('.stat-card[data-filter]');

  statCards.forEach(card => {
    card.addEventListener('click', () => {
      const filter = card.dataset.filter;
      if (currentCardFilter === filter && filter !== 'all') {
        currentCardFilter = 'all';
      } else {
        currentCardFilter = filter;
      }

      // Reset dropdown when filtering via card
      currentDropdownFilter = 'all';
      document.querySelectorAll('.filter-option').forEach(o => o.classList.remove('selected'));
      document.querySelector('.filter-option[data-value="all"]')?.classList.add('selected');
      document.getElementById('filter-label-text').textContent = 'All Patients';

      // Update active card
      statCards.forEach(c => c.classList.remove('active'));
      if (currentCardFilter === 'all') {
        document.getElementById('card-total').classList.add('active');
      } else {
        card.classList.add('active');
      }

      renderTable();
    });
  });

  /* ═══════════════ DROPDOWN FILTER ═══════════════ */
  const filterBtn = document.getElementById('queue-filter-btn');
  const filterMenu = document.getElementById('queue-dropdown-menu');

  filterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = filterMenu.classList.toggle('open');
    filterBtn.classList.toggle('open', isOpen);
  });

  document.querySelectorAll('.filter-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const val = opt.dataset.value;
      const label = opt.querySelector('span:first-child')?.textContent.trim();

      currentDropdownFilter = val;

      // Update dropdown UI
      document.getElementById('filter-label-text').textContent = label;
      document.querySelectorAll('.filter-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      filterMenu.classList.remove('open');
      filterBtn.classList.remove('open');

      renderTable();
    });
  });

  // Close dropdown on outside click
  window.addEventListener('click', () => {
    filterMenu.classList.remove('open');
    filterBtn.classList.remove('open');
  });

  /* ═══════════════ SEARCH ═══════════════ */
  document.getElementById('queue-search')?.addEventListener('input', (e) => {
    currentSearch = e.target.value;
    renderTable();
  });

  /* ═══════════════ EXPORT MODAL ═══════════════ */
  const exportModal = document.getElementById('export-modal');
  const progressFill = document.getElementById('export-progress-fill');
  const progressPercent = document.getElementById('export-progress-percent');
  const progressItems = document.getElementById('export-progress-items');
  const statusTitle = document.getElementById('export-status-title');
  const statusMsg = document.getElementById('export-status-msg');
  const statusIcon = document.getElementById('export-status-icon');
  const footer = document.getElementById('export-footer');
  let exportInterval;

  const totalRecords = patients.length || 10;

  const startExport = () => {
    exportModal.classList.add('visible');
    let progress = 0;

    progressFill.style.width = '0%';
    progressPercent.textContent = '0%';
    progressItems.textContent = `0 / ${totalRecords} records`;
    statusTitle.textContent = 'Preparing export...';
    statusMsg.textContent = 'Gathering clinical records and patient data.';
    statusIcon.innerHTML = '<div class="spinner-lg"></div>';
    footer.innerHTML = '<button class="btn btn-secondary" id="cancel-export-btn" style="flex:1;">Cancel</button>';

    document.getElementById('cancel-export-btn').onclick = () => {
      clearInterval(exportInterval);
      exportModal.classList.remove('visible');
      showToast('Export cancelled', 'info');
    };

    exportInterval = setInterval(() => {
      progress += Math.floor(Math.random() * 15) + 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(exportInterval);
        finishExport();
      }
      const currentItem = Math.min(Math.floor((progress / 100) * totalRecords), totalRecords);
      progressFill.style.width = `${progress}%`;
      progressPercent.textContent = `${progress}%`;
      progressItems.textContent = `${currentItem} / ${totalRecords} records`;

      if (progress > 40) statusMsg.textContent = 'Encrypting sensitive data...';
      if (progress > 80) statusMsg.textContent = 'Finalizing package...';
    }, 400);
  };

  const finishExport = () => {
    statusTitle.textContent = 'Export Complete';
    statusMsg.textContent = 'The clinical data package is ready for download.';
    statusIcon.innerHTML = '<span class="material-icons-outlined" style="font-size:56px;color:var(--success);">check_circle</span>';
    footer.innerHTML = `
      <button class="btn btn-secondary" id="close-export-btn" style="flex:1;">Close</button>
      <button class="btn btn-primary" id="download-export-btn" style="flex:1;">Download ZIP</button>
    `;
    document.getElementById('close-export-btn').onclick = () => exportModal.classList.remove('visible');
    document.getElementById('download-export-btn').onclick = () => {
      showToast('Download started', 'success');
      exportModal.classList.remove('visible');
    };
  };

  document.getElementById('export-queue-btn')?.addEventListener('click', startExport);
  document.getElementById('close-export-modal')?.addEventListener('click', () => {
    clearInterval(exportInterval);
    exportModal.classList.remove('visible');
  });

  /* ═══════════════ NEW ENCOUNTER MODAL ═══════════════ */
  const newEncounterModal = document.getElementById('new-encounter-modal');

  document.getElementById('new-encounter-btn')?.addEventListener('click', () => {
    newEncounterModal.classList.add('visible');
    // Reset form fields on open
    const pidInput = document.getElementById('enc-patient-id');
    const nameInput = document.getElementById('enc-patient-name');
    const complaintArea = document.getElementById('chief-complaint-textarea');
    if (pidInput) pidInput.value = '';
    if (nameInput) nameInput.value = '';
    if (complaintArea) complaintArea.value = '';
  });

  const hideNewEncounterModal = () => newEncounterModal.classList.remove('visible');

  document.getElementById('close-new-encounter-modal')?.addEventListener('click', hideNewEncounterModal);
  document.getElementById('cancel-new-encounter-btn')?.addEventListener('click', hideNewEncounterModal);

  /* ── Patient Name search typeahead ── */
  let searchTimeout = null;
  const nameInput = document.getElementById('enc-patient-name');
  const pidInput = document.getElementById('enc-patient-id');
  const searchResults = document.getElementById('enc-search-results');

  nameInput?.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    const query = nameInput.value.trim();
    if (query.length < 2) { searchResults.style.display = 'none'; return; }
    searchTimeout = setTimeout(async () => {
      try {
        const data = await searchPatients(query);
        const pts = data.patients || [];
        if (pts.length === 0) {
          searchResults.innerHTML = '<div style="padding:12px;color:var(--gray-400);font-size:0.875rem;">No patients found</div>';
        } else {
          searchResults.innerHTML = pts.map(p => `
            <div class="search-result-item" data-pid="${p.id}" data-name="${p.name}" data-age="${p.age || ''}" data-gender="${p.gender || ''}"
                 style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--gray-100);font-size:0.875rem;transition:background 0.15s;">
              <strong>${p.name}</strong> <span style="color:var(--gray-400);">(${p.id})</span>
              ${p.age ? `<span style="color:var(--gray-500);margin-left:8px;">${p.age}y/${p.gender || '?'}</span>` : ''}
            </div>
          `).join('');
          searchResults.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('mouseenter', () => item.style.background = 'var(--primary-50)');
            item.addEventListener('mouseleave', () => item.style.background = '');
            item.addEventListener('click', () => {
              pidInput.value = item.dataset.pid;
              nameInput.value = item.dataset.name;
              searchResults.style.display = 'none';
            });
          });
        }
        searchResults.style.display = 'block';
      } catch { searchResults.style.display = 'none'; }
    }, 300);
  });

  // Hide search results on click outside
  document.addEventListener('click', (e) => {
    if (!searchResults?.contains(e.target) && e.target !== nameInput) {
      searchResults.style.display = 'none';
    }
  });

  /* ── Save & Proceed → calls backend API ── */
  document.getElementById('save-new-encounter-btn')?.addEventListener('click', async () => {
    const patientId = document.getElementById('enc-patient-id')?.value.trim();
    const patientName = document.getElementById('enc-patient-name')?.value.trim();
    const complaint = document.getElementById('chief-complaint-textarea')?.value.trim();
    const visitType = document.getElementById('enc-visit-type')?.value || 'Standard Consult';

    // Validate required fields
    if (!patientName) {
      showToast('Patient name is required', 'error');
      return;
    }

    const saveBtn = document.getElementById('save-new-encounter-btn');
    saveBtn.disabled = true;
    saveBtn.querySelector('span:first-child').textContent = 'Saving…';

    try {
      const result = await createEncounter({
        patient_name: patientName,
        patient_id: patientId || undefined,
        type: visitType,
        status: 'Pending OCR',
        chief_complaint: complaint || undefined,
      });

      hideNewEncounterModal();
      showToast('Encounter created successfully', 'success');

      // Navigate to OCR upload
      if (user?.role === 'doctor') {
        location.hash = '#/doctor/consultation';
      } else {
        location.hash = '#/nurse/ocr';
      }
    } catch (err) {
      showToast(`Failed to create encounter: ${err.message}`, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.querySelector('span:first-child').textContent = 'Save & Proceed';
    }
  });

  // Symptom Tag Logic
  const chiefComplaintArea = newEncounterModal.querySelector('textarea');
  newEncounterModal.querySelectorAll('.symptom-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const symptom = tag.dataset.symptom;
      const val = chiefComplaintArea.value.trim();
      chiefComplaintArea.value = val ? val + ', ' + symptom : symptom;
      // Visual pulse
      tag.style.background = 'var(--primary-50)';
      tag.style.color = 'var(--primary-500)';
      tag.style.borderColor = 'var(--primary-200)';
      setTimeout(() => {
        tag.style.background = '';
        tag.style.color = '';
        tag.style.borderColor = '';
      }, 200);
    });
  });
}
