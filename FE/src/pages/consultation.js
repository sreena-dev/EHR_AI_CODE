/**
 * Consultation Page — Doctor Consultation with Patient Context Sidebar
 * Shows nurse-entered prescriptions, OCR results, vitals, and medical reports.
 * Auto-fills encounter/patient from URL params when navigating from dashboard.
 */
import { renderAppShell } from '../components/app-shell.js';
import { getCurrentUser } from '../api/auth.js';
import { transcribeAudio, generateNote, verifyNote, fetchPatientDetail } from '../api/doctor.js';
import { showToast } from '../components/toast.js';

export async function renderConsultation() {
  const user = getCurrentUser();

  // Parse URL params
  const hashParts = location.hash.split('?');
  const params = new URLSearchParams(hashParts[1] || '');
  const urlEncounter = params.get('encounter') || '';
  const urlPatient = params.get('patient') || '';

  const bodyHTML = `
    <style>
      .consult-layout { display: grid; grid-template-columns: 1fr 380px; gap: 20px; align-items: start; }
      @media (max-width: 1024px) { .consult-layout { grid-template-columns: 1fr; } }

      .step-pill {
        flex: 1; padding: 8px 12px; background: var(--gray-100);
        border-radius: var(--radius-md); font-size: 0.8rem; font-weight: 600;
        color: var(--gray-400); text-align: center; transition: all 0.2s ease;
      }
      .step-pill span {
        display: inline-flex; width: 22px; height: 22px; align-items: center;
        justify-content: center; border-radius: 50%; background: var(--gray-200);
        color: var(--gray-500); font-size: 0.7rem; margin-right: 6px;
      }
      .step-pill.active { background: var(--primary-50); color: var(--primary-700); }
      .step-pill.active span { background: var(--primary-500); color: white; }
      .step-pill.done { background: #ecfdf5; color: #059669; }
      .step-pill.done span { background: #059669; color: white; }

      /* ── Sidebar ── */
      .patient-sidebar { position: sticky; top: 16px; }
      .sidebar-card {
        background: white; border: 1.5px solid var(--gray-100);
        border-radius: var(--radius-xl); overflow: hidden; margin-bottom: 14px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
      }
      .sidebar-card-header {
        display: flex; align-items: center; gap: 8px; padding: 12px 16px;
        background: var(--gray-50); border-bottom: 1px solid var(--gray-100);
        font-size: 0.8rem; font-weight: 700; color: var(--gray-700);
      }
      .sidebar-card-header .material-icons { font-size: 18px; color: var(--primary-500); }
      .sidebar-card-body { padding: 14px 16px; }
      .sidebar-card-body.empty {
        padding: 20px 16px; text-align: center; color: var(--gray-400); font-size: 0.8rem;
      }

      .patient-info-row {
        display: flex; justify-content: space-between; padding: 6px 0;
        font-size: 0.8rem; border-bottom: 1px solid var(--gray-50);
      }
      .patient-info-row:last-child { border-bottom: none; }
      .patient-info-row .lbl { color: var(--gray-400); font-weight: 500; }
      .patient-info-row .val { color: var(--gray-800); font-weight: 600; }

      .vital-chip {
        display: inline-flex; align-items: center; gap: 6px;
        padding: 6px 12px; background: var(--gray-50); border-radius: var(--radius-md);
        font-size: 0.78rem; margin: 3px;
      }
      .vital-chip .v-label { color: var(--gray-500); font-weight: 500; }
      .vital-chip .v-val { color: var(--gray-900); font-weight: 700; }

      .ocr-item {
        padding: 10px 0; border-bottom: 1px solid var(--gray-50);
      }
      .ocr-item:last-child { border-bottom: none; }
      .ocr-item-header {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 6px;
      }
      .ocr-item-header .doc-type {
        font-size: 0.75rem; font-weight: 700; color: var(--primary-600);
        text-transform: uppercase; letter-spacing: 0.05em;
      }
      .ocr-item-header .conf {
        font-size: 0.7rem; font-weight: 600; padding: 2px 8px;
        border-radius: var(--radius-sm);
      }
      .conf-high { background: #ecfdf5; color: #059669; }
      .conf-mid { background: #fffbeb; color: #b45309; }
      .conf-low { background: #fef2f2; color: #b91c1c; }
      .ocr-text-preview {
        font-size: 0.78rem; line-height: 1.5; color: var(--gray-700);
        background: var(--gray-50); padding: 8px 12px; border-radius: var(--radius-md);
        max-height: 120px; overflow-y: auto; white-space: pre-wrap;
        border: 1px solid var(--gray-100);
      }
      .ocr-meta { font-size: 0.68rem; color: var(--gray-400); margin-top: 4px; }

      .enc-history-item {
        display: flex; align-items: center; gap: 10px; padding: 8px 0;
        border-bottom: 1px solid var(--gray-50); font-size: 0.78rem;
      }
      .enc-history-item:last-child { border-bottom: none; }
      .enc-dot {
        width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
      }
      .enc-dot.completed { background: #059669; }
      .enc-dot.waiting { background: #f59e0b; }
      .enc-dot.active { background: var(--primary-500); }

      .sidebar-loading {
        padding: 24px; text-align: center; color: var(--gray-400); font-size: 0.8rem;
      }

      /* Safety flag badges */
      .safety-flag {
        display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px;
        background: #fef2f2; color: #b91c1c; border-radius: var(--radius-sm);
        font-size: 0.68rem; font-weight: 700; margin: 2px;
      }
    </style>

    <div class="consult-layout">
      <!-- ═══ LEFT: Consultation Workflow ═══ -->
      <div>
        <!-- Step Indicator -->
        <div style="display:flex; gap:4px; margin-bottom:16px;">
          <div class="step-pill active" id="step1-indicator"><span>1</span> Audio</div>
          <div class="step-pill" id="step2-indicator"><span>2</span> Review</div>
          <div class="step-pill" id="step3-indicator"><span>3</span> Note</div>
          <div class="step-pill" id="step4-indicator"><span>4</span> Save</div>
        </div>

        <!-- Encounter Info -->
        <div class="card" style="margin-bottom:12px;">
          <div class="card-body" style="padding: 12px 16px;">
            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px;">
              <div class="form-group">
                <label class="form-label text-xs">Encounter ID *</label>
                <input type="text" id="consult-encounter" class="form-input btn-sm" placeholder="ENC-2026-001" value="${urlEncounter}" required />
              </div>
              <div class="form-group">
                <label class="form-label text-xs">Patient ID *</label>
                <input type="text" id="consult-patient" class="form-input btn-sm" placeholder="PID-10001" value="${urlPatient}" required />
              </div>
              <div class="form-group">
                <label class="form-label text-xs">Language</label>
                <select id="consult-language" class="form-select btn-sm">
                  <option value="">Auto Detect</option>
                  <option value="en">English</option>
                  <option value="ta">Tamil</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <!-- Step 1: Audio Upload -->
        <div class="card" id="step1-card" style="margin-bottom:20px;">
          <div class="card-header">
            <h3 style="font-size:1rem;">
              <span class="material-icons-outlined" style="font-size:20px; vertical-align:middle;">mic</span>
              Step 1: Upload Consultation Audio
            </h3>
          </div>
          <div class="card-body">
            <div class="upload-area" id="audio-upload-area">
              <input type="file" id="audio-input" accept="audio/wav,audio/mpeg,audio/mp3,audio/x-wav" style="display:none;" />
              <span class="material-icons-outlined">audio_file</span>
              <h3 style="margin-bottom:4px;">Upload consultation audio</h3>
              <p class="text-muted text-sm">WAV or MP3 format</p>
              <p id="audio-file-name" class="text-sm" style="margin-top:8px; color:var(--primary-500); font-weight:600; display:none;"></p>
            </div>
            <button id="transcribe-btn" class="btn btn-primary btn-block" style="margin-top:16px;" disabled>
              <span class="material-icons-outlined" style="font-size:18px">record_voice_over</span>
              <span id="transcribe-text">Transcribe Audio</span>
              <span id="transcribe-spinner" class="spinner" style="display:none;"></span>
            </button>
          </div>
        </div>

        <!-- Step 2: Transcript Review -->
        <div class="card" id="step2-card" style="margin-bottom:20px; display:none;">
          <div class="card-header">
            <h3 style="font-size:1rem;">
              <span class="material-icons-outlined" style="font-size:20px; vertical-align:middle;">subtitles</span>
              Step 2: Review Transcript
            </h3>
            <span id="transcript-status" class="badge"></span>
          </div>
          <div class="card-body">
            <div id="transcript-alert"></div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px;">
              <div>
                <div class="text-xs text-muted">Language Detected</div>
                <div style="font-weight:600;" id="transcript-lang">-</div>
              </div>
              <div>
                <div class="text-xs text-muted">Confidence</div>
                <div style="font-weight:600;" id="transcript-conf">-</div>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Full Transcript</label>
              <textarea class="form-textarea" id="transcript-text" style="min-height:200px;"></textarea>
            </div>
            <button id="generate-note-btn" class="btn btn-primary" style="margin-top:16px;">
              <span class="material-icons-outlined" style="font-size:18px">auto_fix_high</span>
              <span id="generate-text">Generate Clinical Note</span>
              <span id="generate-spinner" class="spinner" style="display:none;"></span>
            </button>
          </div>
        </div>

        <!-- Step 3: Clinical Note -->
        <div class="card" id="step3-card" style="margin-bottom:20px; display:none;">
          <div class="card-header">
            <h3 style="font-size:1rem;">
              <span class="material-icons-outlined" style="font-size:20px; vertical-align:middle;">description</span>
              Step 3: Review Clinical Note Draft
            </h3>
          </div>
          <div class="card-body">
            <div class="alert alert-info">
              <span class="material-icons-outlined" style="font-size:18px">info</span>
              <div>AI-generated draft. <strong>You must review and edit</strong> before saving to EMR.</div>
            </div>
            <div id="note-content"></div>
            <div class="form-group" style="margin-top:16px;">
              <label class="form-label">Edit Note (required before verification)</label>
              <textarea class="form-textarea" id="note-text" style="min-height:250px;"></textarea>
            </div>
            <div id="note-safety-flags" style="margin-top:12px;"></div>
            <button id="verify-btn" class="btn btn-success btn-lg" style="margin-top:16px;">
              <span class="material-icons-outlined" style="font-size:18px">verified</span>
              <span id="verify-text">Verify & Save to EMR</span>
              <span id="verify-spinner" class="spinner" style="display:none;"></span>
            </button>
          </div>
        </div>

        <!-- Step 4: Success -->
        <div class="card" id="step4-card" style="display:none;">
          <div class="card-body" style="text-align:center; padding:48px;">
            <span class="material-icons-outlined" style="font-size:64px; color:var(--success);">check_circle</span>
            <h2 style="margin-top:16px;">Clinical Note Saved to EMR</h2>
            <p class="text-muted" style="margin-top:8px;" id="emr-message">Note verified and saved successfully.</p>
            <div style="margin-top:24px; display:flex; gap:12px; justify-content:center;">
              <a href="#/doctor/dashboard" class="btn btn-primary">Back to Dashboard</a>
              <button class="btn btn-secondary" onclick="location.reload()">New Consultation</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══ RIGHT: Patient Context Sidebar ═══ -->
      <div class="patient-sidebar" id="patient-sidebar">
        ${urlPatient ? `
          <div class="sidebar-loading">
            <span class="spinner" style="margin-right:8px;"></span> Loading patient details…
          </div>
        ` : `
          <div class="sidebar-card">
            <div class="sidebar-card-body empty">
              <span class="material-icons-outlined" style="font-size:32px; display:block; margin-bottom:8px; color:var(--gray-300);">person_search</span>
              Enter a Patient ID to view their medical context
            </div>
          </div>
        `}
      </div>
    </div>
  `;

  const activePath = location.hash.startsWith('#/doctor/notes') ? '/doctor/notes' : '/doctor/consultation';
  renderAppShell('Consultation', bodyHTML, activePath);

  /* ═══════════════════════════════════════════ */
  /*       PATIENT CONTEXT SIDEBAR              */
  /* ═══════════════════════════════════════════ */
  const sidebar = document.getElementById('patient-sidebar');

  async function loadPatientContext(patientId) {
    if (!patientId) return;
    sidebar.innerHTML = `<div class="sidebar-loading"><span class="spinner" style="margin-right:8px;"></span> Loading patient details…</div>`;

    try {
      const data = await fetchPatientDetail(patientId);
      const p = data.patient;
      const encounters = data.encounters || [];

      // Collect all OCR results and vitals across encounters
      let allOCR = [];
      let allVitals = [];
      let safetyFlags = [];

      encounters.forEach(enc => {
        (enc.ocr_results || []).forEach(ocr => {
          allOCR.push({ ...ocr, encounter_id: enc.id, enc_type: enc.type });
          (ocr.safety_flags || []).forEach(f => { if (!safetyFlags.includes(f)) safetyFlags.push(f); });
        });
        if (enc.vitals) {
          allVitals.push({ ...enc.vitals, encounter_id: enc.id });
        }
      });

      // ── Build sidebar HTML ──
      let html = '';

      // Patient Info Card
      html += `
        <div class="sidebar-card">
          <div class="sidebar-card-header">
            <span class="material-icons">person</span> Patient Information
          </div>
          <div class="sidebar-card-body">
            <div class="patient-info-row"><span class="lbl">Name</span><span class="val">${p.name || '—'}</span></div>
            <div class="patient-info-row"><span class="lbl">ID</span><span class="val">${p.id || '—'}</span></div>
            <div class="patient-info-row"><span class="lbl">Age / Gender</span><span class="val">${p.age || '—'}y / ${p.gender || '—'}</span></div>
            <div class="patient-info-row"><span class="lbl">Phone</span><span class="val">${p.phone || '—'}</span></div>
            ${p.blood_group ? `<div class="patient-info-row"><span class="lbl">Blood Group</span><span class="val">${p.blood_group}</span></div>` : ''}
            ${p.allergies ? `<div class="patient-info-row"><span class="lbl">Allergies</span><span class="val" style="color:#b91c1c;">${p.allergies}</span></div>` : ''}
            ${p.medical_history ? `<div class="patient-info-row"><span class="lbl">History</span><span class="val">${p.medical_history}</span></div>` : ''}
          </div>
        </div>`;

      // Safety flags
      if (safetyFlags.length > 0) {
        html += `
          <div class="sidebar-card" style="border-color:#fecaca;">
            <div class="sidebar-card-header" style="background:#fef2f2; color:#b91c1c;">
              <span class="material-icons" style="color:#b91c1c;">warning</span> Safety Alerts
            </div>
            <div class="sidebar-card-body">
              ${safetyFlags.map(f => `<span class="safety-flag"><span class="material-icons" style="font-size:14px;">error</span>${f}</span>`).join('')}
            </div>
          </div>`;
      }

      // Vitals Card
      html += `
        <div class="sidebar-card">
          <div class="sidebar-card-header">
            <span class="material-icons">monitor_heart</span> Vitals
            <span style="margin-left:auto; font-size:0.68rem; color:var(--gray-400);">${allVitals.length} recorded</span>
          </div>`;

      if (allVitals.length === 0) {
        html += `<div class="sidebar-card-body empty">No vitals recorded yet</div>`;
      } else {
        html += `<div class="sidebar-card-body">`;
        allVitals.forEach(v => {
          const chips = [];
          if (v.bp_systolic && v.bp_diastolic) chips.push({ label: 'BP', val: `${v.bp_systolic}/${v.bp_diastolic} mmHg` });
          if (v.pulse) chips.push({ label: 'Pulse', val: `${v.pulse} bpm` });
          if (v.temperature) chips.push({ label: 'Temp', val: `${v.temperature}°C` });
          if (v.spo2) chips.push({ label: 'SpO₂', val: `${v.spo2}%` });
          if (v.resp_rate) chips.push({ label: 'RR', val: `${v.resp_rate}/min` });
          if (v.weight) chips.push({ label: 'Weight', val: `${v.weight} kg` });
          if (v.height) chips.push({ label: 'Height', val: `${v.height} cm` });

          html += `<div style="margin-bottom:8px;">
            <div style="font-size:0.68rem; color:var(--gray-400); margin-bottom:4px;">${v.recorded_at || '—'} · ${v.encounter_id}</div>
            <div style="display:flex; flex-wrap:wrap; gap:2px;">
              ${chips.map(c => `<span class="vital-chip"><span class="v-label">${c.label}</span><span class="v-val">${c.val}</span></span>`).join('')}
            </div>
            ${v.notes ? `<div style="font-size:0.75rem; color:var(--gray-600); margin-top:4px; font-style:italic;">${v.notes}</div>` : ''}
          </div>`;
        });
        html += `</div>`;
      }
      html += `</div>`;

      // Prescriptions / OCR Results Card
      html += `
        <div class="sidebar-card">
          <div class="sidebar-card-header">
            <span class="material-icons">receipt_long</span> Prescriptions & Reports
            <span style="margin-left:auto; font-size:0.68rem; color:var(--gray-400);">${allOCR.length} document${allOCR.length !== 1 ? 's' : ''}</span>
          </div>`;

      if (allOCR.length === 0) {
        html += `<div class="sidebar-card-body empty">No prescriptions or reports uploaded</div>`;
      } else {
        html += `<div class="sidebar-card-body">`;
        allOCR.forEach(ocr => {
          const conf = ocr.confidence || 0;
          const confClass = conf >= 80 ? 'conf-high' : conf >= 50 ? 'conf-mid' : 'conf-low';
          const displayText = ocr.normalized_text || ocr.raw_text || '(no text extracted)';

          html += `
            <div class="ocr-item">
              <div class="ocr-item-header">
                <span class="doc-type">${ocr.document_type || 'Document'}</span>
                <span class="conf ${confClass}">${conf.toFixed(0)}% conf</span>
              </div>
              <div class="ocr-text-preview">${displayText}</div>
              <div class="ocr-meta">${ocr.created_at} · ${ocr.encounter_id}${ocr.requires_review ? ' · <span style="color:#b91c1c; font-weight:700;">⚠ Review needed</span>' : ''}</div>
            </div>`;
        });
        html += `</div>`;
      }
      html += `</div>`;

      // Encounter History Card
      html += `
        <div class="sidebar-card">
          <div class="sidebar-card-header">
            <span class="material-icons">history</span> Encounter History
          </div>`;

      if (encounters.length === 0) {
        html += `<div class="sidebar-card-body empty">No encounters</div>`;
      } else {
        html += `<div class="sidebar-card-body">`;
        encounters.forEach(enc => {
          const dotClass = enc.status === 'Completed' ? 'completed' : enc.status === 'Waiting' ? 'waiting' : 'active';
          html += `
            <div class="enc-history-item">
              <span class="enc-dot ${dotClass}"></span>
              <div style="flex:1;">
                <div style="font-weight:600; color:var(--gray-800);">${enc.type}</div>
                <div style="color:var(--gray-400); font-size:0.7rem;">${enc.id} · ${enc.created_at}</div>
              </div>
              <span class="badge ${enc.status === 'Completed' ? 'badge-success' : 'badge-warning'}" style="font-size:0.65rem;">${enc.status}</span>
            </div>`;
        });
        html += `</div>`;
      }
      html += `</div>`;

      sidebar.innerHTML = html;

    } catch (err) {
      sidebar.innerHTML = `
        <div class="sidebar-card">
          <div class="sidebar-card-body" style="text-align:center; padding:24px; color:var(--error);">
            <span class="material-icons-outlined" style="font-size:24px; display:block; margin-bottom:8px;">error</span>
            Failed to load patient data<br>
            <span style="font-size:0.75rem; color:var(--gray-400);">${err.message}</span>
          </div>
        </div>`;
    }
  }

  // Auto-load patient context if URL has patient ID
  if (urlPatient) {
    loadPatientContext(urlPatient);
  }

  // Also load when patient ID field changes
  let patientLoadTimeout;
  document.getElementById('consult-patient')?.addEventListener('blur', () => {
    const pid = document.getElementById('consult-patient').value.trim();
    if (pid) {
      clearTimeout(patientLoadTimeout);
      patientLoadTimeout = setTimeout(() => loadPatientContext(pid), 300);
    }
  });

  /* ═══════════════════════════════════════════ */
  /*       CONSULTATION WORKFLOW                */
  /* ═══════════════════════════════════════════ */
  let selectedAudio = null;

  const audioUploadArea = document.getElementById('audio-upload-area');
  const audioInput = document.getElementById('audio-input');
  const transcribeBtn = document.getElementById('transcribe-btn');

  audioUploadArea.addEventListener('click', () => audioInput.click());
  audioInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      selectedAudio = e.target.files[0];
      const nameEl = document.getElementById('audio-file-name');
      nameEl.textContent = `${selectedAudio.name} (${(selectedAudio.size / 1024).toFixed(0)} KB)`;
      nameEl.style.display = 'block';
      transcribeBtn.disabled = false;
    }
  });

  // Step 1: Transcribe
  transcribeBtn.addEventListener('click', async () => {
    if (!selectedAudio) return;
    const encounterId = document.getElementById('consult-encounter').value.trim();
    const patientId = document.getElementById('consult-patient').value.trim();
    if (!encounterId || !patientId) {
      showToast('Please fill in Encounter ID and Patient ID', 'warning');
      return;
    }

    transcribeBtn.disabled = true;
    document.getElementById('transcribe-text').textContent = 'Transcribing...';
    document.getElementById('transcribe-spinner').style.display = 'inline-block';

    try {
      const result = await transcribeAudio({
        audio: selectedAudio,
        encounterId,
        patientId,
        languageHint: document.getElementById('consult-language').value || undefined,
      });

      document.getElementById('step2-card').style.display = 'block';
      document.getElementById('transcript-text').value = result.transcript || '';
      document.getElementById('transcript-lang').textContent = result.language || 'Unknown';
      document.getElementById('transcript-conf').textContent = result.confidence ? `${(result.confidence * 100).toFixed(0)}%` : '-';

      const statusBadge = document.getElementById('transcript-status');
      statusBadge.className = result.status === 'success' ? 'badge badge-success' : 'badge badge-warning';
      statusBadge.textContent = result.status === 'success' ? 'Complete' : 'Low Confidence';

      if (result.requires_verification) {
        document.getElementById('transcript-alert').innerHTML = `
          <div class="alert alert-warning">
            <span class="material-icons-outlined" style="font-size:18px">warning</span>
            <div>Please review the transcript carefully before generating a note.</div>
          </div>`;
      }

      document.getElementById('step1-indicator').classList.remove('active');
      document.getElementById('step1-indicator').classList.add('done');
      document.getElementById('step2-indicator').classList.add('active');
      showToast('Transcription complete!', 'success');

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      transcribeBtn.disabled = false;
      document.getElementById('transcribe-text').textContent = 'Transcribe Audio';
      document.getElementById('transcribe-spinner').style.display = 'none';
    }
  });

  // Step 2: Generate Note
  document.getElementById('generate-note-btn').addEventListener('click', async () => {
    const encounterId = document.getElementById('consult-encounter').value.trim();
    const patientId = document.getElementById('consult-patient').value.trim();

    const btn = document.getElementById('generate-note-btn');
    btn.disabled = true;
    document.getElementById('generate-text').textContent = 'Generating...';
    document.getElementById('generate-spinner').style.display = 'inline-block';

    try {
      const result = await generateNote(encounterId, patientId);
      document.getElementById('step3-card').style.display = 'block';

      const noteDraft = result.note_draft || {};
      const noteText = noteDraft.content || noteDraft.note || JSON.stringify(noteDraft, null, 2);
      document.getElementById('note-text').value = noteText;

      if (result.safety_flags && result.safety_flags.length > 0) {
        document.getElementById('note-safety-flags').innerHTML = `
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${result.safety_flags.map(f => `<span class="badge badge-warning">${f}</span>`).join('')}
          </div>`;
      }

      document.getElementById('step2-indicator').classList.remove('active');
      document.getElementById('step2-indicator').classList.add('done');
      document.getElementById('step3-indicator').classList.add('active');
      showToast('Clinical note generated!', 'success');

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      document.getElementById('generate-text').textContent = 'Generate Clinical Note';
      document.getElementById('generate-spinner').style.display = 'none';
    }
  });

  // Step 3: Verify & Save
  document.getElementById('verify-btn').addEventListener('click', async () => {
    const encounterId = document.getElementById('consult-encounter').value.trim();
    const patientId = document.getElementById('consult-patient').value.trim();
    const verifiedNoteText = document.getElementById('note-text').value.trim();

    if (!verifiedNoteText) {
      showToast('Note cannot be empty', 'warning');
      return;
    }

    if (!confirm('Are you sure you want to verify and save this clinical note to EMR? This action cannot be undone.')) {
      return;
    }

    const btn = document.getElementById('verify-btn');
    btn.disabled = true;
    document.getElementById('verify-text').textContent = 'Saving...';
    document.getElementById('verify-spinner').style.display = 'inline-block';

    try {
      const result = await verifyNote(encounterId, patientId, verifiedNoteText);
      document.getElementById('step3-card').style.display = 'none';
      document.getElementById('step4-card').style.display = 'block';
      document.getElementById('emr-message').textContent = result.message || 'Note verified and saved successfully.';

      document.getElementById('step3-indicator').classList.remove('active');
      document.getElementById('step3-indicator').classList.add('done');
      document.getElementById('step4-indicator').classList.add('done');
      showToast('Note saved to EMR!', 'success');

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      btn.disabled = false;
      document.getElementById('verify-text').textContent = 'Verify & Save to EMR';
      document.getElementById('verify-spinner').style.display = 'none';
    }
  });
}
