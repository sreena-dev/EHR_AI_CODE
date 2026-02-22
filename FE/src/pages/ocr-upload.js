/**
 * OCR Upload Page — Matches Stitch "Prescription Upload Interface"
 * Wired to POST /api/nurse/ocr
 */
import { renderAppShell } from '../components/app-shell.js';
import { getCurrentUser } from '../api/auth.js';
import { uploadPrescription } from '../api/nurse.js';
import { showToast } from '../components/toast.js';

export async function renderOCRUpload() {
  const user = getCurrentUser();

  const bodyHTML = `
    <div style="max-width: 900px;">
      <div style="margin-bottom: 24px;">
        <h2>Upload Prescription for OCR</h2>
        <p class="text-muted">Capture or upload a prescription image. The AI will extract text and structured medication data.</p>
      </div>

      <div class="card" style="margin-bottom: 24px;">
        <div class="card-body">
          <form id="ocr-form">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:20px;">
              <div class="form-group">
                <label class="form-label" for="encounter-id">Encounter ID *</label>
                <input type="text" id="encounter-id" class="form-input" placeholder="ENC-2026-001" required minlength="5" />
              </div>
              <div class="form-group">
                <label class="form-label" for="patient-id">Patient ID *</label>
                <input type="text" id="patient-id" class="form-input" placeholder="PT-789" required />
              </div>
            </div>

            <div class="form-group" style="margin-bottom:20px;">
              <label class="form-label" for="language-hint">Language</label>
              <select id="language-hint" class="form-select">
                <option value="auto">Auto Detect (English + Tamil)</option>
                <option value="en">English Only</option>
                <option value="ta">Tamil Only</option>
                <option value="hi">Hindi Only</option>
              </select>
            </div>

            <!-- Upload Area -->
            <div class="upload-area" id="upload-area">
              <input type="file" id="file-input" accept="image/jpeg,image/png,image/jpg" style="display:none;" />
              <span class="material-icons-outlined">cloud_upload</span>
              <h3 style="margin-bottom:4px;">Drag & drop prescription image</h3>
              <p class="text-muted text-sm">or click to browse — JPG/PNG, max 10MB</p>
              <div id="file-preview" style="display:none; margin-top:16px;">
                <img id="preview-img" style="max-height:200px; border-radius:8px; margin:0 auto;" />
                <p id="file-name" class="text-sm" style="margin-top:8px; color:var(--gray-600);"></p>
              </div>
            </div>

            <button type="submit" id="ocr-btn" class="btn btn-primary btn-lg btn-block" style="margin-top:20px;" disabled>
              <span class="material-icons-outlined" style="font-size:18px">document_scanner</span>
              <span id="ocr-btn-text">Process with OCR</span>
              <span id="ocr-spinner" class="spinner" style="display:none;"></span>
            </button>
          </form>
        </div>
      </div>

      <!-- OCR Results -->
      <div id="ocr-results" style="display:none;">
        <div class="card">
          <div class="card-header">
            <h3 style="font-size:1rem;">
              <span class="material-icons-outlined" style="font-size:20px; vertical-align:middle;">check_circle</span>
              OCR Results
            </h3>
            <span id="result-badge" class="badge"></span>
          </div>
          <div class="card-body">
            <div id="result-alert"></div>

            <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:16px; margin-bottom:20px;">
              <div>
                <div class="text-xs text-muted">Confidence</div>
                <div style="font-weight:700; font-size:1.25rem;" id="result-confidence">-</div>
              </div>
              <div>
                <div class="text-xs text-muted">Language</div>
                <div style="font-weight:600;" id="result-language">-</div>
              </div>
              <div>
                <div class="text-xs text-muted">Processing Time</div>
                <div style="font-weight:600;" id="result-time">-</div>
              </div>
            </div>

            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label">Extracted Text</label>
              <textarea class="form-textarea" id="result-text" readonly style="min-height:150px; background:var(--gray-50);"></textarea>
            </div>

            <div id="result-fields"></div>

            <div id="result-safety-flags" style="margin-top:16px;"></div>
          </div>
        </div>
      </div>
    </div>
  `;

  renderAppShell('Prescription OCR', bodyHTML, '/nurse/ocr');

  // File upload interactions
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  const previewDiv = document.getElementById('file-preview');
  const previewImg = document.getElementById('preview-img');
  const fileName = document.getElementById('file-name');
  const ocrBtn = document.getElementById('ocr-btn');
  let selectedFile = null;

  uploadArea.addEventListener('click', () => fileInput.click());

  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length > 0) handleFile(files[0]);
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
  });

  function handleFile(file) {
    if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
      showToast('Only JPG/PNG images are supported', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('File exceeds 10MB limit', 'error');
      return;
    }
    selectedFile = file;
    previewDiv.style.display = 'block';
    previewImg.src = URL.createObjectURL(file);
    fileName.textContent = `${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
    ocrBtn.disabled = false;
  }

  // Submit OCR
  document.getElementById('ocr-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    const encounterId = document.getElementById('encounter-id').value.trim();
    const patientId = document.getElementById('patient-id').value.trim();
    const languageHint = document.getElementById('language-hint').value;

    ocrBtn.disabled = true;
    document.getElementById('ocr-btn-text').textContent = 'Processing...';
    document.getElementById('ocr-spinner').style.display = 'inline-block';

    try {
      const result = await uploadPrescription({
        image: selectedFile,
        encounterId,
        patientId,
        capturedBy: user?.staff_id || 'unknown',
        languageHint,
      }); displayResults(result);
      showToast('OCR processing complete!', 'success');

      // Provide a direct link to the verified results page
      if (result.status === 'success' || result.status === 'low_confidence') {
        setTimeout(() => {
          if (confirm('OCR complete. Would you like to view and verify the structured results?')) {
            location.hash = '#/nurse/ocr-results';
          }
        }, 1000);
      }

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      ocrBtn.disabled = false;
      document.getElementById('ocr-btn-text').textContent = 'Process with OCR';
      document.getElementById('ocr-spinner').style.display = 'none';
    }
  });

  function displayResults(result) {
    const resultsDiv = document.getElementById('ocr-results');
    resultsDiv.style.display = 'block';

    // Badge
    const badge = document.getElementById('result-badge');
    if (result.status === 'success') {
      badge.className = 'badge badge-success';
      badge.textContent = 'Success';
    } else if (result.status === 'low_confidence') {
      badge.className = 'badge badge-warning';
      badge.textContent = 'Low Confidence';
    } else {
      badge.className = 'badge badge-error';
      badge.textContent = 'Failed';
    }

    // Alert for doctor review
    const alertDiv = document.getElementById('result-alert');
    if (result.requires_doctor_review) {
      alertDiv.innerHTML = `
        <div class="alert alert-warning">
          <span class="material-icons-outlined" style="font-size:18px">warning</span>
          <div>
            <strong>Doctor Review Required</strong>
            <p class="text-sm">Low confidence results detected. A doctor must verify this data before proceeding.</p>
          </div>
        </div>
      `;
    } else {
      alertDiv.innerHTML = '';
    }

    // Metrics
    document.getElementById('result-confidence').textContent = `${(result.confidence_mean || 0).toFixed(1)}%`;
    document.getElementById('result-language').textContent = result.language_detected || 'Unknown';
    document.getElementById('result-time').textContent = `${result.processing_time_ms || 0}ms`;

    // Text
    document.getElementById('result-text').value = result.raw_text || result.normalized_text || 'No text extracted';

    // Fields
    const fieldsDiv = document.getElementById('result-fields');
    if (result.structured_fields && result.structured_fields.length > 0) {
      fieldsDiv.innerHTML = `
        <label class="form-label">Extracted Fields (${result.extracted_fields_count})</label>
        <div class="table-wrapper" style="margin-top:8px;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Value</th>
                <th>Confidence</th>
              </tr>
            </thead>
            <tbody>
              ${result.structured_fields.map(f => `
                <tr>
                  <td><span class="badge badge-primary">${f.field_type || f.type || 'Field'}</span></td>
                  <td>${f.text || f.value || '-'}</td>
                  <td>${f.confidence ? f.confidence.toFixed(0) + '%' : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // Safety flags
    const flagsDiv = document.getElementById('result-safety-flags');
    if (result.safety_flags && result.safety_flags.length > 0) {
      flagsDiv.innerHTML = `
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          ${result.safety_flags.map(f => `<span class="badge badge-warning">${f}</span>`).join('')}
        </div>
      `;
    }

    // Scroll to results
    resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
