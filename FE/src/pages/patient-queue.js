/**
 * Patient Queue Page — Matches Stitch "Patient Queue" design
 * Note: No dedicated backend endpoint yet — displays mock data
 */
import { renderAppShell } from '../components/app-shell.js';
import { getCurrentUser } from '../api/auth.js';

export async function renderPatientQueue() {
  const user = getCurrentUser();
  const bodyHTML = `
    <style>
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-dropdown {
            animation: fadeIn 0.2s ease-out forwards;
        }
        .filter-opt.selected {
            background-color: #f8fafc;
            font-weight: 600;
        }

        /* Modal Styles */
        .modal {
            position: fixed;
            z-index: 2000;
            left: 0; top: 0;
            width: 100%; height: 100%;
            background-color: rgba(0,0,0,0.5);
            display: flex;
            align-items: center; justify-content: center;
            backdrop-filter: blur(2px);
        }
        .modal-content {
            background: white;
            border-radius: var(--radius-lg);
            width: 100%;
            box-shadow: var(--shadow-xl);
            animation: modalSlide 0.3s ease;
        }
        .modal-header { padding: 16px 20px; border-bottom: 1px solid var(--gray-100); display: flex; justify-content: space-between; align-items: center; }
        .modal-footer { padding: 16px 20px; border-top: 1px solid var(--gray-100); }
        .close-modal { font-size: 24px; cursor: pointer; color: var(--gray-400); }
        @keyframes modalSlide { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

        .spinner {
            border: 4px solid var(--gray-100);
            border-top: 4px solid var(--primary-500);
            border-radius: 50%;
            width: 24px;
            height: 24px;
            animation: spin 1s linear infinite;
            display: inline-block;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    </style>

    <div style="margin-bottom:24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
      <div>
        <h2>Patient Queue</h2>
        <p class="text-muted text-sm">Manage patients waiting for consultation</p>
      </div>
      <div style="display:flex; gap:12px; align-items:center;">
        <button class="btn btn-primary" id="new-encounter-btn" style="height: 42px;">
          <span class="material-icons-outlined" style="font-size: 18px;">add</span>
          New Encounter
        </button>
        <button class="btn btn-secondary" id="export-queue-btn" style="height: 42px;">
          <span class="material-icons-outlined" style="font-size: 18px;">download</span>
          Export Queue
        </button>
        <div style="position:relative;">
          <span class="material-icons-outlined" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:18px;color:var(--gray-400);">search</span>
          <input type="text" class="form-input" placeholder="Search patients..." style="padding-left:40px; width:260px; height:42px;" id="queue-search" />
        </div>
        
        <!-- Custom Dropdown -->
        <div class="relative">
            <button id="queue-filter-btn" class="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 transition-all min-w-[160px] h-[42px] justify-between">
                <span class="flex items-center gap-2">
                  <span class="material-icons-outlined text-slate-400 text-[20px]">filter_list</span>
                  <span>All Patients</span>
                </span>
                <span class="material-icons text-slate-400 text-[18px]">expand_more</span>
            </button>
            
            <div id="queue-dropdown-menu" class="hidden absolute top-full right-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden animate-dropdown">
                <div class="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] border-b border-slate-50 mb-1">Filter by Status</div>
                
                <button class="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-primary/5 transition-all flex items-center justify-between filter-opt group" data-value="all">
                    <span>All Patients</span>
                    <span class="material-icons text-primary text-[18px] opacity-0 group-[.selected]:opacity-100">check</span>
                </button>
                
                <button class="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-primary/5 transition-all flex items-center justify-between filter-opt group" data-value="Waiting">
                    <span class="flex items-center"><span class="w-2 h-2 rounded-full bg-amber-500 mr-3"></span>Waiting</span>
                    <span class="material-icons text-primary text-[18px] opacity-0 group-[.selected]:opacity-100">check</span>
                </button>
                
                <button class="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-primary/5 transition-all flex items-center justify-between filter-opt group" data-value="In Consultation">
                    <span class="flex items-center"><span class="w-2 h-2 rounded-full bg-blue-500 mr-3"></span>In Progress</span>
                    <span class="material-icons text-primary text-[18px] opacity-0 group-[.selected]:opacity-100">check</span>
                </button>

                <button class="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-primary/5 transition-all flex items-center justify-between filter-opt group" data-value="OCR Processing">
                    <span class="flex items-center"><span class="w-2 h-2 rounded-full bg-blue-400 mr-3"></span>OCR Processing</span>
                    <span class="material-icons text-primary text-[18px] opacity-0 group-[.selected]:opacity-100">check</span>
                </button>
                
                <button class="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-primary/5 transition-all flex items-center justify-between filter-opt group" data-value="Completed">
                    <span class="flex items-center"><span class="w-2 h-2 rounded-full bg-green-500 mr-3"></span>Completed</span>
                    <span class="material-icons text-primary text-[18px] opacity-0 group-[.selected]:opacity-100">check</span>
                </button>
            </div>
        </div>
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

    <!-- New Patient Encounter Modal -->
    <div id="new-encounter-modal" class="fixed inset-0 z-[3000] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" style="display: none;">
      <div class="bg-white dark:bg-card-dark w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        <div class="px-8 py-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center" style="flex-shrink: 0;">
          <div>
            <h2 class="text-2xl font-bold text-slate-900 dark:text-white">Additional Patient Details</h2>
            <p class="text-slate-500 dark:text-slate-400 mt-1">Enter patient details to start consultation</p>
          </div>
          <span class="close-modal text-3xl cursor-pointer hover:text-slate-600" id="close-new-encounter-modal">&times;</span>
        </div>
        <div class="flex-1 overflow-y-auto custom-scrollbar px-8 py-6 space-y-8">
          <section>
            <h3 class="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Patient Identification</h3>
            <div class="grid grid-cols-1 gap-6">
              <div>
                <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Patient ID <span class="text-red-500">*</span>
                </label>
                <div class="relative group">
                  <input class="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-[#2463eb] font-bold focus:ring-2 focus:ring-[#2463eb]/50 focus:border-[#2463eb] transition-all pr-12" placeholder="Format: PID-XXXXX" type="text" value="PID-9822"/>
                  <div class="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                    <span class="material-icons text-green-500">check_circle</span>
                  </div>
                </div>
              </div>
              <div>
                <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Patient Search</label>
                <div class="relative">
                  <span class="material-icons absolute left-4 top-3.5 text-slate-400">search</span>
                  <input class="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#2463eb]/50" placeholder="Search by name, ID or phone..." type="text"/>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h3 class="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">Encounter Details</h3>
            <div class="space-y-6">
              <div>
                <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Chief Complaint</label>
                <textarea id="chief-complaint-textarea" class="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#2463eb]/50" placeholder="Describe symptoms..." rows="3"></textarea>
                <div class="mt-2 flex flex-wrap gap-2">
                  <span class="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-400 rounded-full cursor-pointer hover:bg-[#2463eb]/10 hover:text-[#2463eb] transition-colors border border-slate-200 dark:border-slate-700 symptom-tag" data-symptom="Fever">+ Fever</span>
                  <span class="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-400 rounded-full cursor-pointer hover:bg-[#2463eb]/10 hover:text-[#2463eb] transition-colors border border-slate-200 dark:border-slate-700 symptom-tag" data-symptom="Cough">+ Cough</span>
                  <span class="px-3 py-1 bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-600 dark:text-slate-400 rounded-full cursor-pointer hover:bg-[#2463eb]/10 hover:text-[#2463eb] transition-colors border border-slate-200 dark:border-slate-700 symptom-tag" data-symptom="Headache">+ Headache</span>
                </div>
              </div>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Language</label>
                  <select class="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#2463eb]/50">
                    <option>English</option>
                    <option>Tamil</option>
                    <option>Hindi</option>
                  </select>
                </div>
                <div>
                  <label class="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Visit Type</label>
                  <select class="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-[#2463eb]/50">
                    <option>Standard Consult</option>
                    <option>Follow-up</option>
                    <option>Emergency</option>
                  </select>
                </div>
              </div>
            </div>
          </section>

          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex gap-3">
            <span class="material-icons text-red-500">warning</span>
            <p class="text-sm font-medium text-red-800 dark:text-red-300">
              Tamil patients require manual verification before EMR save
            </p>
          </div>
        </div>
        <div class="px-8 py-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-4 sticky bottom-0" style="flex-shrink: 0;">
          <button class="px-6 py-3 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors" id="cancel-new-encounter-btn">
            Cancel
          </button>
          <button class="px-8 py-3 bg-[#2463eb] hover:bg-blue-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2" id="save-new-encounter-btn">
            <span>Save & Proceed</span>
            <span class="material-icons text-[18px]">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
    <!-- Data Export Modal -->
    <div id="export-modal" class="modal" style="display: none;">
      <div class="modal-content" style="max-width: 460px;">
        <div class="modal-header">
          <h3 style="margin:0;">Data Export Progress</h3>
          <span class="close-modal" id="close-export-modal">&times;</span>
        </div>
        <div class="modal-body" style="padding: 24px; text-align: center;">
          <div id="export-status-icon" style="margin-bottom: 16px;">
            <div class="spinner" style="width: 40px; height: 40px; margin: 0 auto; border-width: 3px;"></div>
          </div>
          <h4 id="export-status-title" style="margin-bottom: 8px;">Preparing export...</h4>
          <p id="export-status-msg" class="text-sm text-muted">Gathering clinical records and patient data.</p>
          
          <div style="width: 100%; height: 8px; background: var(--gray-100); border-radius: 4px; margin: 20px 0; overflow: hidden;">
            <div id="export-progress-fill" style="width: 0%; height: 100%; background: var(--primary-500); transition: width 0.3s ease;"></div>
          </div>
          <div style="display: flex; justify-content: space-between;" class="text-xs text-muted">
            <span id="export-progress-percent">0%</span>
            <span id="export-progress-items">0 / 12 records</span>
          </div>
        </div>
        <div class="modal-footer" id="export-footer" style="display: flex; gap: 12px; justify-content: center;">
          <button class="btn btn-secondary" id="cancel-export-btn" style="flex: 1;">Cancel</button>
        </div>
      </div>
    </div>
  `;

  const activePath = user?.role === 'doctor' ? '/doctor/queue' : '/nurse/queue';
  renderAppShell('Patient Queue', bodyHTML, activePath);

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

  // Filter Logic Variables
  let currentSearch = '';
  let currentFilter = 'all';

  const updateTable = () => {
    const rows = document.querySelectorAll('#queue-body tr');
    rows.forEach(row => {
      const textMatch = row.textContent.toLowerCase().includes(currentSearch.toLowerCase());
      const statusCell = row.querySelector('td:nth-child(6)')?.textContent || '';
      const filterMatch = currentFilter === 'all' || statusCell.includes(currentFilter);
      row.style.display = (textMatch && filterMatch) ? '' : 'none';
    });
  };

  // Custom Dropdown Logic
  const filterBtn = document.getElementById('queue-filter-btn');
  const filterMenu = document.getElementById('queue-dropdown-menu');

  // Set default selected
  filterMenu.querySelector('.filter-opt[data-value="all"]')?.classList.add('selected');

  filterBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    filterMenu.classList.toggle('hidden');
    if (!filterMenu.classList.contains('hidden')) {
      filterBtn.classList.add('border-primary', 'bg-primary/5', 'ring-2', 'ring-primary/20');
    } else {
      filterBtn.classList.remove('ring-2', 'ring-primary/20');
    }
  });

  document.querySelectorAll('.filter-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const val = opt.getAttribute('data-value');
      const label = opt.querySelector('span:not(.material-icons)')?.textContent.trim();

      currentFilter = val;

      // Update UI
      filterBtn.querySelector('span span:not(.material-icons-outlined)').textContent = label;
      document.querySelectorAll('.filter-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');

      filterMenu.classList.add('hidden');
      filterBtn.classList.add('border-primary', 'text-primary');
      filterBtn.classList.remove('ring-2', 'ring-primary/20');

      updateTable();
    });
  });

  // Global click to close
  window.addEventListener('click', () => {
    filterMenu.classList.add('hidden');
    filterBtn.classList.remove('ring-2', 'ring-primary/20');
  });

  document.getElementById('queue-search')?.addEventListener('input', (e) => {
    currentSearch = e.target.value;
    updateTable();
  });

  // Data Export Logic
  const exportModal = document.getElementById('export-modal');
  const progressFill = document.getElementById('export-progress-fill');
  const progressPercent = document.getElementById('export-progress-percent');
  const progressItems = document.getElementById('export-progress-items');
  const statusTitle = document.getElementById('export-status-title');
  const statusMsg = document.getElementById('export-status-msg');
  const statusIcon = document.getElementById('export-status-icon');
  const footer = document.getElementById('export-footer');

  let exportInterval;

  const startExport = () => {
    exportModal.style.display = 'flex';
    let progress = 0;
    const total = 12;

    progressFill.style.width = '0%';
    progressPercent.textContent = '0%';
    progressItems.textContent = `0 / ${total} records`;
    statusTitle.textContent = 'Preparing export...';
    statusMsg.textContent = 'Gathering clinical records and patient data.';
    statusIcon.innerHTML = '<div class="spinner" style="width: 40px; height: 40px; margin: 0 auto; border-width: 3px;"></div>';
    footer.innerHTML = '<button class="btn btn-secondary" id="cancel-export-btn" style="flex: 1;">Cancel</button>';

    document.getElementById('cancel-export-btn').onclick = () => {
      clearInterval(exportInterval);
      exportModal.style.display = 'none';
      showToast('Export cancelled', 'info');
    };

    exportInterval = setInterval(() => {
      progress += Math.floor(Math.random() * 15) + 5;
      if (progress >= 100) {
        progress = 100;
        clearInterval(exportInterval);
        finishExport();
      }
      const currentItem = Math.min(Math.floor((progress / 100) * total), total);
      progressFill.style.width = `${progress}%`;
      progressPercent.textContent = `${progress}%`;
      progressItems.textContent = `${currentItem} / ${total} records`;

      if (progress > 40) statusMsg.textContent = 'Encrypting sensitive data...';
      if (progress > 80) statusMsg.textContent = 'Finalizing package...';
    }, 400);
  };

  const finishExport = () => {
    statusTitle.textContent = 'Export Complete';
    statusMsg.textContent = 'The clinical data package is ready for download.';
    statusIcon.innerHTML = '<span class="material-icons-outlined" style="font-size: 56px; color: var(--success);">check_circle</span>';
    footer.innerHTML = `
            <button class="btn btn-secondary" id="close-export-btn" style="flex: 1;">Close</button>
            <button class="btn btn-primary" id="download-export-btn" style="flex: 1;">Download ZIP</button>
        `;
    document.getElementById('close-export-btn').onclick = () => exportModal.style.display = 'none';
    document.getElementById('download-export-btn').onclick = () => {
      showToast('Download started', 'success');
      exportModal.style.display = 'none';
    };
  };

  document.getElementById('export-queue-btn')?.addEventListener('click', startExport);
  document.getElementById('close-export-modal')?.addEventListener('click', () => {
    clearInterval(exportInterval);
    exportModal.style.display = 'none';
  });

  // New Encounter Modal Logic
  const newEncounterModal = document.getElementById('new-encounter-modal');
  const newEncounterBtn = document.getElementById('new-encounter-btn');
  const closeNewEncounterModal = document.getElementById('close-new-encounter-modal');
  const cancelNewEncounterBtn = document.getElementById('cancel-new-encounter-btn');
  const saveNewEncounterBtn = document.getElementById('save-new-encounter-btn');

  newEncounterBtn?.addEventListener('click', () => {
    newEncounterModal.style.display = 'flex';
  });

  const hideNewEncounterModal = () => {
    newEncounterModal.style.display = 'none';
  };

  closeNewEncounterModal?.addEventListener('click', hideNewEncounterModal);
  cancelNewEncounterBtn?.addEventListener('click', hideNewEncounterModal);

  saveNewEncounterBtn?.addEventListener('click', () => {
    // For now, just pretend it's saved and go to consultation
    hideNewEncounterModal();
    const user = getCurrentUser();
    if (user?.role === 'doctor') {
      location.hash = '#/doctor/consultation';
    } else {
      location.hash = '#/nurse/ocr';
    }
  });

  // Symptom Tag Logic
  const chiefComplaintArea = newEncounterModal.querySelector('textarea');
  newEncounterModal.querySelectorAll('.symptom-tag').forEach(tag => {
    tag.addEventListener('click', () => {
      const symptom = tag.getAttribute('data-symptom');
      const currentVal = chiefComplaintArea.value.trim();
      if (currentVal) {
        chiefComplaintArea.value = currentVal + ', ' + symptom;
      } else {
        chiefComplaintArea.value = symptom;
      }
      // Visual feedback
      tag.classList.add('bg-primary/20', 'text-primary');
      setTimeout(() => tag.classList.remove('bg-primary/20', 'text-primary'), 200);
    });
  });
}
