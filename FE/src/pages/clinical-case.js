/**
 * Clinical Verification Case — Full case review with tabbed sections
 * Matches Stitch "Generated Screen" (Clinical Verification - Case #12944)
 */
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { renderAppShell } from '../components/app-shell.js';

export async function renderClinicalCase() {
  // Mock case data
  const caseData = {
    caseId: '12944',
    department: 'Emergency Department',
    patient: {
      name: 'Harold Finch',
      age: 42,
      gender: 'Male',
      mrn: 'PAT-4281',
      bloodType: 'O+',
      allergies: ['Penicillin', 'Sulfa'],
      language: 'Tamil / English',
    },
    encounter: {
      id: 'ENC-20260221-012',
      date: '21 Feb 2026, 09:30 AM',
      type: 'Emergency Visit',
      triageLevel: 'Urgent',
    },
    vitals: {
      bp: '145/90 mmHg',
      hr: '98 bpm',
      rr: '20/min',
      temp: '37.2°C',
      spo2: '97%',
    },
    diagnosis: {
      primary: 'Severe Chest Pain',
      description: 'Patient reports 3 days of acute onset chest pain. No history of similar episodes.',
      differentials: ['Acute Coronary Syndrome', 'Musculoskeletal Pain', 'GERD', 'Anxiety'],
    },
    medications: [
      { name: 'Aspirin', dose: '325 mg', route: 'PO', frequency: 'Stat', status: 'Ordered' },
      { name: 'Nitroglycerin SL', dose: '0.4 mg', route: 'SL', frequency: 'PRN', status: 'Ordered' },
      { name: 'Pantoprazole', dose: '40 mg', route: 'IV', frequency: 'Daily', status: 'Pending' },
      { name: 'Morphine', dose: '2 mg', route: 'IV', frequency: 'PRN', status: 'Pending' },
    ],
    procedures: [
      { name: '12-Lead ECG', status: 'Ordered', priority: 'Stat' },
      { name: 'Troponin I', status: 'Ordered', priority: 'Stat' },
      { name: 'Chest X-Ray', status: 'Pending', priority: 'Urgent' },
      { name: 'CBC + BMP', status: 'Ordered', priority: 'Routine' },
    ],
    safetyAlerts: [
      { icon: 'warning', text: 'OCR Review Needed: Low confidence Tamil transcription', severity: 'warning' },
      { icon: 'medication', text: 'Medication dosage requires verification', severity: 'error' },
      { icon: 'person', text: 'Patient age must be confirmed', severity: 'warning' },
    ],
    followUp: 'Cardiology consult within 24 hours. Repeat troponin in 6 hours. Discharge planning pending test results.',
    education: 'Patient educated on chest pain warning signs, when to call 911, nitroglycerin usage instructions.',
    additionalDetails: {
      previousAdmissions: '3 admissions for hypertension (2022-2024)',
      familyHistory: 'Father: MI at 55. Mother: Diabetic.',
      socialHistory: 'Non-smoker. Occasional alcohol. High-stress job.',
      insurance: 'BlueCross Platinum - Active',
      preferredPharmacy: 'Apollo Pharmacy - Anna Nagar',
    }
  };

  const tabs = [
    { id: 'demographics', label: 'Demographics', icon: 'person' },
    { id: 'diagnosis', label: 'Diagnosis & Treatment', icon: 'medical_information' },
    { id: 'focused-objective', label: 'Focused Objective', icon: 'troubleshoot' },
    { id: 'focused-assessment', label: 'Focused Assessment', icon: 'biotech' },
    { id: 'medications', label: 'Medications', icon: 'medication' },
    { id: 'plan', label: 'Treatment Plan', icon: 'checklist' },
  ];

  renderAppShell('Clinical Verification', `
    <div style="max-width: 1100px; margin: 0 auto;">
      <!-- Case Header -->
      <div class="card" style="margin-bottom: 20px; border-left: 4px solid var(--primary-500);">
        <div class="card-body" style="padding: 16px 20px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;">
            <div>
              <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                <h2 style="margin: 0;">Case #${caseData.caseId}</h2>
                <span class="badge badge-info">${caseData.department}</span>
                <span class="badge badge-warning">${caseData.encounter.triageLevel}</span>
              </div>
              <div style="display: flex; align-items: center; gap: 16px; flex-wrap: wrap;">
                <span style="font-weight: 600;">${caseData.patient.name}</span>
                <span class="text-sm text-muted">${caseData.patient.age}Y • ${caseData.patient.gender}</span>
                <span class="badge badge-neutral">${caseData.patient.mrn}</span>
                <span class="text-sm text-muted">Blood: ${caseData.patient.bloodType}</span>
                <button class="btn btn-ghost btn-sm" id="view-additional-details" style="padding: 2px 8px; font-size: 11px;">
                  <span class="material-icons-outlined" style="font-size: 14px;">visibility</span>
                  View Additional Details
                </button>
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary" id="edit-mode-btn">
                <span class="material-icons-outlined" style="font-size: 16px;">edit</span>
                Edit Mode
              </button>
              <button class="btn btn-success" id="approve-case-btn">
                <span class="material-icons-outlined" style="font-size: 16px;">verified</span>
                Approve & Sign
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Edit Mode Banner -->
      <div class="alert alert-warning" style="margin-bottom: 20px;" id="edit-banner" style="display: none;">
        <span class="material-icons-outlined" style="font-size: 18px;">edit_note</span>
        <div><strong>Manual edit mode active</strong> — Ensure all data matches original image precisely before resubmitting</div>
      </div>

      <!-- Tabs -->
      <div class="case-tabs" style="display: flex; gap: 2px; margin-bottom: 20px; background: var(--gray-100); border-radius: var(--radius-md); padding: 4px;">
        ${tabs.map((tab, i) => `
          <button class="case-tab ${i === 0 ? 'active' : ''}" data-tab="${tab.id}">
            <span class="material-icons-outlined" style="font-size: 16px;">${tab.icon}</span>
            ${tab.label}
          </button>
        `).join('')}
      </div>

      <!-- Tab: Demographics -->
      <div class="tab-panel active" id="panel-demographics">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div class="card">
            <div class="card-header"><h3 style="margin:0;">Patient Information</h3></div>
            <div class="card-body" style="padding: 0;">
              <div class="summary-row"><span class="summary-label">Full Name</span><span class="summary-value">${caseData.patient.name}</span></div>
              <div class="summary-row"><span class="summary-label">Age / Gender</span><span class="summary-value">${caseData.patient.age} years / ${caseData.patient.gender}</span></div>
              <div class="summary-row"><span class="summary-label">MRN</span><span class="summary-value">${caseData.patient.mrn}</span></div>
              <div class="summary-row"><span class="summary-label">Blood Type</span><span class="summary-value">${caseData.patient.bloodType}</span></div>
              <div class="summary-row"><span class="summary-label">Language</span><span class="summary-value">${caseData.patient.language}</span></div>
              <div class="summary-row">
                <span class="summary-label">Allergies</span>
                <span class="summary-value">${caseData.patient.allergies.map(a => `<span class="badge badge-error" style="margin-right:4px;">${a}</span>`).join('')}</span>
              </div>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h3 style="margin:0;">Encounter Details</h3></div>
            <div class="card-body" style="padding: 0;">
              <div class="summary-row"><span class="summary-label">Encounter ID</span><span class="summary-value" style="font-weight:600;">${caseData.encounter.id}</span></div>
              <div class="summary-row"><span class="summary-label">Date</span><span class="summary-value">${caseData.encounter.date}</span></div>
              <div class="summary-row"><span class="summary-label">Type</span><span class="summary-value">${caseData.encounter.type}</span></div>
              <div class="summary-row"><span class="summary-label">Triage Level</span><span class="badge badge-warning">${caseData.encounter.triageLevel}</span></div>
            </div>
          </div>
          <div class="card" style="grid-column: span 2;">
            <div class="card-header"><h3 style="margin:0;">Vitals</h3></div>
            <div class="card-body">
              <div style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px;">
                ${Object.entries(caseData.vitals).map(([key, val]) => `
                  <div class="stat-mini">
                    <div class="stat-mini-label">${key.toUpperCase()}</div>
                    <div class="stat-mini-value" style="font-size: 1.125rem;">${val}</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: Diagnosis & Treatment -->
      <div class="tab-panel" id="panel-diagnosis" style="display: none;">
        <div class="card" style="margin-bottom: 20px;">
          <div class="card-header">
            <h3 style="margin:0; display: flex; align-items: center; gap: 8px;">
              <span class="material-icons-outlined" style="font-size: 18px; color: var(--error);">emergency</span>
              Primary Diagnosis
            </h3>
          </div>
          <div class="card-body">
            <h3 style="margin-bottom: 8px; color: var(--error);">${caseData.diagnosis.primary}</h3>
            <p class="text-sm" style="margin-bottom: 16px;">${caseData.diagnosis.description}</p>
            <div>
              <div class="text-xs text-muted" style="margin-bottom: 6px;">Differential Diagnoses</div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${caseData.diagnosis.differentials.map(d => `<span class="badge badge-neutral">${d}</span>`).join('')}
              </div>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3 style="margin:0;">Procedures & Tests</h3></div>
          <div class="card-body" style="padding: 0;">
            <table class="table" style="margin: 0;">
              <thead><tr><th>Procedure</th><th>Status</th><th>Priority</th></tr></thead>
              <tbody>
                ${caseData.procedures.map(p => `
                  <tr>
                    <td style="font-weight: 600;">${p.name}</td>
                    <td><span class="badge ${p.status === 'Ordered' ? 'badge-success' : 'badge-warning'}">${p.status}</span></td>
                    <td><span class="badge ${p.priority === 'Stat' ? 'badge-error' : p.priority === 'Urgent' ? 'badge-warning' : 'badge-neutral'}">${p.priority}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Tab: Focused Objective -->
      <div class="tab-panel" id="panel-focused-objective" style="display: none;">
        <div class="card">
          <div class="card-header">
            <h3 style="margin:0;">Focused Objective Verification</h3>
            <span class="badge badge-info">AI Suggestions Available</span>
          </div>
          <div class="card-body">
            <div style="background: var(--gray-50); padding: 16px; border-radius: var(--radius-md); margin-bottom: 20px; border-left: 4px solid var(--info);">
              <p class="text-sm"><strong>AI Insight:</strong> Based on the audio transcription and OCR data, the following objective findings require specific validation.</p>
            </div>
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div class="verify-item-detailed" style="display: flex; gap: 16px; padding: 16px; border: 1px solid var(--gray-200); border-radius: var(--radius-md);">
                <div style="width: 24px;"><span class="material-icons-outlined text-info">monitor_heart</span></div>
                <div style="flex: 1;">
                   <h4 style="margin: 0 0 4px;">Cardiovascular Examination</h4>
                   <p class="text-sm text-muted">S1 and S2 heard clearly. No murmurs or gallops. Peripheral pulses symmetric and 2+.</p>
                </div>
                <label class="switch"><input type="checkbox" checked><span class="slider round"></span></label>
              </div>
              <div class="verify-item-detailed" style="display: flex; gap: 16px; padding: 16px; border: 1px solid var(--gray-200); border-radius: var(--radius-md);">
                <div style="width: 24px;"><span class="material-icons-outlined text-info">air</span></div>
                <div style="flex: 1;">
                   <h4 style="margin: 0 0 4px;">Respiratory findings</h4>
                   <p class="text-sm text-muted">Clear to auscultation bilaterally. No rales, rhonchi, or wheezes. Non-labored breathing.</p>
                </div>
                <label class="switch"><input type="checkbox" checked><span class="slider round"></span></label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: Focused Assessment -->
      <div class="tab-panel" id="panel-focused-assessment" style="display: none;">
        <div class="card">
          <div class="card-header">
            <h3 style="margin:0;">Focused Assessment Insights</h3>
          </div>
          <div class="card-body">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
               <div class="card" style="box-shadow: none; border: 1px solid var(--gray-100);">
                  <div class="card-header" style="padding: 8px 16px;"><h4 style="margin:0;">Clinical Reasoning</h4></div>
                  <div class="card-body">
                    <p class="text-xs text-muted" style="line-height: 1.6;">AI identified potential Acute Coronary Syndrome based on sudden chest pain and BP elevation. Troponin results are critical for finalizing this assessment.</p>
                  </div>
               </div>
               <div class="card" style="box-shadow: none; border: 1px solid var(--gray-100);">
                  <div class="card-header" style="padding: 8px 16px;"><h4 style="margin:0;">Risk Stratification</h4></div>
                  <div class="card-body">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span class="badge badge-error">High Risk</span>
                        <span class="text-xs">HEART Score: 6</span>
                    </div>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Tab: Medications -->
      <div class="tab-panel" id="panel-medications" style="display: none;">
        <div class="card">
          <div class="card-header">
            <h3 style="margin:0;">Current Medications</h3>
            <button class="btn btn-sm btn-primary" id="add-med-btn">
              <span class="material-icons-outlined" style="font-size: 16px;">add</span> Add
            </button>
          </div>
          <div class="card-body" style="padding: 0;">
            <table class="table" style="margin: 0;">
              <thead><tr><th>Medication</th><th>Dose</th><th>Route</th><th>Frequency</th><th>Status</th></tr></thead>
              <tbody>
                ${caseData.medications.map(m => `
                  <tr>
                    <td style="font-weight: 600;">${m.name}</td>
                    <td>${m.dose}</td>
                    <td><span class="badge badge-neutral">${m.route}</span></td>
                    <td>${m.frequency}</td>
                    <td><span class="badge ${m.status === 'Ordered' ? 'badge-success' : 'badge-warning'}">${m.status}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Tab: Treatment Plan -->
      <div class="tab-panel" id="panel-plan" style="display: none;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
          <div class="card">
            <div class="card-header"><h3 style="margin:0;">Follow-up</h3></div>
            <div class="card-body"><p class="text-sm">${caseData.followUp}</p></div>
          </div>
          <div class="card">
            <div class="card-header"><h3 style="margin:0;">Patient Education</h3></div>
            <div class="card-body"><p class="text-sm">${caseData.education}</p></div>
          </div>
        </div>
      </div>

      <!-- Safety Alerts -->
      <div class="card" style="margin-top: 20px; border-left: 4px solid var(--error);">
        <div class="card-header">
          <h3 style="margin:0; display: flex; align-items: center; gap: 8px;">
            <span class="material-icons-outlined" style="font-size: 18px; color: var(--error);">shield</span>
            Critical Safety Alerts
          </h3>
        </div>
        <div class="card-body" style="display: flex; flex-direction: column; gap: 10px;">
          ${caseData.safetyAlerts.map(alert => `
            <div class="alert alert-${alert.severity}" style="margin: 0;">
              <span class="material-icons-outlined" style="font-size: 18px;">${alert.icon}</span>
              <span>${alert.text}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Verification Checklist -->
      <div class="card" style="margin-top: 20px;">
        <div class="card-header">
          <h3 style="margin:0; display: flex; align-items: center; gap: 8px;">
            <span class="material-icons-outlined" style="font-size: 18px; color: var(--primary-500);">fact_check</span>
            Verification Checklist
          </h3>
          <span class="badge badge-neutral" id="checklist-count">0/5 verified</span>
        </div>
        <div class="card-body" style="display: flex; flex-direction: column; gap: 10px;">
          ${[
      'Patient demographics are accurate and complete',
      'Diagnosis and differentials reviewed',
      'Medication doses and routes verified',
      'All ordered tests and procedures confirmed',
      'Safety alerts addressed and documented',
    ].map((item, i) => `
            <label class="verify-item" style="display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: var(--gray-50); border-radius: var(--radius-md); cursor: pointer;">
              <input type="checkbox" class="case-verify-cb" data-idx="${i}" style="accent-color: var(--success); width: 18px; height: 18px;" />
              <span class="text-sm">${item}</span>
            </label>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Additional Details Modal -->
    <div id="details-modal" class="modal" style="display: none;">
      <div class="modal-content" style="max-width: 500px;">
        <div class="modal-header">
          <h3 style="margin:0;">Additional Patient Details</h3>
          <span class="close-modal" id="close-details-modal">&times;</span>
        </div>
        <div class="modal-body" style="padding: 0;">
          <div class="summary-row"><span class="summary-label">Previous Admissions</span><span class="summary-value">${caseData.additionalDetails.previousAdmissions}</span></div>
          <div class="summary-row"><span class="summary-label">Family History</span><span class="summary-value">${caseData.additionalDetails.familyHistory}</span></div>
          <div class="summary-row"><span class="summary-label">Social History</span><span class="summary-value">${caseData.additionalDetails.socialHistory}</span></div>
          <div class="summary-row"><span class="summary-label">Insurance</span><span class="summary-value">${caseData.additionalDetails.insurance}</span></div>
          <div class="summary-row"><span class="summary-label">Pharmacy</span><span class="summary-value">${caseData.additionalDetails.preferredPharmacy}</span></div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-primary" id="close-details-btn">Close</button>
        </div>
      </div>
    </div>

    <style>
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
      .modal-body { max-height: 70vh; overflow-y: auto; }
      .modal-footer { padding: 16px 20px; border-top: 1px solid var(--gray-100); display: flex; justify-content: flex-end; }
      .close-modal { font-size: 24px; cursor: pointer; color: var(--gray-400); }
      @keyframes modalSlide { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

      /* Toggle Switch Styles */
      .switch { position: relative; display: inline-block; width: 36px; height: 20px; }
      .switch input { opacity: 0; width: 0; height: 0; }
      .slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--gray-300); transition: .3s; border-radius: 20px; }
      .slider:before { position: absolute; content: ""; height: 14px; width: 14px; left: 3px; bottom: 3px; background-color: white; transition: .3s; border-radius: 50%; }
      input:checked + .slider { background-color: var(--success); }
      input:checked + .slider:before { transform: translateX(16px); }

      .case-tab {
        flex: 1;
        padding: 10px 16px;
        border: none;
        background: transparent;
        border-radius: var(--radius-sm);
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--gray-500);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        transition: all 0.15s ease;
      }
      .case-tab:hover { color: var(--gray-700); }
      .case-tab.active {
        background: white;
        color: var(--primary-600);
        box-shadow: var(--shadow-sm);
      }
      .tab-panel { animation: fadeIn 0.2s ease; }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
    </style>
  `, '/doctor/notes');

  // Tab switching
  document.querySelectorAll('.case-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.case-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.style.display = 'none');
      tab.classList.add('active');
      const panel = document.getElementById(`panel-${tab.dataset.tab}`);
      if (panel) panel.style.display = 'block';
    });
  });

  // Verification checklist counter
  document.querySelectorAll('.case-verify-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      const checked = document.querySelectorAll('.case-verify-cb:checked').length;
      const total = document.querySelectorAll('.case-verify-cb').length;
      document.getElementById('checklist-count').textContent = `${checked}/${total} verified`;
      document.getElementById('checklist-count').className = checked === total ? 'badge badge-success' : 'badge badge-neutral';
    });
  });

  // Approve button
  document.getElementById('approve-case-btn')?.addEventListener('click', () => {
    const checked = document.querySelectorAll('.case-verify-cb:checked').length;
    const total = document.querySelectorAll('.case-verify-cb').length;
    if (checked < total) {
      showToast(`Please complete all verification items (${checked}/${total})`, 'warning');
      return;
    }
    showToast('Case approved and signed!', 'success');
    setTimeout(() => navigate('/doctor/dashboard'), 1000);
  });

  // Edit mode toggle
  document.getElementById('edit-mode-btn')?.addEventListener('click', () => {
    const banner = document.getElementById('edit-banner');
    banner.style.display = banner.style.display === 'none' ? 'flex' : 'none';
    showToast('Edit mode toggled', 'info');
  });

  // Add medication
  document.getElementById('add-med-btn')?.addEventListener('click', () => {
    showToast('Add medication dialog coming soon', 'info');
  });

  // Modal Logic
  const detailsModal = document.getElementById('details-modal');
  document.getElementById('view-additional-details')?.addEventListener('click', () => {
    detailsModal.style.display = 'flex';
  });
  document.getElementById('close-details-modal')?.addEventListener('click', () => {
    detailsModal.style.display = 'none';
  });
  document.getElementById('close-details-btn')?.addEventListener('click', () => {
    detailsModal.style.display = 'none';
  });
  window.addEventListener('click', (e) => {
    if (e.target === detailsModal) detailsModal.style.display = 'none';
  });
}
