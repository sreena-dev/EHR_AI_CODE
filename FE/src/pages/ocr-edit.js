/**
 * OCR Edit & Resubmit — Manual correction of OCR fields
 * Matches Stitch "OCR Edit & Resubmit" screen
 */
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { renderAppShell } from '../components/app-shell.js';

export async function renderOCREdit() {
  // Mock OCR data for editing
  const ocrData = {
    scanId: 'SCN-20260221-005',
    rawText: `நோயாளி பெயர்: ஹரோல்ட் பிஞ்ச்
வயது: 42
நாள்: 21-02-2026
குறிப்பு: கடுமையான நெஞ்சுவலி, 3 நாட்கள்

மருந்துகள்:
1. Aspirin 325mg - தினமும்
2. Pantoprazole 40mg - காலை
3. Nitroglycerin SL 0.4mg - தேவைப்படும்போது

மருத்துவர் கையொப்பம்: Dr. Anand K.`,
    structured: {
      patientName: 'Harold Finch',
      patientNameTamil: 'ஹரோல்ட் பிஞ்ச்',
      age: '42',
      date: '2026-02-21',
      chiefComplaint: 'Severe chest pain, 3 days',
    },
    medications: [
      { name: 'Aspirin', dose: '325mg', frequency: 'Daily', route: 'PO' },
      { name: 'Pantoprazole', dose: '40mg', frequency: 'Morning', route: 'PO' },
      { name: 'Nitroglycerin SL', dose: '0.4mg', frequency: 'PRN', route: 'SL' },
    ],
  };

  renderAppShell('OCR Edit & Resubmit', `
    <div style="max-width: 1300px; margin: 0 auto;">
      <!-- Header -->
      <div style="margin-bottom: 20px;">
        <div class="breadcrumb" style="margin-bottom: 8px;">
          <a href="#/nurse/dashboard">Dashboard</a><span class="sep">›</span>
          <a href="#/nurse/ocr">OCR Upload</a><span class="sep">›</span>
          <a href="#/nurse/ocr-results">Results</a><span class="sep">›</span>
          <span>Edit & Resubmit</span>
        </div>
        <h1 style="margin-bottom: 4px;">MediScan AI — Edit & Resubmit</h1>
      </div>

      <!-- Edit Mode Banner -->
      <div class="alert alert-info" style="margin-bottom: 20px;">
        <span class="material-icons-outlined" style="font-size: 18px;">edit_note</span>
        <div><strong>Manual edit mode active</strong> — Ensure all data matches the original image precisely before resubmitting.</div>
      </div>

      <!-- Side-by-Side Layout -->
      <div style="display: grid; grid-template-columns: 5fr 7fr; gap: 24px; align-items: start;">
        <!-- Left Pane: Sticky Image Viewer -->
        <div style="position: sticky; top: 24px; height: calc(100vh - 140px); display: flex; flex-direction: column;">
          <div class="card" style="flex: 1; display: flex; flex-direction: column; overflow: hidden;">
            <div class="card-header" style="flex-shrink: 0;">
              <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                <span class="material-icons-outlined" style="font-size: 18px; color: var(--primary-500);">image</span>
                Original Scan
              </h3>
            </div>
            <div class="card-body" style="flex: 1; display: flex; align-items: center; justify-content: center; background: var(--gray-50); padding: 32px;">
              <div style="display: flex; flex-direction: column; align-items: center; gap: 12px; color: var(--gray-400);">
                <span class="material-icons-outlined" style="font-size: 64px; opacity: 0.5;">document_scanner</span>
                <p class="text-sm" style="margin: 0; font-weight: 600; text-align: center;">Original prescription scan</p>
                <p style="font-size: 0.7rem; margin: 0; color: var(--gray-300); display: flex; align-items: center; gap: 4px;">
                  <span class="material-icons-outlined" style="font-size: 14px;">pan_tool</span>
                  Pan & zoom to inspect details
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Pane: Scrollable Forms -->
        <div>
          <!-- Raw Text -->
          <div class="card" style="margin-bottom: 20px;">
            <div class="card-header">
              <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                <span class="material-icons-outlined" style="font-size: 18px; color: var(--primary-500);">text_snippet</span>
                OCR Raw Text
              </h3>
            </div>
            <div class="card-body">
              <textarea class="form-textarea" id="ocr-raw-text" style="min-height: 200px; font-size: 0.875rem;">${ocrData.rawText}</textarea>
            </div>
          </div>

          <!-- Structured Data -->
          <div class="card" style="margin-bottom: 20px;">
            <div class="card-header">
              <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                <span class="material-icons-outlined" style="font-size: 18px; color: var(--success);">view_list</span>
                Structured Data
              </h3>
            </div>
            <div class="card-body">
              <div class="form-group">
                <label class="form-label">Patient Name (English)</label>
                <input class="form-input" id="edit-name-en" value="${ocrData.structured.patientName}" />
              </div>
              <div class="form-group">
                <label class="form-label">Patient Name (Tamil)</label>
                <input class="form-input" id="edit-name-ta" value="${ocrData.structured.patientNameTamil}" />
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div class="form-group">
                  <label class="form-label">Age</label>
                  <input class="form-input" id="edit-age" value="${ocrData.structured.age}" />
                </div>
                <div class="form-group">
                  <label class="form-label">Date</label>
                  <input class="form-input" type="date" id="edit-date" value="${ocrData.structured.date}" />
                </div>
              </div>
              <div class="form-group">
                <label class="form-label">Chief Complaint</label>
                <input class="form-input" id="edit-complaint" value="${ocrData.structured.chiefComplaint}" />
              </div>
            </div>
          </div>

          <!-- Medications -->
          <div class="card" style="margin-bottom: 20px;">
            <div class="card-header">
              <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                <span class="material-icons-outlined" style="font-size: 18px; color: #b45309;">medication</span>
                Medications
              </h3>
              <button class="btn btn-sm btn-primary" id="add-ocr-med-btn">
                <span class="material-icons-outlined" style="font-size: 16px;">add</span> Add Row
              </button>
            </div>
            <div class="card-body" style="padding: 0;">
              <table class="table" style="margin: 0; width: 100%;" id="med-table">
                <thead><tr style="background: var(--gray-50);">
                  <th style="padding: 10px 16px;">Medication</th>
                  <th style="padding: 10px 16px;">Dose</th>
                  <th style="padding: 10px 16px;">Frequency</th>
                  <th style="padding: 10px 16px;">Route</th>
                  <th style="padding: 10px 16px;"></th>
                </tr></thead>
                <tbody>
                  ${ocrData.medications.map((m, i) => `
                    <tr>
                      <td style="padding: 8px 16px;"><input class="form-input" value="${m.name}" style="padding:6px 10px; font-size: 0.8125rem;" /></td>
                      <td style="padding: 8px 16px;"><input class="form-input" value="${m.dose}" style="padding:6px 10px; font-size: 0.8125rem; width:100px;" /></td>
                      <td style="padding: 8px 16px;"><input class="form-input" value="${m.frequency}" style="padding:6px 10px; font-size: 0.8125rem; width:100px;" /></td>
                      <td style="padding: 8px 16px;"><input class="form-input" value="${m.route}" style="padding:6px 10px; font-size: 0.8125rem; width:60px;" /></td>
                      <td style="padding: 8px 16px;"><button class="btn btn-sm btn-ghost del-med-btn" style="color:var(--error);"><span class="material-icons-outlined" style="font-size:16px;">close</span></button></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Actions -->
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button class="btn btn-secondary" id="cancel-edit-btn">Cancel</button>
            <button class="btn btn-primary" id="resubmit-btn">
              <span class="material-icons-outlined" style="font-size: 18px;">refresh</span>
              Resubmit for Processing
            </button>
          </div>
        </div>
      </div>
    </div>
  `, '/nurse/ocr');

  // Delete medication row
  document.querySelectorAll('.del-med-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('tr').remove();
      showToast('Medication removed', 'info');
    });
  });

  // Add medication row
  document.getElementById('add-ocr-med-btn')?.addEventListener('click', () => {
    const tbody = document.querySelector('#med-table tbody');
    const tr = document.createElement('tr');
    tr.innerHTML = `
          <td><input class="form-input" placeholder="Name" style="padding:6px 10px; font-size: 0.8125rem;" /></td>
          <td><input class="form-input" placeholder="Dose" style="padding:6px 10px; font-size: 0.8125rem; width:100px;" /></td>
          <td><input class="form-input" placeholder="Freq" style="padding:6px 10px; font-size: 0.8125rem; width:100px;" /></td>
          <td><input class="form-input" placeholder="PO" style="padding:6px 10px; font-size: 0.8125rem; width:60px;" /></td>
          <td><button class="btn btn-sm btn-ghost del-med-btn" style="color:var(--error);" onclick="this.closest('tr').remove()"><span class="material-icons-outlined" style="font-size:16px;">close</span></button></td>
        `;
    tbody.appendChild(tr);
  });

  document.getElementById('resubmit-btn')?.addEventListener('click', async () => {
    const btn = document.getElementById('resubmit-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;"></span> Processing...';
    await new Promise(r => setTimeout(r, 2000));
    showToast('OCR data resubmitted successfully!', 'success');
    setTimeout(() => navigate('/nurse/ocr-results'), 1000);
  });

  document.getElementById('cancel-edit-btn')?.addEventListener('click', () => {
    navigate('/nurse/ocr-results');
  });
}
