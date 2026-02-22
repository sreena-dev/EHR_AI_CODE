/**
 * Clinical Note Verification — Focused SOAP section review
 * Matches Stitch "Clinical Note - Focused Assessment/Objective Verification" screens
 */
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { renderAppShell } from '../components/app-shell.js';

export async function renderNoteVerification() {

    // Mock clinical note data
    const note = {
        patientName: 'Rajesh Kumar',
        patientId: 'PAT-2851',
        encounter: 'ENC-20260221-001',
        generatedAt: '21 Feb 2026, 10:45 AM',
        model: 'Meditron-7B',
        confidence: 0.87,
        sections: {
            subjective: {
                content: 'Patient reports persistent chest pain for the past 3 days, described as a dull ache in the left substernal region. Pain worsens with exertion and is relieved by rest. Denies shortness of breath, palpitations, or syncope. Reports mild anxiety related to symptoms.',
                confidence: 0.92,
                flags: [],
            },
            objective: {
                content: 'Vitals: BP 140/88 mmHg, HR 82 bpm, RR 18/min, SpO2 98%, Temp 98.4°F.\nCardiovascular: Regular rate and rhythm, no murmurs, gallops, or rubs. S1, S2 normal. No JVD.\nLungs: Clear to auscultation bilaterally.\nAbdomen: Soft, non-tender, no organomegaly.',
                confidence: 0.95,
                flags: [],
            },
            assessment: {
                content: 'Patient presents with atypical chest pain. Differential diagnosis includes musculoskeletal pain, GERD, and anxiety-related chest pain. Low probability for acute coronary syndrome based on presentation and vital signs.',
                confidence: 0.78,
                flags: ['Unverified differential — requires clinical judgment'],
            },
            plan: {
                content: '1. Order 12-lead ECG to rule out cardiac pathology\n2. Order troponin levels (stat)\n3. Prescribe pantoprazole 40mg daily for possible GERD\n4. Patient education on when to seek emergency care\n5. Follow-up in 1 week or sooner if symptoms worsen',
                confidence: 0.85,
                flags: [],
            },
        },
    };

    renderAppShell('Note Verification', `
    <div class="page-content">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
        <div>
          <div class="breadcrumb" style="margin-bottom: 8px;">
            <a href="#/doctor/dashboard">Dashboard</a>
            <span class="sep">›</span>
            <a href="#/doctor/consultation">Consultation</a>
            <span class="sep">›</span>
            <span>Note Verification</span>
          </div>
          <h1 style="margin-bottom: 4px;">Clinical Note Verification</h1>
          <p class="text-sm text-muted">Review AI-generated note before signing off. All sections require verification.</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary" id="request-clarification-btn">
            <span class="material-icons-outlined" style="font-size: 18px;">help_outline</span>
            Request Clarification
          </button>
          <button class="btn btn-success" id="sign-note-btn">
            <span class="material-icons-outlined" style="font-size: 18px;">verified</span>
            Verify & Sign
          </button>
        </div>
      </div>

      <!-- Patient Info Bar -->
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-body" style="padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="material-icons-outlined" style="font-size: 20px; color: var(--primary-500);">person</span>
              <span style="font-weight: 600;">${note.patientName}</span>
              <span class="badge badge-neutral">${note.patientId}</span>
            </div>
            <span class="text-sm text-muted">|</span>
            <span class="text-sm text-muted">${note.encounter}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 16px;">
            <span class="text-xs text-muted">Generated: ${note.generatedAt}</span>
            <span class="badge badge-info">${note.model}</span>
            <div class="confidence-badge ${note.confidence >= 0.9 ? 'high' : note.confidence >= 0.8 ? 'medium' : 'low'}">
              <span class="material-icons-outlined" style="font-size: 14px;">insights</span>
              ${Math.round(note.confidence * 100)}% confidence
            </div>
          </div>
        </div>
      </div>

      <!-- SOAP Sections -->
      <div class="note-sections">
        ${Object.entries(note.sections).map(([key, section]) => `
          <div class="note-section card" data-section="${key}">
            <div class="card-header">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span class="note-section-icon ${key}">
                  ${key === 'subjective' ? 'record_voice_over' : key === 'objective' ? 'monitor_heart' : key === 'assessment' ? 'psychology' : 'checklist'}
                </span>
                <div>
                  <h3 style="margin: 0;">${key.charAt(0).toUpperCase() + key.slice(1)}</h3>
                  <span class="text-xs text-muted">${key === 'subjective' ? 'Patient-reported symptoms' : key === 'objective' ? 'Clinical findings & vitals' : key === 'assessment' ? 'Clinical interpretation' : 'Treatment plan & follow-up'}</span>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 12px;">
                <div class="confidence-badge ${section.confidence >= 0.9 ? 'high' : section.confidence >= 0.8 ? 'medium' : 'low'}">
                  ${Math.round(section.confidence * 100)}%
                </div>
                <button class="btn btn-sm btn-ghost note-edit-btn" data-section="${key}">
                  <span class="material-icons-outlined" style="font-size: 16px;">edit</span>
                  Edit
                </button>
              </div>
            </div>
            <div class="card-body">
              ${section.flags.length > 0 ? `
                <div class="alert alert-warning" style="margin-bottom: 12px;">
                  <span class="material-icons-outlined" style="font-size: 16px;">warning</span>
                  ${section.flags.join('; ')}
                </div>
              ` : ''}
              <div class="note-content" id="content-${key}">${section.content.replace(/\n/g, '<br>')}</div>
              <div class="note-edit-area" id="edit-${key}" style="display: none;">
                <textarea class="form-textarea" style="min-height: 120px;">${section.content}</textarea>
                <div style="display: flex; gap: 8px; margin-top: 8px; justify-content: flex-end;">
                  <button class="btn btn-sm btn-secondary note-cancel-btn" data-section="${key}">Cancel</button>
                  <button class="btn btn-sm btn-primary note-save-btn" data-section="${key}">Save Changes</button>
                </div>
              </div>
            </div>
            <div class="card-footer" style="padding: 8px 24px; background: var(--gray-50); border-top: 1px solid var(--gray-100); display: flex; align-items: center; gap: 8px;">
              <label style="display: flex; align-items: center; gap: 6px; font-size: 0.8125rem; color: var(--gray-600); cursor: pointer;">
                <input type="checkbox" class="section-verify" data-section="${key}" style="accent-color: var(--success);" />
                I verify this section is clinically accurate
              </label>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `, '/doctor/notes');

    // Edit buttons
    document.querySelectorAll('.note-edit-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            document.getElementById(`content-${section}`).style.display = 'none';
            document.getElementById(`edit-${section}`).style.display = 'block';
            btn.style.display = 'none';
        });
    });

    document.querySelectorAll('.note-cancel-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            document.getElementById(`content-${section}`).style.display = 'block';
            document.getElementById(`edit-${section}`).style.display = 'none';
            document.querySelector(`.note-edit-btn[data-section="${section}"]`).style.display = '';
        });
    });

    document.querySelectorAll('.note-save-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            const textarea = document.querySelector(`#edit-${section} textarea`);
            document.getElementById(`content-${section}`).innerHTML = textarea.value.replace(/\n/g, '<br>');
            document.getElementById(`content-${section}`).style.display = 'block';
            document.getElementById(`edit-${section}`).style.display = 'none';
            document.querySelector(`.note-edit-btn[data-section="${section}"]`).style.display = '';
            showToast(`${section.charAt(0).toUpperCase() + section.slice(1)} section updated`, 'success');
        });
    });

    // Sign note
    document.getElementById('sign-note-btn').addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.section-verify');
        const allVerified = [...checkboxes].every(cb => cb.checked);
        if (!allVerified) {
            showToast('Please verify all sections before signing', 'warning');
            return;
        }
        showToast('Clinical note verified and signed!', 'success');
        setTimeout(() => navigate('/doctor/dashboard'), 1000);
    });

    // Clarification button
    document.getElementById('request-clarification-btn').addEventListener('click', () => {
        navigate('/doctor/clarification');
    });
}
