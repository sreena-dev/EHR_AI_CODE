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

      /* ── Expandable OCR Cards (Prescriptions & Reports) ── */
      .ocr-expand-item {
        padding: 8px 14px;
        border-bottom: 1px solid var(--gray-50);
        font-size: 0.78rem;
      }
      .ocr-expand-item:last-child { border-bottom: none; }
      .ocr-expand-header {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 4px;
      }
      /* doc-type label — inherits sidebar font, matches .patient-info-row .lbl */
      .ocr-expand-item .doc-type {
        font-size: 0.72rem; font-weight: 700; color: var(--gray-600);
        text-transform: uppercase; letter-spacing: 0.05em;
      }
      .ocr-expand-preview {
        font-size: 0.76rem; color: var(--gray-500); line-height: 1.45;
        white-space: pre-wrap; word-break: break-word; margin-bottom: 4px;
      }
      .ocr-expand-btn {
        display: inline-flex; align-items: center; gap: 3px;
        background: none; border: 1px solid var(--gray-200);
        border-radius: var(--radius-sm); padding: 2px 9px;
        font-size: 0.68rem; font-weight: 600; color: var(--gray-500);
        cursor: pointer; white-space: nowrap;
        transition: background 0.15s, color 0.15s, border-color 0.15s;
      }
      .ocr-expand-btn:hover {
        background: var(--primary-50); color: var(--primary-600);
        border-color: var(--primary-200);
      }

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

      /* ── SOAP Note Layout ── */
      .soap-note-wrapper {
        background: white; border: 1.5px solid var(--gray-100);
        border-radius: var(--radius-xl); overflow: hidden;
        box-shadow: 0 2px 8px rgba(0,0,0,0.06);
      }
      .soap-note-header {
        background: linear-gradient(135deg, var(--primary-600), var(--primary-800));
        color: white; padding: 18px 24px;
      }
      .soap-note-header h2 {
        font-size: 1.1rem; font-weight: 700; margin: 0 0 12px;
        display: flex; align-items: center; gap: 8px;
      }
      .soap-patient-grid {
        display: grid; grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      .soap-patient-field label {
        font-size: 0.7rem; font-weight: 600; color: rgba(255,255,255,0.7);
        text-transform: uppercase; letter-spacing: 0.05em; display: block; margin-bottom: 3px;
      }
      .soap-patient-field input {
        width: 100%; background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.3);
        border-radius: var(--radius-md); padding: 7px 10px;
        font-size: 0.88rem; color: white; font-weight: 600;
        outline: none; box-sizing: border-box;
      }
      .soap-patient-field input::placeholder { color: rgba(255,255,255,0.5); }
      .soap-patient-field input:focus { border-color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.25); }

      .soap-section {
        border-bottom: 1.5px solid var(--gray-100);
      }
      .soap-section:last-child { border-bottom: none; }
      .soap-section-header {
        display: flex; align-items: center; gap: 12px;
        padding: 14px 20px; background: var(--gray-50);
        cursor: pointer; user-select: none;
        border-bottom: 1px solid var(--gray-100);
      }
      .soap-letter {
        width: 36px; height: 36px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 1.1rem; font-weight: 800; flex-shrink: 0;
        color: white;
      }
      .soap-letter-s { background: #6366f1; }
      .soap-letter-o { background: #0ea5e9; }
      .soap-letter-a { background: #f59e0b; }
      .soap-letter-p { background: #10b981; }

      .soap-section-title {
        flex: 1;
      }
      .soap-section-title strong {
        font-size: 0.92rem; font-weight: 700; color: var(--gray-800); display: block;
      }
      .soap-section-title span {
        font-size: 0.75rem; color: var(--gray-500);
      }
      .soap-section-body {
        padding: 16px 20px;
        display: grid; gap: 12px;
      }
      .soap-field-group label {
        font-size: 0.75rem; font-weight: 700; color: var(--gray-600);
        text-transform: uppercase; letter-spacing: 0.04em;
        display: flex; align-items: center; gap: 5px; margin-bottom: 5px;
      }
      .soap-field-group label .material-icons-outlined {
        font-size: 15px; color: var(--primary-500);
      }
      .soap-field-group textarea {
        width: 100%; background: var(--gray-50);
        border: 1.5px solid var(--gray-200); border-radius: var(--radius-md);
        padding: 10px 12px; font-size: 0.85rem; line-height: 1.6;
        color: var(--gray-800); resize: vertical; min-height: 72px;
        font-family: inherit; box-sizing: border-box; transition: border-color 0.2s;
      }
      .soap-field-group textarea:focus {
        outline: none; border-color: var(--primary-400);
        background: white; box-shadow: 0 0 0 3px var(--primary-50);
      }
      .soap-subgrid {
        display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
      }
      @media (max-width: 700px) { .soap-subgrid { grid-template-columns: 1fr; } }

      .soap-actions {
        display: flex; gap: 10px; flex-wrap: wrap;
        padding: 18px 20px; background: var(--gray-50);
        border-top: 1.5px solid var(--gray-100);
        justify-content: flex-end;
      }

      /* Print / export styles */
      @media print {
        body > *:not(#print-region) { display: none !important; }
        #print-region {
          display: block !important;
          font-family: 'Times New Roman', serif;
          font-size: 12pt; color: #000;
          padding: 20mm;
        }
        #print-region .no-print { display: none !important; }
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

        <!-- Step 3: Clinical Note (SOAP Format) -->
        <div class="card" id="step3-card" style="margin-bottom:20px; display:none;">
          <div class="card-header">
            <h3 style="font-size:1rem;">
              <span class="material-icons-outlined" style="font-size:20px; vertical-align:middle;">description</span>
              Step 3: Review Clinical Note (SOAP Format)
            </h3>
          </div>
          <div class="card-body" style="padding:0;">

            <!-- AI draft safety notice -->
            <div class="alert alert-info" style="margin:16px 16px 0; border-radius:var(--radius-md);">
              <span class="material-icons-outlined" style="font-size:18px">info</span>
              <div>AI-generated draft. <strong>Review and edit every section</strong> before saving to EMR.</div>
            </div>

            <!-- Safety flags (if any) -->
            <div id="note-safety-flags" style="margin:10px 16px 0; display:flex; gap:8px; flex-wrap:wrap;"></div>

            <!-- SOAP Note Form -->
            <div class="soap-note-wrapper" style="margin:16px;">

              <!-- Patient Header -->
              <div class="soap-note-header">
                <h2>
                  <span class="material-icons-outlined" style="font-size:22px;">assignment_ind</span>
                  Clinical Note
                </h2>
                <div class="soap-patient-grid">
                  <div class="soap-patient-field">
                    <label>Patient Name</label>
                    <input type="text" id="soap-patient-name" placeholder="Full Name" />
                  </div>
                  <div class="soap-patient-field">
                    <label>Date of Birth (DOB)</label>
                    <input type="date" id="soap-dob" />
                  </div>
                  <div class="soap-patient-field">
                    <label>Date of Service</label>
                    <input type="date" id="soap-dos" value="${new Date().toISOString().slice(0, 10)}" />
                  </div>
                  <div class="soap-patient-field">
                    <label>Provider / Clinician</label>
                    <input type="text" id="soap-provider" placeholder="Dr. …" />
                  </div>
                </div>
              </div>

              <!-- S: Subjective -->
              <div class="soap-section">
                <div class="soap-section-header">
                  <div class="soap-letter soap-letter-s">S</div>
                  <div class="soap-section-title">
                    <strong>Subjective</strong>
                    <span>Patient-reported information</span>
                  </div>
                </div>
                <div class="soap-section-body">
                  <div class="soap-field-group">
                    <label><span class="material-icons-outlined">chat_bubble_outline</span>Chief Complaint (CC)</label>
                    <textarea id="soap-cc" placeholder="Primary reason for visit…"></textarea>
                  </div>
                  <div class="soap-field-group">
                    <label><span class="material-icons-outlined">timeline</span>History of Present Illness (HPI) — OLDCARTS</label>
                    <textarea id="soap-hpi" style="min-height:120px;" placeholder="Onset, Location, Duration, Character, Aggravating/Alleviating factors, Radiation, Timing, Severity…"></textarea>
                  </div>
                  <div class="soap-subgrid">
                    <div class="soap-field-group">
                      <label><span class="material-icons-outlined">history_edu</span>Past Medical History (PMH)</label>
                      <textarea id="soap-pmh" placeholder="Prior diagnoses, surgeries, hospitalizations…"></textarea>
                    </div>
                    <div class="soap-field-group">
                      <label><span class="material-icons-outlined">medication</span>Current Medications</label>
                      <textarea id="soap-meds" placeholder="Drug name, dose, frequency…"></textarea>
                    </div>
                  </div>
                  <div class="soap-subgrid">
                    <div class="soap-field-group">
                      <label><span class="material-icons-outlined">warning_amber</span>Allergies</label>
                      <textarea id="soap-allergies" placeholder="Drug, food, environmental allergies and reactions…"></textarea>
                    </div>
                    <div class="soap-field-group">
                      <label><span class="material-icons-outlined">checklist</span>Review of Systems (ROS)</label>
                      <textarea id="soap-ros" placeholder="Constitutional, cardiovascular, respiratory, GI, neurological…"></textarea>
                    </div>
                  </div>
                </div>
              </div>

              <!-- O: Objective -->
              <div class="soap-section">
                <div class="soap-section-header">
                  <div class="soap-letter soap-letter-o">O</div>
                  <div class="soap-section-title">
                    <strong>Objective</strong>
                    <span>Provider-verified clinical data</span>
                  </div>
                </div>
                <div class="soap-section-body">
                  <div class="soap-field-group">
                    <label><span class="material-icons-outlined">monitor_heart</span>Vitals</label>
                    <textarea id="soap-vitals" placeholder="BP: / mmHg  |  HR: bpm  |  Temp: °C  |  SpO₂: %  |  RR: /min  |  Weight: kg  |  Height: cm"></textarea>
                  </div>
                  <div class="soap-field-group">
                    <label><span class="material-icons-outlined">personal_injury</span>Physical Examination</label>
                    <textarea id="soap-exam" style="min-height:110px;" placeholder="General appearance, HEENT, chest/lungs, cardiovascular, abdomen, extremities, neurological…"></textarea>
                  </div>
                  <div class="soap-field-group">
                    <label><span class="material-icons-outlined">science</span>Diagnostic Results (Labs / Imaging)</label>
                    <textarea id="soap-diag" style="min-height:90px;" placeholder="Lab values, ECG findings, X-ray/CT/MRI results, pathology…"></textarea>
                  </div>
                </div>
              </div>

              <!-- A: Assessment -->
              <div class="soap-section">
                <div class="soap-section-header">
                  <div class="soap-letter soap-letter-a">A</div>
                  <div class="soap-section-title">
                    <strong>Assessment</strong>
                    <span>Clinical analysis and diagnosis</span>
                  </div>
                </div>
                <div class="soap-section-body">
                  <div class="soap-field-group">
                    <label><span class="material-icons-outlined">diagnosis</span>Primary Diagnosis / Clinical Impression</label>
                    <textarea id="soap-dx" placeholder="ICD-10 code and description, clinical reasoning…"></textarea>
                  </div>
                  <div class="soap-field-group">
                    <label><span class="material-icons-outlined">alt_route</span>Differential Diagnoses</label>
                    <textarea id="soap-ddx" placeholder="List alternative diagnoses considered with reasoning…"></textarea>
                  </div>
                </div>
              </div>

              <!-- P: Plan -->
              <div class="soap-section">
                <div class="soap-section-header">
                  <div class="soap-letter soap-letter-p">P</div>
                  <div class="soap-section-title">
                    <strong>Plan</strong>
                    <span>Actionable management steps</span>
                  </div>
                </div>
                <div class="soap-section-body">
                  <div class="soap-subgrid">
                    <div class="soap-field-group">
                      <label><span class="material-icons-outlined">biotech</span>Diagnostics Ordered</label>
                      <textarea id="soap-plan-diag" placeholder="Labs, imaging, referrals ordered…"></textarea>
                    </div>
                    <div class="soap-field-group">
                      <label><span class="material-icons-outlined">local_pharmacy</span>Medications Prescribed</label>
                      <textarea id="soap-plan-meds" placeholder="Drug, dose, route, frequency, duration…"></textarea>
                    </div>
                  </div>
                  <div class="soap-subgrid">
                    <div class="soap-field-group">
                      <label><span class="material-icons-outlined">school</span>Patient Education</label>
                      <textarea id="soap-plan-edu" placeholder="Lifestyle modifications, disease counselling, red-flag symptoms to watch…"></textarea>
                    </div>
                    <div class="soap-field-group">
                      <label><span class="material-icons-outlined">event_available</span>Follow-up</label>
                      <textarea id="soap-plan-fu" placeholder="Return visit timeframe, conditions for early return, specialist referral…"></textarea>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Actions Row -->
              <div class="soap-actions no-print">
                <button id="export-email-btn" class="btn btn-secondary" title="Compose email with SOAP note">
                  <span class="material-icons-outlined" style="font-size:18px">email</span>
                  Export to Email
                </button>
                <button id="print-btn" class="btn btn-secondary" title="Print / Save as PDF">
                  <span class="material-icons-outlined" style="font-size:18px">print</span>
                  Print / PDF
                </button>
                <button id="verify-btn" class="btn btn-success btn-lg">
                  <span class="material-icons-outlined" style="font-size:18px">verified</span>
                  <span id="verify-text">Verify & Save to EMR</span>
                  <span id="verify-spinner" class="spinner" style="display:none;"></span>
                </button>
              </div>

            </div><!-- /soap-note-wrapper -->
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

      const seenOCRIds = new Set();
      encounters.forEach(enc => {
        (enc.ocr_results || []).forEach(ocr => {
          // Deduplicate: use ocr id, or fall back to a content hash (first 100 chars of text)
          const dedupeKey = ocr.id || (ocr.normalized_text || ocr.raw_text || '').substring(0, 100);
          if (dedupeKey && seenOCRIds.has(dedupeKey)) return;
          if (dedupeKey) seenOCRIds.add(dedupeKey);
          allOCR.push({ ...ocr, encounter_id: enc.id, enc_type: enc.type });
          (ocr.safety_flags || []).forEach(f => { if (!safetyFlags.includes(f)) safetyFlags.push(f); });
        });
      });

      // Use the top-level all_vitals list returned by the backend —
      // this covers vitals stored in VIT-* or any other encounter type
      allVitals = data.all_vitals || [];

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
        html += `<div class="sidebar-card-body" style="padding:0;">`;
        allOCR.forEach((ocr, idx) => {
          const conf = ocr.confidence || 0;
          const confClass = conf >= 80 ? 'conf-high' : conf >= 50 ? 'conf-mid' : 'conf-low';
          const preview = (ocr.normalized_text || ocr.raw_text || '(no text extracted)').slice(0, 90) + (((ocr.normalized_text || ocr.raw_text || '').length > 90) ? '…' : '');

          html += `
            <div class="ocr-expand-item">
              <div class="ocr-expand-header">
                <span class="doc-type">${ocr.document_type || 'DOCUMENT'}</span>
                <span class="conf ${confClass}">${conf.toFixed(0)}% conf</span>
              </div>
              <div class="ocr-expand-preview">${preview}</div>
              <div style="display:flex; align-items:center; justify-content:space-between; margin-top:6px;">
                <div class="ocr-meta" style="margin:0;">${ocr.created_at || '—'} · ${ocr.encounter_id || ''}${ocr.requires_review ? ' · <span style="color:#b91c1c; font-weight:700;">⚠ Review</span>' : ''}</div>
                <button class="ocr-expand-btn" data-idx="${idx}">
                  <span class="material-icons" style="font-size:12px; vertical-align:middle;">open_in_full</span> View
                </button>
              </div>
            </div>`;
        });
        html += `</div>`;
      }

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

      // Store OCR data for modal access
      window._consultOCRData = allOCR;

      // Wire up "View Document" buttons → open compare modal
      sidebar.querySelectorAll('.ocr-expand-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = parseInt(btn.dataset.idx);
          openOCRModal(idx);
        });
      });

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

  /* ─────────────────────────────────────────────────────────────
   * OCR COMPARE MODAL
   * Full-screen overlay matching the nurse OCR compare overlay.
   * ───────────────────────────────────────────────────────────── */
  function initOCRModal() {
    if (document.getElementById('consult-ocr-modal')) return; // already injected

    const modalEl = document.createElement('div');
    modalEl.id = 'consult-ocr-modal';
    modalEl.style.cssText = `
      display:none; position:fixed; inset:0; z-index:9999;
      background:rgba(0,0,0,0.6); backdrop-filter:blur(4px);
      align-items:center; justify-content:center;
    `;
    modalEl.innerHTML = `
      <div id="consult-ocr-container" style="
        width:96vw; height:94vh; margin:auto; display:grid;
        grid-template-columns:1fr 1fr; grid-template-rows:auto 1fr;
        background:white; border-radius:16px;
        box-shadow:0 25px 60px rgba(0,0,0,0.3); overflow:hidden;
      ">
        <!-- Header spans both columns -->
        <div style="
          grid-column:1/-1; display:flex; align-items:center;
          justify-content:space-between; padding:14px 24px;
          background:var(--gray-50); border-bottom:1px solid var(--gray-200);
        ">
          <h3 style="margin:0; font-size:0.9rem; display:flex; align-items:center; gap:8px;">
            <span class="material-icons" style="font-size:20px; color:var(--primary-500);">compare</span>
            Compare: Original Document vs Extracted Text
          </h3>
          <button id="consult-ocr-close" style="
            background:none; border:none; cursor:pointer; color:var(--gray-400);
            padding:6px; border-radius:6px; transition:all 0.15s;
            display:flex; align-items:center;
          " title="Close (Esc)">
            <span class="material-icons" style="font-size:20px;">close</span>
          </button>
        </div>

        <!-- Left: Original Document image -->
        <div style="display:flex; flex-direction:column; overflow:hidden; border-right:1px solid var(--gray-200);">
          <div style="
            padding:8px 16px; font-size:0.6rem; font-weight:700;
            text-transform:uppercase; letter-spacing:0.12em; color:var(--gray-400);
            background:var(--gray-50); border-bottom:1px solid var(--gray-100);
            display:flex; align-items:center; gap:6px; flex-shrink:0;
          ">
            <span class="material-icons" style="font-size:14px;">image</span> Original Document
          </div>
          <div id="consult-ocr-imgwrap" style="
            flex:1; display:flex; align-items:flex-start; justify-content:center;
            padding:20px; overflow:auto; background:var(--gray-100);
          ">
            <img id="consult-ocr-img" alt="Original Document" style="
              max-width:100%; height:auto; border-radius:8px;
              box-shadow:0 8px 24px rgba(0,0,0,0.15); transform-origin:top center;
              transition:transform 0.2s ease;
            " />
            <div id="consult-ocr-noimag" style="
              display:none; text-align:center; color:var(--gray-400);
              padding:40px; font-size:0.85rem;
            ">
              <span class="material-icons" style="font-size:48px; display:block; margin-bottom:12px; color:var(--gray-300);">image_not_supported</span>
              No original image stored
            </div>
          </div>
          <!-- Zoom bar -->
          <div style="
            display:flex; align-items:center; justify-content:center;
            gap:10px; padding:8px; background:white;
            border-top:1px solid var(--gray-100); flex-shrink:0;
          ">
            <button id="consult-ocr-zoomout" title="Zoom Out" style="background:none;border:none;cursor:pointer;color:var(--gray-500);padding:4px;border-radius:4px;">
              <span class="material-icons" style="font-size:16px;">remove</span>
            </button>
            <span id="consult-ocr-zoomlabel" style="font-size:0.6rem;font-weight:700;color:var(--gray-400);min-width:32px;text-align:center;">100%</span>
            <button id="consult-ocr-zoomin" title="Zoom In" style="background:none;border:none;cursor:pointer;color:var(--gray-500);padding:4px;border-radius:4px;">
              <span class="material-icons" style="font-size:16px;">add</span>
            </button>
            <button id="consult-ocr-zoomfit" title="Fit" style="background:none;border:none;cursor:pointer;color:var(--gray-500);padding:4px;border-radius:4px;">
              <span class="material-icons" style="font-size:16px;">fit_screen</span>
            </button>
          </div>
        </div>

        <!-- Right: Extracted Text (read-only in doctor view) -->
        <div style="display:flex; flex-direction:column; overflow:hidden;">
          <div style="
            padding:8px 16px; font-size:0.6rem; font-weight:700;
            text-transform:uppercase; letter-spacing:0.12em; color:var(--gray-400);
            background:var(--gray-50); border-bottom:1px solid var(--gray-100);
            display:flex; align-items:center; gap:6px; flex-shrink:0;
          ">
            <span class="material-icons" style="font-size:14px;">text_snippet</span> Extracted Text
            <span style="margin-left:auto; font-size:0.55rem; color:var(--gray-300); font-style:italic;">Editable — corrections sync back</span>
          </div>
          <div style="flex:1; padding:16px; overflow:auto; border-left:1px solid var(--gray-200);">
            <textarea id="consult-ocr-editor" style="
              width:100%; height:100%; min-height:300px; font-size:0.82rem;
              font-family:'JetBrains Mono', 'Courier New', monospace; background:white;
              border:1px solid var(--gray-200); border-radius:8px;
              padding:16px; color:var(--gray-700); resize:none; line-height:1.8;
              box-sizing:border-box;
            " placeholder="No extracted text available."></textarea>
          </div>
          <div style="
            padding:10px 16px; display:flex; justify-content:flex-end; gap:8px;
            background:var(--gray-50); border-top:1px solid var(--gray-100); flex-shrink:0;
          ">
            <button id="consult-ocr-discard" class="btn btn-secondary btn-sm">Discard Changes</button>
            <button id="consult-ocr-apply" class="btn btn-primary btn-sm" style="display:flex;align-items:center;gap:6px;">
              <span class="material-icons" style="font-size:14px;">check</span> Apply Changes
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);

    // Close handlers
    let _originalText = '';
    document.getElementById('consult-ocr-close').addEventListener('click', closeOCRModal);
    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) closeOCRModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeOCRModal(); });

    document.getElementById('consult-ocr-discard').addEventListener('click', () => {
      document.getElementById('consult-ocr-editor').value = _originalText;
    });
    document.getElementById('consult-ocr-apply').addEventListener('click', () => {
      closeOCRModal();
    });

    // Zoom
    let _zoom = 1;
    const img = document.getElementById('consult-ocr-img');
    const zoomLabel = document.getElementById('consult-ocr-zoomlabel');
    function applyZoom() {
      img.style.transform = `scale(${_zoom})`;
      zoomLabel.textContent = Math.round(_zoom * 100) + '%';
    }
    document.getElementById('consult-ocr-zoomin').addEventListener('click', () => {
      _zoom = Math.min(_zoom + 0.25, 4); applyZoom();
    });
    document.getElementById('consult-ocr-zoomout').addEventListener('click', () => {
      _zoom = Math.max(_zoom - 0.25, 0.25); applyZoom();
    });
    document.getElementById('consult-ocr-zoomfit').addEventListener('click', () => {
      _zoom = 1; applyZoom();
    });

    function closeOCRModal() {
      modalEl.style.display = 'none';
    }
    window._closeOCRModal = closeOCRModal;
  }

  function openOCRModal(idx) {
    initOCRModal();
    const ocr = (window._consultOCRData || [])[idx];
    if (!ocr) return;

    const modal = document.getElementById('consult-ocr-modal');
    const img = document.getElementById('consult-ocr-img');
    const noImg = document.getElementById('consult-ocr-noimag');
    const editor = document.getElementById('consult-ocr-editor');
    const zoomLbl = document.getElementById('consult-ocr-zoomlabel');

    // Reset zoom
    img.style.transform = 'scale(1)';
    zoomLbl.textContent = '100%';

    // Image
    const imageUrl = ocr.image_url || ocr.file_url || ocr.original_image_url || null;
    if (imageUrl) {
      img.src = imageUrl;
      img.style.display = '';
      noImg.style.display = 'none';
    } else {
      img.src = '';
      img.style.display = 'none';
      noImg.style.display = 'block';
    }

    // Text
    const text = (ocr.normalized_text || ocr.raw_text || '').trim();
    editor.value = text;
    window._consultOCROriginalText = text;

    modal.style.display = 'flex';
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

  // Step 2: Generate Note → fill SOAP form
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

      // ── Safety flags ──
      if (result.safety_flags && result.safety_flags.length > 0) {
        document.getElementById('note-safety-flags').innerHTML =
          result.safety_flags.map(f =>
            `<span class="safety-flag"><span class="material-icons" style="font-size:14px;">error</span>${f}</span>`
          ).join('');
      }

      // ── Auto-fill patient header from sidebar data ──
      try {
        const patData = await fetchPatientDetail(patientId);
        const p = patData.patient || {};
        if (p.name) document.getElementById('soap-patient-name').value = p.name;
        if (p.dob) document.getElementById('soap-dob').value = p.dob;
        // Pre-fill allergies in Subjective if available from patient record
        if (p.allergies) {
          const allergyEl = document.getElementById('soap-allergies');
          if (!allergyEl.value) allergyEl.value = p.allergies;
        }
        if (p.medical_history) {
          const pmhEl = document.getElementById('soap-pmh');
          if (!pmhEl.value) pmhEl.value = p.medical_history;
        }
        // Pre-fill vitals from the most recent encounter
        const encounters = patData.encounters || [];
        if (encounters.length > 0) {
          const latestVitals = encounters
            .map(e => e.vitals).filter(Boolean)
            .sort((a, b) => new Date(b.recorded_at || 0) - new Date(a.recorded_at || 0))[0];
          if (latestVitals) {
            const v = latestVitals;
            const parts = [];
            if (v.bp_systolic && v.bp_diastolic) parts.push(`BP: ${v.bp_systolic}/${v.bp_diastolic} mmHg`);
            if (v.pulse) parts.push(`HR: ${v.pulse} bpm`);
            if (v.temperature) parts.push(`Temp: ${v.temperature}°C`);
            if (v.spo2) parts.push(`SpO₂: ${v.spo2}%`);
            if (v.resp_rate) parts.push(`RR: ${v.resp_rate}/min`);
            if (v.weight) parts.push(`Weight: ${v.weight} kg`);
            if (v.height) parts.push(`Height: ${v.height} cm`);
            const vitalsEl = document.getElementById('soap-vitals');
            if (!vitalsEl.value && parts.length) vitalsEl.value = parts.join('  |  ');
          }
        }
      } catch (_) { /* sidebar context enrichment is best-effort */ }

      // ── Also fill provider name from logged-in user ──
      if (user && user.name) {
        const prvEl = document.getElementById('soap-provider');
        if (!prvEl.value) prvEl.value = user.name;
      }

      // ── Parse AI note draft into SOAP sections (best-effort) ──
      const noteDraft = result.note_draft || {};
      const rawText = noteDraft.content || noteDraft.note || '';

      // If the backend already returns structured fields, use them directly
      if (noteDraft.subjective || noteDraft.objective || noteDraft.assessment || noteDraft.plan) {
        const s = noteDraft.subjective || {};
        const o = noteDraft.objective || {};
        const a = noteDraft.assessment || {};
        const pl = noteDraft.plan || {};

        setIfEmpty('soap-cc', s.chief_complaint || s.cc || '');
        setIfEmpty('soap-hpi', s.hpi || '');
        setIfEmpty('soap-pmh', s.pmh || s.past_medical_history || '');
        setIfEmpty('soap-meds', s.medications || s.meds || '');
        setIfEmpty('soap-allergies', s.allergies || '');
        setIfEmpty('soap-ros', s.ros || s.review_of_systems || '');

        setIfEmpty('soap-vitals', o.vitals || '');
        setIfEmpty('soap-exam', o.physical_exam || o.exam || '');
        setIfEmpty('soap-diag', o.diagnostics || o.labs || '');

        setIfEmpty('soap-dx', a.diagnosis || a.assessment || '');
        setIfEmpty('soap-ddx', a.differential || a.differentials || '');

        setIfEmpty('soap-plan-diag', pl.diagnostics || pl.tests || '');
        setIfEmpty('soap-plan-meds', pl.medications || pl.meds || '');
        setIfEmpty('soap-plan-edu', pl.education || pl.patient_education || '');
        setIfEmpty('soap-plan-fu', pl.follow_up || pl.followup || '');
      } else if (rawText) {
        // Fallback: smart-parse the raw text into sections by label
        parseSoapText(rawText);
      }

      // ── Always seed HPI with the transcript so the full conversation is visible ──
      const transcriptText = (document.getElementById('transcript-text')?.value || '').trim();
      if (transcriptText) {
        setIfEmpty('soap-hpi', transcriptText);
      }

      // Scroll to step 3
      document.getElementById('step3-card').scrollIntoView({ behavior: 'smooth', block: 'start' });

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

  /* ── helpers ── */
  function setIfEmpty(id, val) {
    const el = document.getElementById(id);
    if (el && !el.value && val) el.value = val.trim();
  }

  /**
   * Best-effort parser: splits a free-text SOAP note into section fields.
   * Looks for section headings like "Subjective:", "S:", "Chief Complaint:", etc.
   */
  function parseSoapText(text) {
    // Section splitter – keyed by regex matched against the start of a line
    const SECTION_MAP = [
      // Chief Complaint
      { ids: ['soap-cc'], re: /^(?:chief\s*complaint|CC)\s*[:\-]/im },
      // HPI
      { ids: ['soap-hpi'], re: /^(?:history\s+of\s+present\s+illness|HPI)\s*[:\-]/im },
      // PMH
      { ids: ['soap-pmh'], re: /^(?:past\s+medical\s+history|PMH|medical\s+history)\s*[:\-]/im },
      // Meds
      { ids: ['soap-meds'], re: /^(?:medications?|current\s+medications?)\s*[:\-]/im },
      // Allergies
      { ids: ['soap-allergies'], re: /^(?:allergies?)\s*[:\-]/im },
      // ROS
      { ids: ['soap-ros'], re: /^(?:review\s+of\s+systems?|ROS)\s*[:\-]/im },
      // Vitals
      { ids: ['soap-vitals'], re: /^(?:vitals?|vital\s+signs?)\s*[:\-]/im },
      // Exam
      { ids: ['soap-exam'], re: /^(?:physical\s+exam(?:ination)?|exam|PE)\s*[:\-]/im },
      // Diagnostics (objective)
      { ids: ['soap-diag'], re: /^(?:diagnostic(?:s)?\s+results?|labs?|imaging)\s*[:\-]/im },
      // Diagnosis
      { ids: ['soap-dx'], re: /^(?:(?:primary\s+)?diagnosis|assessment|impression|DX)\s*[:\-]/im },
      // Differentials
      { ids: ['soap-ddx'], re: /^(?:differential(?:\s+diagnos[ei]s)?|DDX)\s*[:\-]/im },
      // Plan: diagnostics
      { ids: ['soap-plan-diag'], re: /^(?:diagnostics?\s+ordered|tests?\s+ordered|ordered?)\s*[:\-]/im },
      // Plan: meds prescribed
      { ids: ['soap-plan-meds'], re: /^(?:medications?\s+prescribed|prescriptions?|Rx)\s*[:\-]/im },
      // Patient education
      { ids: ['soap-plan-edu'], re: /^(?:patient\s+education|education|counsell?ing)\s*[:\-]/im },
      // Follow-up
      { ids: ['soap-plan-fu'], re: /^(?:follow[\s\-]?up|return|referral)\s*[:\-]/im },
    ];

    // Try big-section splitting first (S / O / A / P blocks)
    const bigSections = {
      S: extractBlock(text, /^(?:Subjective|S)\s*[:\-]/im, /^(?:Objective|O)\s*[:\-]/im),
      O: extractBlock(text, /^(?:Objective|O)\s*[:\-]/im, /^(?:Assessment|A)\s*[:\-]/im),
      A: extractBlock(text, /^(?:Assessment|A)\s*[:\-]/im, /^(?:Plan|P)\s*[:\-]/im),
      P: extractBlock(text, /^(?:Plan|P)\s*[:\-]/im, null),
    };

    // If we found at least one big section, distribute further
    if (bigSections.S || bigSections.O || bigSections.A || bigSections.P) {
      setIfEmpty('soap-cc', extractLabel(bigSections.S, /^(?:CC|chief\s*complaint)\s*[:\-]/im) || bigSections.S || '');
      setIfEmpty('soap-hpi', extractLabel(bigSections.S, /^(?:HPI|history\s+of\s+present\s+illness)\s*[:\-]/im) || '');
      setIfEmpty('soap-pmh', extractLabel(bigSections.S, /^(?:PMH|past\s+medical\s+history)\s*[:\-]/im) || '');
      setIfEmpty('soap-meds', extractLabel(bigSections.S, /^(?:medications?)\s*[:\-]/im) || '');
      setIfEmpty('soap-allergies', extractLabel(bigSections.S, /^allergies?\s*[:\-]/im) || '');
      setIfEmpty('soap-ros', extractLabel(bigSections.S, /^(?:ROS|review\s+of\s+systems?)\s*[:\-]/im) || '');

      setIfEmpty('soap-vitals', extractLabel(bigSections.O, /^vitals?\s*[:\-]/im) || '');
      setIfEmpty('soap-exam', extractLabel(bigSections.O, /^(?:physical\s+exam(?:ination)?|PE)\s*[:\-]/im) || bigSections.O || '');
      setIfEmpty('soap-diag', extractLabel(bigSections.O, /^(?:labs?|diagnostics?|imaging)\s*[:\-]/im) || '');

      setIfEmpty('soap-dx', extractLabel(bigSections.A, /^(?:diagnosis|impression|DX)\s*[:\-]/im) || bigSections.A || '');
      setIfEmpty('soap-ddx', extractLabel(bigSections.A, /^(?:differential|DDX)\s*[:\-]/im) || '');

      setIfEmpty('soap-plan-meds', extractLabel(bigSections.P, /^(?:medications?|Rx)\s*[:\-]/im) || '');
      setIfEmpty('soap-plan-diag', extractLabel(bigSections.P, /^(?:diagnostics?|tests?)\s*[:\-]/im) || '');
      setIfEmpty('soap-plan-edu', extractLabel(bigSections.P, /^(?:education|counsell?ing)\s*[:\-]/im) || '');
      setIfEmpty('soap-plan-fu', extractLabel(bigSections.P, /^follow[\s\-]?up\s*[:\-]/im) || '');

      // Anything under Plan not matched yet → plan-meds as fallback
      if (!document.getElementById('soap-plan-meds').value && bigSections.P) {
        setIfEmpty('soap-plan-meds', bigSections.P);
      }
    } else {
      // Flat text: try each individual label
      SECTION_MAP.forEach(({ ids, re }) => {
        const val = extractLabel(text, re);
        if (val) ids.forEach(id => setIfEmpty(id, val));
      });
      // If nothing matched, dump everything into HPI as a safe fallback
      const anyFilled = SECTION_MAP.some(({ ids }) => ids.some(id => document.getElementById(id)?.value));
      if (!anyFilled) setIfEmpty('soap-hpi', text.trim());
    }
  }

  /** Extract text between startRe and endRe (or end of string) */
  function extractBlock(text, startRe, endRe) {
    const startMatch = startRe.exec(text);
    if (!startMatch) return '';
    const start = startMatch.index + startMatch[0].length;
    if (endRe) {
      const endMatch = endRe.exec(text.slice(start));
      if (endMatch) return text.slice(start, start + endMatch.index).trim();
    }
    return text.slice(start).trim();
  }

  /** Extract the paragraph following a label within a block of text */
  function extractLabel(text, labelRe) {
    if (!text) return '';
    const lines = text.split('\n');
    let capturing = false;
    const out = [];
    for (const line of lines) {
      if (labelRe.test(line)) {
        capturing = true;
        // Inline content on same line after the colon
        const inline = line.replace(labelRe, '').trim().replace(/^[:\-]\s*/, '');
        if (inline) out.push(inline);
        continue;
      }
      if (capturing) {
        // Stop at next heading-like line
        if (/^[A-Z][a-zA-Z\s]{1,40}[:\-]/.test(line) && line.trim().length < 60) break;
        out.push(line);
      }
    }
    return out.join('\n').trim();
  }

  // Export to Email
  document.getElementById('export-email-btn').addEventListener('click', () => {
    const noteText = buildSoapNoteText();
    const subject = encodeURIComponent('Clinical Note – ' + (document.getElementById('soap-patient-name').value || 'Patient'));
    const body = encodeURIComponent(noteText);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  });

  // Print / PDF
  document.getElementById('print-btn').addEventListener('click', () => {
    window.print();
  });

  // Step 3: Verify & Save
  document.getElementById('verify-btn').addEventListener('click', async () => {
    const encounterId = document.getElementById('consult-encounter').value.trim();
    const patientId = document.getElementById('consult-patient').value.trim();

    // Validate required SOAP fields
    const cc = document.getElementById('soap-cc').value.trim();
    const dx = document.getElementById('soap-dx').value.trim();
    if (!cc || !dx) {
      showToast('Please fill in at least Chief Complaint and Diagnosis before saving.', 'warning');
      return;
    }

    if (!confirm('Are you sure you want to verify and save this clinical note to EMR? This action cannot be undone.')) {
      return;
    }

    const verifiedNoteText = buildSoapNoteText();

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

  /**
   * Serialise all SOAP fields into a structured plain-text clinical note.
   * This is the canonical format that gets saved to EMR or exported.
   */
  function buildSoapNoteText() {
    const g = id => (document.getElementById(id)?.value || '').trim();
    const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

    return [
      `CLINICAL NOTE`,
      `${'─'.repeat(60)}`,
      `Patient Name  : ${g('soap-patient-name') || '________________________'}`,
      `DOB           : ${g('soap-dob') || '__________'}`,
      `Date of Service: ${g('soap-dos') || today}`,
      `Provider      : ${g('soap-provider') || '________________________'}`,
      `${'─'.repeat(60)}`,
      ``,
      `1. SUBJECTIVE (S)`,
      `   Chief Complaint (CC):`,
      `   ${g('soap-cc') || '—'}`,
      ``,
      `   History of Present Illness (HPI) – OLDCARTS:`,
      `   ${g('soap-hpi') || '—'}`,
      ``,
      `   Past Medical History (PMH):`,
      `   ${g('soap-pmh') || '—'}`,
      ``,
      `   Current Medications:`,
      `   ${g('soap-meds') || '—'}`,
      ``,
      `   Allergies:`,
      `   ${g('soap-allergies') || '—'}`,
      ``,
      `   Review of Systems (ROS):`,
      `   ${g('soap-ros') || '—'}`,
      ``,
      `2. OBJECTIVE (O)`,
      `   Vitals:`,
      `   ${g('soap-vitals') || '—'}`,
      ``,
      `   Physical Examination:`,
      `   ${g('soap-exam') || '—'}`,
      ``,
      `   Diagnostic Results (Labs / Imaging):`,
      `   ${g('soap-diag') || '—'}`,
      ``,
      `3. ASSESSMENT (A)`,
      `   Primary Diagnosis / Clinical Impression:`,
      `   ${g('soap-dx') || '—'}`,
      ``,
      `   Differential Diagnoses:`,
      `   ${g('soap-ddx') || '—'}`,
      ``,
      `4. PLAN (P)`,
      `   Diagnostics Ordered:`,
      `   ${g('soap-plan-diag') || '—'}`,
      ``,
      `   Medications Prescribed:`,
      `   ${g('soap-plan-meds') || '—'}`,
      ``,
      `   Patient Education:`,
      `   ${g('soap-plan-edu') || '—'}`,
      ``,
      `   Follow-up:`,
      `   ${g('soap-plan-fu') || '—'}`,
      ``,
      `${'─'.repeat(60)}`,
      `Electronically signed by: ${g('soap-provider') || '—'}  |  ${g('soap-dos') || today}`,
    ].join('\n');
  }
}
