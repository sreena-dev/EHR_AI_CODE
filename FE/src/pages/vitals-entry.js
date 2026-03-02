/**
 * Vitals Entry Page — Design-System Compliant
 * Step 1: Patient Identification (existing/new) → Step 2: Vitals Entry
 * Matches OCR Upload page design patterns and uses real backend APIs.
 */
import { renderAppShell } from '../components/app-shell.js';
import { getCurrentUser } from '../api/auth.js';
import { searchPatients, registerPatient, createEncounter } from '../api/nurse.js';
import { showToast } from '../components/toast.js';

/* ── Persistent state ── */
let selectedPatient = null;
let patientMode = 'existing';
let activeVital = null;
let language = 'EN';

export async function renderVitalsEntry() {
  const user = getCurrentUser();

  /* ── Vital types metadata ── */
  const VITALS = {
    BP: { label: 'Blood Pressure', ta: 'இரத்த அழுத்தம்', icon: 'monitor_heart', unit: 'mmHg' },
    Temp: { label: 'Temperature', ta: 'வெப்பநிலை', icon: 'thermostat', unit: '°C' },
    SpO2: { label: 'Oxygen Saturation', ta: 'ஆக்ஸிஜன்', icon: 'water_drop', unit: '%' },
    Resp: { label: 'Respiratory Rate', ta: 'சுவாச விகிதம்', icon: 'air', unit: '/min' },
    HR: { label: 'Heart Rate', ta: 'இதயத் துடிப்பு', icon: 'favorite', unit: 'bpm' },
    Weight: { label: 'Weight', ta: 'எடை', icon: 'fitness_center', unit: 'kg' },
    Height: { label: 'Height', ta: 'உயரம்', icon: 'height', unit: 'cm' },
  };

  const bodyHTML = `
    <style>
        /* ── Shared card (same as OCR page) ── */
        .vitals-main { display: flex; flex-direction: column; flex: 1; overflow: hidden; position: relative; }

        /* ── Scrollbar ── */
        .vitals-scroll::-webkit-scrollbar { width: 5px; }
        .vitals-scroll::-webkit-scrollbar-track { background: transparent; }
        .vitals-scroll::-webkit-scrollbar-thumb { background-color: var(--gray-300); border-radius: 20px; }

        .patient-step-card {
            width: 100%; max-width: 640px; background: white;
            border-radius: var(--radius-xl); border: 1px solid var(--gray-100);
            box-shadow: var(--shadow-xl); padding: 36px 32px 28px;
        }
        .step-header { display: flex; align-items: center; gap: 14px; margin-bottom: 24px; }
        .step-header .icon-box {
            width: 42px; height: 42px; border-radius: var(--radius-lg);
            background: var(--primary-50); color: var(--primary-600);
            display: flex; align-items: center; justify-content: center;
        }
        .step-header h1 { font-size: 1.1rem; font-weight: 800; color: var(--gray-900); }
        .step-header h1 span { font-weight: 500; color: var(--gray-400); }

        /* ── Tabs ── */
        .patient-tabs { display: flex; gap: 8px; margin-bottom: 20px; }
        .patient-tab {
            flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
            padding: 10px; border: 2px solid var(--gray-100); border-radius: var(--radius-lg);
            background: white; font-size: 0.8rem; font-weight: 700;
            color: var(--gray-500); cursor: pointer; transition: all 0.2s ease;
        }
        .patient-tab:hover { border-color: var(--gray-200); background: var(--gray-50); }
        .patient-tab.active {
            border-color: var(--primary-500); background: var(--primary-50);
            color: var(--primary-700);
        }
        .patient-tab .material-icons-outlined { font-size: 18px; }

        /* ── Form fields ── */
        .oform-field { margin-bottom: 14px; }
        .oform-field label {
            display: block; font-size: 0.65rem; font-weight: 700;
            text-transform: uppercase; letter-spacing: 0.12em;
            color: var(--gray-500); margin-bottom: 6px;
        }
        .oform-field label .req { color: var(--error); }
        .oform-field input, .oform-field select {
            width: 100%; padding: 10px 14px; border: 1.5px solid var(--gray-200);
            border-radius: var(--radius-lg); font-size: 0.85rem; font-weight: 500;
            color: var(--gray-800); background: white; transition: all var(--transition-fast);
        }
        .oform-field input:focus, .oform-field select:focus {
            outline: none; border-color: var(--primary-500);
            box-shadow: 0 0 0 3px var(--primary-100);
        }
        .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
        @media (max-width: 600px) { .three-col { grid-template-columns: 1fr; } }
        .section-divider {
            font-size: 0.6rem; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.15em; color: var(--gray-400); margin: 18px 0 10px;
            display: flex; align-items: center; gap: 10px;
        }
        .section-divider::after { content: ''; flex: 1; height: 1px; background: var(--gray-100); }

        /* ── Search results ── */
        .search-results {
            max-height: 220px; overflow-y: auto; border: 1.5px solid var(--gray-100);
            border-radius: var(--radius-lg); margin-top: 8px;
        }
        .search-results .result-item {
            display: flex; align-items: center; gap: 12px; padding: 12px 16px;
            cursor: pointer; transition: background 0.15s;
        }
        .search-results .result-item:hover { background: var(--primary-50); }
        .search-results .result-item .avatar {
            width: 36px; height: 36px; border-radius: var(--radius-md);
            background: var(--primary-100); color: var(--primary-600);
            display: flex; align-items: center; justify-content: center;
            font-weight: 700; font-size: 0.8rem;
        }
        .search-results .result-item .name { font-weight: 700; font-size: 0.85rem; color: var(--gray-800); }
        .search-results .result-item .meta { font-size: 0.7rem; color: var(--gray-400); margin-top: 1px; }

        /* ── Selected patient banner ── */
        .selected-patient-banner {
            display: none; align-items: center; gap: 12px; padding: 14px 16px;
            background: var(--success-light, #ecfdf5); border: 1.5px solid var(--success, #22c55e);
            border-radius: var(--radius-lg); margin-top: 12px;
        }
        .selected-patient-banner.visible { display: flex; }
        .selected-patient-banner > .material-icons { color: var(--success); font-size: 22px; }
        .selected-patient-banner .details { flex: 1; }
        .selected-patient-banner .details .name { font-weight: 700; font-size: 0.85rem; color: var(--gray-800); }
        .selected-patient-banner .details .meta { font-size: 0.7rem; color: var(--gray-500); }

        /* ═══ VITALS ENTRY STEP ═══ */
        .vitals-entry-container { padding: 16px 24px; }

        /* ── Patient context bar ── */
        .vitals-patient-bar {
            display: flex; align-items: center; gap: 12px; padding: 12px 16px;
            background: white; border: 1.5px solid var(--gray-100);
            border-radius: var(--radius-lg); box-shadow: var(--shadow-sm);
            margin-bottom: 14px; flex-wrap: wrap;
        }
        .vitals-patient-bar .avatar {
            width: 38px; height: 38px; border-radius: var(--radius-md);
            background: var(--primary-100); color: var(--primary-700);
            display: flex; align-items: center; justify-content: center;
            font-weight: 800; font-size: 0.9rem;
        }
        .vitals-patient-bar .info { flex: 1; }
        .vitals-patient-bar .info .name { font-weight: 700; font-size: 0.95rem; color: var(--gray-800); }
        .vitals-patient-bar .info .meta {
            font-size: 0.7rem; color: var(--gray-400); display: flex;
            align-items: center; gap: 6px; margin-top: 2px; flex-wrap: wrap;
        }
        .vitals-patient-bar .change-btn {
            font-size: 0.7rem; font-weight: 700; color: var(--primary-500);
            background: none; border: none; cursor: pointer; text-decoration: underline;
        }
        .vitals-patient-bar .pid-badge {
            font-size: 0.6rem; font-weight: 700; padding: 2px 8px;
            background: var(--gray-100); color: var(--gray-500);
            border-radius: var(--radius-sm); letter-spacing: 0.05em;
        }

        /* ── Quick entry grid ── */
        .quick-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(105px, 1fr)); gap: 6px; margin-bottom: 14px; }
        .quick-btn {
            display: flex; flex-direction: column; align-items: center; gap: 4px;
            padding: 10px 6px; background: white; border: 1.5px solid var(--gray-200);
            border-radius: var(--radius-lg); cursor: pointer;
            transition: all 0.2s ease; text-align: center;
        }
        .quick-btn:hover { border-color: var(--primary-400); background: var(--primary-50); }
        .quick-btn.active { border-color: var(--primary-500); background: var(--primary-50); box-shadow: 0 0 0 3px var(--primary-100); }
        .quick-btn .material-icons { font-size: 20px; color: var(--gray-400); transition: color 0.2s; }
        .quick-btn:hover .material-icons, .quick-btn.active .material-icons { color: var(--primary-500); }
        .quick-btn .lbl { font-size: 0.55rem; font-weight: 700; color: var(--gray-600); text-transform: uppercase; letter-spacing: 0.06em; }

        /* ── Vital form card ── */
        .vital-form-card {
            background: white; border: 1.5px solid var(--gray-100);
            border-radius: var(--radius-xl); padding: 20px 20px;
            box-shadow: var(--shadow-md); margin-bottom: 14px;
        }
        .vital-form-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .vital-form-header .icon-box {
            width: 40px; height: 40px; border-radius: var(--radius-md);
            background: var(--primary-50); color: var(--primary-600);
            display: flex; align-items: center; justify-content: center;
        }
        .vital-form-header h3 { font-size: 1rem; font-weight: 700; color: var(--gray-800); }
        .vital-form-header p { font-size: 0.7rem; color: var(--gray-400); margin-top: 2px; }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

        /* ── Safety alerts ── */
        .safety-alert {
            display: none; align-items: center; gap: 6px; padding: 6px 12px;
            border-radius: var(--radius-md); font-size: 0.7rem; font-weight: 700; margin-top: 6px;
        }
        .safety-alert.visible { display: flex; }
        .safety-alert.alert-red { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        .safety-alert.alert-amber { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }

        /* ── Saved vitals list ── */
        .saved-vitals-card {
            background: white; border: 1.5px solid var(--gray-100);
            border-radius: var(--radius-xl); overflow: hidden; margin-bottom: 10px;
        }
        .saved-vitals-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 14px 20px; background: var(--gray-50);
            border-bottom: 1px solid var(--gray-100);
        }
        .saved-vitals-header h3 { font-size: 0.82rem; font-weight: 700; color: var(--gray-700); display: flex; align-items: center; gap: 8px; }
        .saved-vitals-header .saved-count {
            font-size: 0.6rem; font-weight: 700; padding: 2px 8px;
            background: var(--primary-50); color: var(--primary-600);
            border-radius: var(--radius-sm); text-transform: uppercase;
        }
        .saved-vital-row {
            display: flex; align-items: center; gap: 12px; padding: 12px 20px;
            border-bottom: 1px solid var(--gray-50); transition: background 0.15s;
        }
        .saved-vital-row:last-child { border-bottom: none; }
        .saved-vital-row:hover { background: var(--gray-50); }
        .saved-vital-row .v-icon {
            width: 34px; height: 34px; border-radius: var(--radius-md);
            background: var(--primary-50); color: var(--primary-600);
            display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .saved-vital-row .v-info { flex: 1; }
        .saved-vital-row .v-info .v-label { font-weight: 700; font-size: 0.82rem; color: var(--gray-800); }
        .saved-vital-row .v-info .v-time { font-size: 0.65rem; color: var(--gray-400); margin-top: 1px; }
        .saved-vital-row .v-value { font-weight: 700; font-size: 0.9rem; color: var(--gray-900); }
        .saved-vital-row .v-unit { font-size: 0.7rem; color: var(--gray-400); font-weight: 500; }
        .saved-vital-row .v-delete {
            opacity: 0; padding: 4px; border-radius: var(--radius-sm);
            border: none; background: none; color: var(--gray-300);
            cursor: pointer; transition: all 0.15s;
        }
        .saved-vital-row:hover .v-delete { opacity: 1; }
        .saved-vital-row .v-delete:hover { color: var(--error); background: #fef2f2; }

        /* ── Placeholder state ── */
        .form-placeholder {
            background: white; border: 2px dashed var(--gray-200);
            border-radius: var(--radius-xl); padding: 28px 20px;
            text-align: center;
        }
        .form-placeholder .material-icons { font-size: 32px; color: var(--gray-200); margin-bottom: 8px; }
        .form-placeholder h3 { font-size: 0.9rem; font-weight: 700; color: var(--gray-700); }
        .form-placeholder p { font-size: 0.75rem; color: var(--gray-400); margin-top: 4px; }

        /* ── Sticky footer ── */
        .vitals-sticky-footer {
            flex-shrink: 0; z-index: 20;
            padding: 12px 24px; background: rgba(255,255,255,0.97);
            backdrop-filter: blur(8px); border-top: 1px solid var(--gray-100);
            display: flex; align-items: center; justify-content: space-between;
            width: 100%;
        }
        .vitals-sticky-footer .cancel-btn {
            font-size: 0.75rem; font-weight: 700; color: var(--gray-500);
            background: none; border: none; cursor: pointer; text-transform: uppercase;
            letter-spacing: 0.1em; transition: color 0.15s;
        }
        .vitals-sticky-footer .cancel-btn:hover { color: var(--gray-800); }

        /* ── Lang toggle ── */
        .lang-toggle { display: flex; gap: 4px; background: var(--gray-100); border-radius: var(--radius-md); padding: 3px; }
        .lang-toggle button {
            padding: 4px 10px; border-radius: var(--radius-sm); font-size: 0.6rem;
            font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
            border: none; cursor: pointer; transition: all 0.15s; color: var(--gray-500); background: transparent;
        }
        .lang-toggle button.active { background: white; color: var(--gray-900); box-shadow: var(--shadow-sm); }

        /* ── OR divider ── */
        .or-divider { display: flex; align-items: center; gap: 12px; margin: 12px 0; }
        .or-divider::before, .or-divider::after { content: ''; flex: 1; height: 1px; background: var(--gray-100); }
        .or-divider span { font-size: 0.6rem; font-weight: 700; color: var(--gray-300); text-transform: uppercase; letter-spacing: 0.15em; }

        /* ── Animations ── */
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.3s ease; }
    </style>

    <div class="vitals-main">
        <!-- ═══════ STEP 1: PATIENT SELECTION ═══════ -->
        <div id="step-patient" style="flex:1; display:flex; align-items:flex-start; justify-content:center; padding:32px 24px; background:var(--gray-50); overflow-y:auto;">
            <div class="patient-step-card">
                <div class="step-header">
                    <div class="icon-box">
                        <span class="material-icons" style="font-size:22px;">monitor_heart</span>
                    </div>
                    <h1>Vitals Entry <span>/ Patient Selection</span></h1>
                </div>

                <!-- Tabs -->
                <div class="patient-tabs">
                    <button class="patient-tab active" id="tab-existing">
                        <span class="material-icons-outlined">search</span>
                        Existing Patient
                    </button>
                    <button class="patient-tab" id="tab-new">
                        <span class="material-icons-outlined">person_add</span>
                        New Patient
                    </button>
                </div>

                <!-- ── Existing Patient Panel ── -->
                <div id="panel-existing">
                    <div class="oform-field">
                        <label>Search Patient Registry</label>
                        <div style="position:relative;">
                            <span class="material-icons-outlined" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);font-size:18px;color:var(--gray-400);">search</span>
                            <input type="text" id="v-patient-search" placeholder="Search by name, PID, or phone number..." style="padding-left:40px;" />
                        </div>
                    </div>
                    <div class="search-results" id="v-search-results">
                        <div style="padding:24px;text-align:center;color:var(--gray-400);font-size:0.85rem;">
                            <span class="material-icons-outlined" style="font-size:32px;display:block;margin-bottom:8px;color:var(--gray-300);">person_search</span>
                            Start typing to search patients
                        </div>
                    </div>

                    <div class="selected-patient-banner" id="v-selected-banner">
                        <span class="material-icons">check_circle</span>
                        <div class="details">
                            <div class="name" id="v-selected-name"></div>
                            <div class="meta" id="v-selected-meta"></div>
                        </div>
                        <button class="btn btn-sm btn-ghost" id="v-clear-patient" style="font-size:0.75rem;">Change</button>
                    </div>
                </div>

                <!-- ── New Patient Panel ── -->
                <div id="panel-new" style="display:none;">
                    <div class="section-divider">Basic Information</div>
                    <div class="oform-field">
                        <label>Full Name <span class="req">*</span></label>
                        <input type="text" id="v-new-name" placeholder="Patient full name" />
                    </div>
                    <div class="three-col">
                        <div class="oform-field">
                            <label>Age <span class="req">*</span></label>
                            <input type="number" id="v-new-age" placeholder="Age" min="0" max="150" />
                        </div>
                        <div class="oform-field">
                            <label>Gender <span class="req">*</span></label>
                            <select id="v-new-gender">
                                <option value="">Select</option>
                                <option value="M">Male</option>
                                <option value="F">Female</option>
                                <option value="O">Other</option>
                            </select>
                        </div>
                        <div class="oform-field">
                            <label>Phone</label>
                            <input type="tel" id="v-new-phone" placeholder="Mobile number" />
                        </div>
                    </div>
                    <div class="oform-field">
                        <label>Address</label>
                        <input type="text" id="v-new-address" placeholder="Residential address" />
                    </div>
                </div>

                <!-- Proceed Button -->
                <div style="margin-top:28px; display:flex; justify-content:flex-end; gap:12px;">
                    <button class="btn btn-primary" id="v-proceed-btn" disabled style="height:44px; display:flex; align-items:center; gap:8px;">
                        <span>Continue to Vitals Entry</span>
                        <span class="material-icons" style="font-size:18px;">arrow_forward</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- ═══════ STEP 2: VITALS ENTRY ═══════ -->
        <div id="step-entry" style="flex:1; display:none; flex-direction:column; background:var(--gray-50); overflow:hidden;">
            <div class="vitals-entry-container vitals-scroll" style="flex:1; overflow-y:auto;">
                <!-- Patient Context -->
                <div class="vitals-patient-bar" id="vitals-patient-bar">
                    <div class="avatar" id="v-entry-avatar">—</div>
                    <div class="info">
                        <div class="name" id="v-entry-name">—</div>
                        <div class="meta">
                            <span id="v-entry-meta">—</span>
                            <span class="pid-badge" id="v-entry-pid">—</span>
                            <button class="change-btn" id="v-change-patient">← Change Patient</button>
                        </div>
                    </div>
                    <div class="lang-toggle">
                        <button id="lang-en" class="active">EN</button>
                        <button id="lang-ta">Tamil</button>
                    </div>
                </div>

                <!-- Quick Entry Grid -->
                <div class="quick-grid" id="v-quick-grid"></div>

                <!-- Dynamic Form Area -->
                <div id="v-form-area">
                    <div class="form-placeholder">
                        <span class="material-icons">pulse</span>
                        <h3>Ready for Vitals Entry</h3>
                        <p>Select a metric from the quick buttons above to begin.</p>
                    </div>
                </div>

                <!-- Saved Vitals -->
                <div class="saved-vitals-card" id="v-saved-card" style="display:none;">
                    <div class="saved-vitals-header">
                        <h3><span class="material-icons" style="font-size:16px;color:var(--primary-500);">assignment_turned_in</span> Saved Vitals</h3>
                        <span class="saved-count" id="v-saved-count">0 recorded</span>
                    </div>
                    <div id="v-saved-list"></div>
                </div>
            </div>

            <!-- Sticky Footer -->
            <div class="vitals-sticky-footer">
                <button class="cancel-btn" id="v-cancel-btn">Cancel</button>
                <div style="display:flex;gap:10px;">
                    <button class="btn btn-secondary" id="v-save-another" disabled style="font-size:0.75rem;height:38px;">
                        Save & Add Another
                    </button>
                    <button class="btn btn-primary" id="v-save-btn" disabled style="font-size:0.75rem;height:38px;">
                        Save Vital Sign
                    </button>
                </div>
            </div>
        </div>
    </div>
    `;

  renderAppShell('Vitals Entry', bodyHTML, '/nurse/vitals');

  /* ═══════════════ STATE ═══════════════ */
  const stepPatient = document.getElementById('step-patient');
  const stepEntry = document.getElementById('step-entry');

  /* ═══════════════ STEP 1 LOGIC ═══════════════ */
  const tabExisting = document.getElementById('tab-existing');
  const tabNew = document.getElementById('tab-new');
  const panelExisting = document.getElementById('panel-existing');
  const panelNew = document.getElementById('panel-new');
  const proceedBtn = document.getElementById('v-proceed-btn');
  const searchInput = document.getElementById('v-patient-search');
  const searchResults = document.getElementById('v-search-results');
  const selectedBanner = document.getElementById('v-selected-banner');

  // Tab switching
  tabExisting.addEventListener('click', () => {
    patientMode = 'existing';
    tabExisting.classList.add('active'); tabNew.classList.remove('active');
    panelExisting.style.display = ''; panelNew.style.display = 'none';
    updateProceedState();
  });
  tabNew.addEventListener('click', () => {
    patientMode = 'new';
    tabNew.classList.add('active'); tabExisting.classList.remove('active');
    panelNew.style.display = ''; panelExisting.style.display = 'none';
    updateProceedState();
  });

  function updateProceedState() {
    if (patientMode === 'existing') {
      proceedBtn.disabled = !selectedPatient;
    } else {
      const name = document.getElementById('v-new-name')?.value?.trim();
      const age = document.getElementById('v-new-age')?.value?.trim();
      const gender = document.getElementById('v-new-gender')?.value;
      proceedBtn.disabled = !(name && age && gender);
    }
  }

  // New patient form listeners
  ['v-new-name', 'v-new-age', 'v-new-gender'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateProceedState);
    document.getElementById(id)?.addEventListener('change', updateProceedState);
  });

  // Patient search — calls backend API with debounce
  let searchTimeout = null;
  searchInput?.addEventListener('input', () => {
    const query = searchInput.value.trim();
    clearTimeout(searchTimeout);

    if (query.length < 2) {
      searchResults.innerHTML = `
                <div style="padding:24px;text-align:center;color:var(--gray-400);font-size:0.85rem;">
                    <span class="material-icons-outlined" style="font-size:32px;display:block;margin-bottom:8px;color:var(--gray-300);">person_search</span>
                    Start typing to search patients
                </div>`;
      return;
    }

    searchResults.innerHTML = `
            <div style="padding:16px;text-align:center;color:var(--gray-400);font-size:0.8rem;">
                <span class="spinner" style="margin-right:8px;"></span> Searching...
            </div>`;

    searchTimeout = setTimeout(async () => {
      try {
        // Search backend API
        const data = await searchPatients(query);
        const patients = data.patients || [];

        if (patients.length === 0) {
          searchResults.innerHTML = `
                        <div style="padding:20px;text-align:center;color:var(--gray-400);font-size:0.8rem;">
                            <span class="material-icons-outlined" style="font-size:24px;display:block;margin-bottom:6px;color:var(--gray-300);">search_off</span>
                            No patients found for "${query}"
                        </div>`;
          return;
        }

        searchResults.innerHTML = patients.map(p => `
                    <div class="result-item" data-pid="${p.id}" data-name="${p.name}" data-age="${p.age || ''}" data-gender="${p.gender || ''}" data-phone="${p.phone || ''}">
                        <div class="avatar">${(p.name || '?').charAt(0).toUpperCase()}</div>
                        <div style="flex:1;">
                            <div class="name">${p.name}</div>
                            <div class="meta">${p.id} · ${p.age || '—'}y / ${p.gender || '—'}${p.phone ? ' · ' + p.phone : ''}</div>
                        </div>
                    </div>
                `).join('');

      } catch (err) {
        searchResults.innerHTML = `
                    <div style="padding:16px;text-align:center;color:var(--error);font-size:0.8rem;">
                        <span class="material-icons-outlined" style="font-size:20px;">error</span> Search failed — ${err.message}
                    </div>`;
      }
    }, 350);
  });

  // Select patient from search results
  searchResults.addEventListener('click', (e) => {
    const item = e.target.closest('.result-item');
    if (!item) return;
    selectedPatient = {
      id: item.dataset.pid,
      name: item.dataset.name,
      age: item.dataset.age,
      gender: item.dataset.gender,
      phone: item.dataset.phone,
    };
    document.getElementById('v-selected-name').textContent = selectedPatient.name;
    document.getElementById('v-selected-meta').textContent = `${selectedPatient.id} · ${selectedPatient.age}y / ${selectedPatient.gender}`;
    selectedBanner.classList.add('visible');
    searchResults.style.display = 'none';
    searchInput.style.display = 'none';
    updateProceedState();
  });

  // Clear patient selection
  document.getElementById('v-clear-patient')?.addEventListener('click', () => {
    selectedPatient = null;
    selectedBanner.classList.remove('visible');
    searchResults.style.display = '';
    searchInput.style.display = '';
    searchInput.value = '';
    searchResults.innerHTML = `
            <div style="padding:24px;text-align:center;color:var(--gray-400);font-size:0.85rem;">
                <span class="material-icons-outlined" style="font-size:32px;display:block;margin-bottom:8px;color:var(--gray-300);">person_search</span>
                Start typing to search patients
            </div>`;
    updateProceedState();
  });

  // Proceed button
  proceedBtn.addEventListener('click', async () => {
    if (patientMode === 'new') {
      const nameVal = document.getElementById('v-new-name').value.trim();
      const ageVal = parseInt(document.getElementById('v-new-age').value);
      const genderVal = document.getElementById('v-new-gender').value;
      const phoneVal = document.getElementById('v-new-phone')?.value?.trim() || '';
      const addressVal = document.getElementById('v-new-address')?.value?.trim() || '';

      proceedBtn.disabled = true;
      proceedBtn.innerHTML = '<span class="spinner" style="margin-right:8px;"></span> Registering...';
      try {
        const result = await registerPatient({ name: nameVal, age: ageVal, gender: genderVal, phone: phoneVal, address: addressVal });
        selectedPatient = result.patient;
        showToast(`Patient ${selectedPatient.id} registered successfully`, 'success');

        // Create registration encounter in backend DB
        try {
          await createEncounter({
            patient_name: selectedPatient.name,
            patient_id: selectedPatient.id,
            type: 'Patient Registration',
            status: 'Completed',
            age: selectedPatient.age || null,
            gender: selectedPatient.gender || '',
          });
        } catch (e) { console.warn('Registration encounter sync failed:', e); }
      } catch (err) {
        // ── Handle duplicate patient detection ──
        if (err.duplicate && err.existingPatient) {
          const ep = err.existingPatient;
          const useExisting = confirm(
            `⚠️ Duplicate Patient Detected!\n\n` +
            `A patient with similar details already exists:\n` +
            `  Name: ${ep.name}\n` +
            `  ID: ${ep.id}\n` +
            `  Age: ${ep.age || '—'} / Gender: ${ep.gender || '—'}\n` +
            `  Phone: ${ep.phone || '—'}\n\n` +
            `Click OK to use the existing patient record.\n` +
            `Click Cancel to create a new record anyway.`
          );
          if (useExisting) {
            selectedPatient = ep;
            showToast(`Using existing patient: ${ep.name} (${ep.id})`, 'info');
          } else {
            try {
              const result = await registerPatient({
                name: nameVal, age: ageVal, gender: genderVal,
                phone: phoneVal, address: addressVal, force: true,
              });
              selectedPatient = result.patient;
              showToast(`New patient ${selectedPatient.id} created`, 'success');
            } catch (forceErr) {
              showToast(forceErr.message || 'Registration failed', 'error');
              proceedBtn.disabled = false;
              proceedBtn.innerHTML = '<span>Continue to Vitals Entry</span><span class="material-icons" style="font-size:18px;">arrow_forward</span>';
              return;
            }
          }
        } else {
          showToast(err.message || 'Registration failed', 'error');
          proceedBtn.disabled = false;
          proceedBtn.innerHTML = '<span>Continue to Vitals Entry</span><span class="material-icons" style="font-size:18px;">arrow_forward</span>';
          return;
        }
      }
    }

    // Transition to vitals entry step
    stepPatient.style.display = 'none';
    stepEntry.style.display = 'flex';
    setupEntryStep();
  });

  /* ═══════════════ STEP 2 LOGIC ═══════════════ */
  function setupEntryStep() {
    if (!selectedPatient) return;

    // Populate patient context bar
    document.getElementById('v-entry-avatar').textContent = (selectedPatient.name || '?').charAt(0).toUpperCase();
    document.getElementById('v-entry-name').textContent = selectedPatient.name || '—';
    document.getElementById('v-entry-meta').textContent = `${selectedPatient.age || '—'}y / ${selectedPatient.gender || '—'}`;
    document.getElementById('v-entry-pid').textContent = selectedPatient.id || '—';

    const formArea = document.getElementById('v-form-area');
    const saveBtn = document.getElementById('v-save-btn');
    const saveAnother = document.getElementById('v-save-another');

    // Quick entry grid
    const gridEl = document.getElementById('v-quick-grid');
    const getLabel = (key) => language === 'EN' ? VITALS[key].label : VITALS[key].ta;
    function renderQuickGrid() {
      gridEl.innerHTML = Object.keys(VITALS).map(key => `
                <button class="quick-btn ${activeVital === key ? 'active' : ''}" data-vital="${key}">
                    <span class="material-icons">${VITALS[key].icon}</span>
                    <span class="lbl">${getLabel(key)}</span>
                </button>
            `).join('');
    }
    renderQuickGrid();

    // Grid click
    gridEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.quick-btn');
      if (!btn) return;
      loadVitalForm(btn.dataset.vital);
    });

    // Language toggle
    document.getElementById('lang-en')?.addEventListener('click', () => { language = 'EN'; renderQuickGrid(); });
    document.getElementById('lang-ta')?.addEventListener('click', () => {
      language = 'TA';
      renderQuickGrid();
      document.getElementById('lang-ta').classList.add('active');
      document.getElementById('lang-en').classList.remove('active');
    });
    document.getElementById('lang-en')?.addEventListener('click', () => {
      document.getElementById('lang-en').classList.add('active');
      document.getElementById('lang-ta').classList.remove('active');
    });

    // Change patient
    document.getElementById('v-change-patient')?.addEventListener('click', () => {
      selectedPatient = null;
      activeVital = null;
      patientMode = 'existing';
      stepEntry.style.display = 'none';
      stepPatient.style.display = 'flex';
      // Reset tabs
      tabExisting.classList.add('active'); tabNew.classList.remove('active');
      panelExisting.style.display = ''; panelNew.style.display = 'none';
      selectedBanner.classList.remove('visible');
      searchResults.style.display = '';
      searchInput.style.display = '';
      searchInput.value = '';
      updateProceedState();
    });

    // Cancel
    document.getElementById('v-cancel-btn')?.addEventListener('click', () => { location.hash = '#/nurse/dashboard'; });

    // Load vital form
    function loadVitalForm(key) {
      activeVital = key;
      renderQuickGrid();
      saveBtn.disabled = false;
      saveAnother.disabled = false;

      const label = getLabel(key);
      let fieldsHTML = '';

      if (key === 'BP') {
        fieldsHTML = `
                    <div class="two-col">
                        <div class="oform-field">
                            <label>Systolic (mmHg)</label>
                            <input type="number" id="bp-systolic" placeholder="120" autofocus />
                            <div class="safety-alert" id="bp-sys-alert"></div>
                        </div>
                        <div class="oform-field">
                            <label>Diastolic (mmHg)</label>
                            <input type="number" id="bp-diastolic" placeholder="80" />
                            <div class="safety-alert" id="bp-dia-alert"></div>
                        </div>
                    </div>
                    <div class="two-col" style="margin-top:12px;">
                        <div class="oform-field">
                            <label>Position</label>
                            <select id="bp-position"><option>Sitting</option><option>Standing</option><option>Lying</option></select>
                        </div>
                        <div class="oform-field">
                            <label>Measurement Arm</label>
                            <select id="bp-arm"><option>Right Arm</option><option>Left Arm</option></select>
                        </div>
                    </div>`;
      } else if (key === 'Temp') {
        fieldsHTML = `
                    <div class="two-col">
                        <div class="oform-field">
                            <label>Temperature Value (°C)</label>
                            <input type="number" step="0.1" id="temp-value" placeholder="36.8" autofocus />
                            <div class="safety-alert" id="temp-alert"></div>
                        </div>
                        <div class="oform-field">
                            <label>Measurement Route</label>
                            <select id="temp-route"><option>Oral</option><option>Axillary</option><option>Tympanic</option><option>Rectal</option></select>
                        </div>
                    </div>`;
      } else {
        fieldsHTML = `
                    <div class="oform-field" style="max-width:300px;">
                        <label>Measured Value (${VITALS[key].unit})</label>
                        <input type="number" id="generic-value" placeholder="0" autofocus />
                    </div>`;
      }

      formArea.innerHTML = `
                <div class="vital-form-card fade-in">
                    <div class="vital-form-header">
                        <div class="icon-box"><span class="material-icons" style="font-size:20px;">${VITALS[key].icon}</span></div>
                        <div>
                            <h3>${label}</h3>
                            <p>${key === 'BP' ? 'Capture arterial blood pressure readings' : key === 'Temp' ? 'Core body temperature measurement' : 'Standard clinical measurement'}</p>
                        </div>
                    </div>
                    ${fieldsHTML}
                    <div class="oform-field" style="margin-top:16px;">
                        <label>Clinical Observations (optional)</label>
                        <textarea id="vital-notes" rows="2" style="width:100%;padding:10px 14px;border:1.5px solid var(--gray-200);border-radius:var(--radius-lg);font-size:0.82rem;font-weight:500;color:var(--gray-800);resize:none;transition:all var(--transition-fast);" placeholder="Add any notes..."></textarea>
                    </div>
                </div>`;

      // Safety alerts for BP
      if (key === 'BP') {
        const sysInput = document.getElementById('bp-systolic');
        const sysAlert = document.getElementById('bp-sys-alert');
        sysInput?.addEventListener('input', () => {
          const v = parseInt(sysInput.value);
          if (v > 180 || v < 90) {
            sysAlert.innerHTML = '<span class="material-icons" style="font-size:14px;">warning</span> Critical Value!';
            sysAlert.className = 'safety-alert alert-red visible';
          } else if (v > 140) {
            sysAlert.innerHTML = '<span class="material-icons" style="font-size:14px;">info</span> High Reading';
            sysAlert.className = 'safety-alert alert-amber visible';
          } else {
            sysAlert.className = 'safety-alert';
          }
        });
      }

      // Safety alerts for Temp
      if (key === 'Temp') {
        const tempInput = document.getElementById('temp-value');
        const tempAlert = document.getElementById('temp-alert');
        tempInput?.addEventListener('input', () => {
          const v = parseFloat(tempInput.value);
          if (v > 40) {
            tempAlert.innerHTML = '<span class="material-icons" style="font-size:14px;">warning</span> Critical Fever!';
            tempAlert.className = 'safety-alert alert-red visible';
          } else if (v > 38.5) {
            tempAlert.innerHTML = '<span class="material-icons" style="font-size:14px;">local_fire_department</span> Fever Alert';
            tempAlert.className = 'safety-alert alert-amber visible';
          } else {
            tempAlert.className = 'safety-alert';
          }
        });
      }
    }

    // Collect value
    function collectVitalValue() {
      if (!activeVital) return null;
      let value = '', unit = '';
      if (activeVital === 'BP') {
        const sys = document.getElementById('bp-systolic')?.value;
        const dia = document.getElementById('bp-diastolic')?.value;
        if (!sys || !dia) return null;
        value = `${sys}/${dia}`;
        unit = 'mmHg';
      } else if (activeVital === 'Temp') {
        const temp = document.getElementById('temp-value')?.value;
        if (!temp) return null;
        value = temp;
        unit = '°C';
      } else {
        const input = document.getElementById('generic-value');
        if (!input?.value) return null;
        value = input.value;
        unit = VITALS[activeVital]?.unit || '';
      }
      return {
        type: activeVital,
        label: VITALS[activeVital].label,
        icon: VITALS[activeVital].icon,
        value, unit,
        encounterId: `VIT-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}`,
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        timestamp: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      };
    }

    // Save
    function doSave(redirectAfter) {
      const entry = collectVitalValue();
      if (!entry) {
        showToast('Please enter a value first', 'error');
        return;
      }
      saveBtn.innerHTML = '<span class="material-icons" style="font-size:16px;animation:spin 1s linear infinite;">sync</span> Saving...';
      saveBtn.disabled = true;
      saveAnother.disabled = true;

      setTimeout(async () => {
        // Persist vitals to localStorage (until vitals API is built)
        const vKey = `vitals_${selectedPatient.id}`;
        let existing = [];
        try { existing = JSON.parse(localStorage.getItem(vKey) || '[]'); } catch { existing = []; }
        existing.push(entry);
        localStorage.setItem(vKey, JSON.stringify(existing));

        // Save encounter to backend DB
        try {
          await createEncounter({
            id: entry.encounterId,
            patient_name: selectedPatient.name,
            patient_id: selectedPatient.id,
            type: 'Vitals Entry',
            status: 'Completed',
            age: selectedPatient.age || null,
            gender: selectedPatient.gender || '',
          });
        } catch (e) { console.warn('Vitals encounter sync failed:', e); }

        showToast(`${entry.label} (${entry.value} ${entry.unit}) saved for ${selectedPatient.name}`, 'success');

        if (redirectAfter) {
          location.hash = '#/nurse/dashboard';
        } else {
          activeVital = null;
          renderQuickGrid();
          formArea.innerHTML = `
                        <div class="form-placeholder fade-in">
                            <span class="material-icons">pulse</span>
                            <h3>Select another vital to record</h3>
                            <p>Use the quick buttons above to continue.</p>
                        </div>`;
          saveBtn.innerHTML = 'Save Vital Sign';
          saveBtn.disabled = true;
          saveAnother.disabled = true;
          renderSavedVitals();
        }
      }, 800);
    }

    saveBtn?.addEventListener('click', () => doSave(true));
    saveAnother?.addEventListener('click', () => doSave(false));

    // Render saved vitals
    function renderSavedVitals() {
      const listEl = document.getElementById('v-saved-list');
      const countEl = document.getElementById('v-saved-count');
      const cardEl = document.getElementById('v-saved-card');
      if (!listEl || !selectedPatient) return;

      let saved = [];
      try { saved = JSON.parse(localStorage.getItem(`vitals_${selectedPatient.id}`) || '[]'); } catch { saved = []; }
      countEl.textContent = `${saved.length} recorded`;

      if (saved.length === 0) {
        cardEl.style.display = 'none';
        return;
      }

      cardEl.style.display = '';

      listEl.innerHTML = saved.map((v, i) => `
                <div class="saved-vital-row" data-idx="${i}">
                    <div class="v-icon"><span class="material-icons" style="font-size:16px;">${v.icon || 'monitor_heart'}</span></div>
                    <div class="v-info">
                        <div class="v-label">${v.label}</div>
                        <div class="v-time">${v.timestamp} · ${v.encounterId || '—'}</div>
                    </div>
                    <span class="v-value">${v.value} <span class="v-unit">${v.unit || ''}</span></span>
                    <button class="v-delete" data-idx="${i}"><span class="material-icons" style="font-size:16px;">close</span></button>
                </div>
            `).join('');

      // Delete handlers
      listEl.querySelectorAll('.v-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(btn.dataset.idx);
          saved.splice(idx, 1);
          localStorage.setItem(`vitals_${selectedPatient.id}`, JSON.stringify(saved));
          renderSavedVitals();
          showToast('Vital removed', 'info');
        });
      });
    }

    renderSavedVitals();
  }
}
