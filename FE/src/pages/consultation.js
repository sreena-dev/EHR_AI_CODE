/**
 * Consultation Page — Matches Stitch "Consultation - Editable Post-Session View"
 * Wired to POST /api/doctor/transcribe, /generate-note, /verify-note
 */
import { renderAppShell } from '../components/app-shell.js';
import { getCurrentUser } from '../api/auth.js';
import { transcribeAudio, generateNote, verifyNote } from '../api/doctor.js';
import { showToast } from '../components/toast.js';

export async function renderConsultation() {
  const user = getCurrentUser();

  const bodyHTML = `
    <div style="max-width:1000px;">
      <div style="margin-bottom:24px;">
        <h2>Consultation & AI Transcription</h2>
        <p class="text-muted">Upload consultation audio to transcribe, then generate and verify clinical notes.</p>
      </div>

      <!-- Step Indicator -->
      <div style="display:flex; gap:4px; margin-bottom:24px;">
        <div class="step-pill active" id="step1-indicator">
          <span>1</span> Audio Upload
        </div>
        <div class="step-pill" id="step2-indicator">
          <span>2</span> Transcript Review
        </div>
        <div class="step-pill" id="step3-indicator">
          <span>3</span> Clinical Note
        </div>
        <div class="step-pill" id="step4-indicator">
          <span>4</span> Verify & Save
        </div>
      </div>

      <!-- Encounter Info -->
      <div class="card" style="margin-bottom:20px;">
        <div class="card-body">
          <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px;">
            <div class="form-group">
              <label class="form-label">Encounter ID *</label>
              <input type="text" id="consult-encounter" class="form-input" placeholder="ENC-2026-001" required />
            </div>
            <div class="form-group">
              <label class="form-label">Patient ID *</label>
              <input type="text" id="consult-patient" class="form-input" placeholder="PT-789" required />
            </div>
            <div class="form-group">
              <label class="form-label">Language</label>
              <select id="consult-language" class="form-select">
                <option value="">Auto Detect</option>
                <option value="en">English</option>
                <option value="ta">Tamil</option>
                <option value="hi">Hindi</option>
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

    <style>
      .step-pill {
        flex: 1;
        padding: 10px 16px;
        background: var(--gray-100);
        border-radius: var(--radius-md);
        font-size: 0.8125rem;
        font-weight: 600;
        color: var(--gray-400);
        text-align: center;
        transition: all 0.2s ease;
      }
      .step-pill span {
        display: inline-flex;
        width: 24px;
        height: 24px;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        background: var(--gray-200);
        color: var(--gray-500);
        font-size: 0.75rem;
        margin-right: 6px;
      }
      .step-pill.active {
        background: var(--primary-50);
        color: var(--primary-700);
      }
      .step-pill.active span {
        background: var(--primary-500);
        color: white;
      }
      .step-pill.done {
        background: var(--success-light);
        color: var(--success);
      }
      .step-pill.done span {
        background: var(--success);
        color: white;
      }
    </style>
  `;

  const activePath = location.hash === '#/doctor/notes' ? '/doctor/notes' : '/doctor/consultation';
  renderAppShell('Consultation', bodyHTML, activePath);

  // Wire up interactions
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

      // Show transcript
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
          </div>
        `;
      }

      // Update step indicators
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

      // Show note
      document.getElementById('step3-card').style.display = 'block';

      const noteDraft = result.note_draft || {};
      const noteText = noteDraft.content || noteDraft.note || JSON.stringify(noteDraft, null, 2);
      document.getElementById('note-text').value = noteText;

      if (result.safety_flags && result.safety_flags.length > 0) {
        document.getElementById('note-safety-flags').innerHTML = `
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            ${result.safety_flags.map(f => `<span class="badge badge-warning">${f}</span>`).join('')}
          </div>
        `;
      }

      // Update steps
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

      // Show success
      document.getElementById('step3-card').style.display = 'none';
      document.getElementById('step4-card').style.display = 'block';
      document.getElementById('emr-message').textContent = result.message || 'Note verified and saved successfully.';

      // Update steps
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
