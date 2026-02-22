/**
 * Patient Details Modal — Reusable modal for patient encounter initiation
 * Matches Stitch "Additional Patient Details Modal" screen
 */

/**
 * Show the patient details modal
 * @param {Object} opts - Options: { onSubmit: (data) => void, onClose: () => void }
 */
export function showPatientModal(opts = {}) {
    // Remove existing modal if any
    document.getElementById('patient-modal-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'patient-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
    <div class="modal-container" style="max-width: 520px;">
      <div class="modal-header">
        <h2 style="margin: 0; display: flex; align-items: center; gap: 8px;">
          <span class="material-icons-outlined" style="font-size: 22px; color: var(--primary-500);">person_add</span>
          Additional Patient Details
        </h2>
        <button class="btn btn-ghost modal-close-btn" style="padding: 4px;">
          <span class="material-icons-outlined" style="font-size: 20px;">close</span>
        </button>
      </div>
      <div class="modal-body">
        <p class="text-sm text-muted" style="margin-bottom: 16px;">Enter patient details to start consultation</p>

        <div style="margin-bottom: 16px;">
          <h4 style="margin-bottom: 12px; color: var(--gray-700);">Patient Identification</h4>
          <div class="form-group">
            <label class="form-label">Patient ID *</label>
            <input class="form-input" id="modal-patient-id" placeholder="PAT-XXXX" required />
          </div>
          <div class="form-group">
            <label class="form-label">Patient Name *</label>
            <input class="form-input" id="modal-patient-name" placeholder="Full name" required />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div class="form-group">
              <label class="form-label">Age</label>
              <input class="form-input" id="modal-patient-age" type="number" placeholder="Age" />
            </div>
            <div class="form-group">
              <label class="form-label">Gender</label>
              <select class="form-select" id="modal-patient-gender">
                <option value="">Select</option>
                <option>Male</option>
                <option>Female</option>
                <option>Other</option>
              </select>
            </div>
          </div>
        </div>

        <div>
          <h4 style="margin-bottom: 12px; color: var(--gray-700);">Encounter Details</h4>
          <div class="form-group">
            <label class="form-label">Department</label>
            <select class="form-select" id="modal-department">
              <option>General Medicine</option>
              <option>Emergency</option>
              <option>Cardiology</option>
              <option>Orthopedics</option>
              <option>Pediatrics</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Chief Complaint *</label>
            <textarea class="form-textarea" id="modal-complaint" rows="2" placeholder="Brief description of symptoms"></textarea>
          </div>
          <div class="form-group">
            <label class="form-label">Language</label>
            <select class="form-select" id="modal-language">
              <option value="en">English</option>
              <option value="ta">Tamil</option>
              <option value="hi">Hindi</option>
            </select>
          </div>
        </div>

        <div class="alert alert-info" style="margin-top: 12px; margin-bottom: 0;">
          <span class="material-icons-outlined" style="font-size: 16px;">info</span>
          <span class="text-sm">Tamil patients require manual verification before EMR save</span>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary modal-close-btn">Cancel</button>
        <button class="btn btn-primary" id="modal-start-btn">
          <span class="material-icons-outlined" style="font-size: 18px;">play_arrow</span>
          Start Consultation
        </button>
      </div>
    </div>
  `;

    document.body.appendChild(overlay);

    // Close handlers
    overlay.querySelectorAll('.modal-close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            overlay.remove();
            opts.onClose?.();
        });
    });
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) { overlay.remove(); opts.onClose?.(); }
    });

    // Submit handler
    document.getElementById('modal-start-btn')?.addEventListener('click', () => {
        const data = {
            patientId: document.getElementById('modal-patient-id').value.trim(),
            patientName: document.getElementById('modal-patient-name').value.trim(),
            age: document.getElementById('modal-patient-age').value,
            gender: document.getElementById('modal-patient-gender').value,
            department: document.getElementById('modal-department').value,
            complaint: document.getElementById('modal-complaint').value.trim(),
            language: document.getElementById('modal-language').value,
        };
        if (!data.patientId || !data.patientName) {
            const idInput = document.getElementById('modal-patient-id');
            if (!data.patientId) idInput.focus();
            return;
        }
        overlay.remove();
        opts.onSubmit?.(data);
    });
}
