/**
 * OCR Results & Verification — Post-scan review with confidence highlighting
 * Matches Stitch "OCR Results & Verification" screen
 */
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { renderAppShell } from '../components/app-shell.js';

export async function renderOCRResults() {
  // Mock OCR results
  const ocrResult = {
    scanId: 'SCN-20260221-005',
    uploadedAt: '21 Feb 2026, 10:12 AM',
    processingTime: '3.2s',
    overallConfidence: 0.74,
    language: 'Tamil / English (mixed)',
    status: 'Review Required',
    imageUrl: null,
    fields: [
      { label: 'Patient Name', value: 'ஹரோல்ட் பிஞ்ச்', confidence: 0.68, needsReview: true },
      { label: 'Patient Name (En)', value: 'Harold Finch', confidence: 0.95, needsReview: false },
      { label: 'Age', value: '42', confidence: 0.91, needsReview: false },
      { label: 'Date', value: '2026-02-21', confidence: 0.88, needsReview: false },
      { label: 'Chief Complaint', value: 'Severe chest pain, 3 days', confidence: 0.82, needsReview: false },
      { label: 'Medication 1', value: 'Aspirin 325mg', confidence: 0.73, needsReview: true },
      { label: 'Medication 2', value: 'Pantoprazole 40mg', confidence: 0.61, needsReview: true },
      { label: 'Doctor Signature', value: 'Dr. Anand K.', confidence: 0.55, needsReview: true },
    ],
    alerts: [
      'Low confidence Tamil OCR — several characters were ambiguous',
      'Medication dosage values should be double-checked against original',
    ],
  };

  const getConfClass = (c) => c >= 0.85 ? 'high' : c >= 0.7 ? 'medium' : 'low';

  renderAppShell('OCR Results', `
    <div style="max-width: 1300px; margin: 0 auto;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
        <div>
          <div class="breadcrumb" style="margin-bottom: 8px;">
            <a href="#/nurse/dashboard">Dashboard</a><span class="sep">›</span>
            <a href="#/nurse/ocr">OCR Upload</a><span class="sep">›</span>
            <span>Results</span>
          </div>
          <h1 style="margin-bottom: 4px;">MedScan OCR — Verification</h1>
          <p class="text-sm text-muted">Review extracted data. Doctor approval is required for low-confidence fields.</p>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="btn btn-secondary" id="edit-resubmit-btn">
            <span class="material-icons-outlined" style="font-size: 16px;">edit</span>
            Edit & Resubmit
          </button>
          <button class="btn btn-success" id="approve-ocr-btn">
            <span class="material-icons-outlined" style="font-size: 16px;">verified</span>
            Approve & Send to EMR
          </button>
        </div>
      </div>

      <!-- Alerts -->
      ${ocrResult.alerts.map(a => `
        <div class="alert alert-warning" style="margin-bottom: 12px;">
          <span class="material-icons-outlined" style="font-size: 18px;">warning</span>
          <span>${a}</span>
        </div>
      `).join('')}

      <!-- Scan Info Bar -->
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-body" style="padding: 14px 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
          <div style="display: flex; gap: 20px;">
            <div><div class="text-xs text-muted">Scan ID</div><div style="font-weight: 600;">${ocrResult.scanId}</div></div>
            <div><div class="text-xs text-muted">Uploaded</div><div style="font-weight: 600;">${ocrResult.uploadedAt}</div></div>
            <div><div class="text-xs text-muted">Processed In</div><div style="font-weight: 600;">${ocrResult.processingTime}</div></div>
            <div><div class="text-xs text-muted">Language</div><div style="font-weight: 600;">${ocrResult.language}</div></div>
          </div>
          <div class="confidence-badge ${getConfClass(ocrResult.overallConfidence)}">
            <span class="material-icons-outlined" style="font-size: 14px;">insights</span>
            ${Math.round(ocrResult.overallConfidence * 100)}% overall
          </div>
        </div>
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

        <!-- Right Pane: Scrollable Data -->
        <div>
          <div class="card" style="margin-bottom: 20px;">
            <div class="card-header">
              <h3 style="margin:0; display: flex; align-items: center; gap: 8px;">
                <span class="material-icons-outlined" style="font-size: 18px; color: var(--primary-500);">text_fields</span>
                Extracted Fields
              </h3>
              <span class="badge badge-neutral">${ocrResult.fields.filter(f => f.needsReview).length} need review</span>
            </div>
            <div class="card-body" style="padding: 0;">
              <table class="table" style="margin: 0; width: 100%;">
                <thead><tr style="background: var(--gray-50);">
                  <th style="padding: 10px 16px;">Field</th>
                  <th style="padding: 10px 16px;">Extracted Value</th>
                  <th style="padding: 10px 16px;">Confidence</th>
                  <th style="padding: 10px 16px;">Status</th>
                </tr></thead>
                <tbody>
                  ${ocrResult.fields.map(f => `
                    <tr style="${f.needsReview ? 'background: #fffbeb; border-left: 3px solid #f59e0b;' : ''}">
                      <td class="text-sm" style="font-weight: 600; padding: 10px 16px;">${f.label}</td>
                      <td style="padding: 10px 16px;">
                        <span style="font-family: inherit;">${f.value}</span>
                      </td>
                      <td style="padding: 10px 16px;">
                        <div class="confidence-badge ${getConfClass(f.confidence)}">${Math.round(f.confidence * 100)}%</div>
                      </td>
                      <td style="padding: 10px 16px;">
                        ${f.needsReview
      ? '<span class="badge badge-warning"><span class="material-icons-outlined" style="font-size:13px;">visibility</span> Review</span>'
      : '<span class="badge badge-success"><span class="material-icons-outlined" style="font-size:13px;">check</span> OK</span>'}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  `, '/nurse/ocr');

  document.getElementById('approve-ocr-btn')?.addEventListener('click', () => {
    const reviewNeeded = ocrResult.fields.filter(f => f.needsReview).length;
    if (reviewNeeded > 0 && !confirm(`${reviewNeeded} fields need review. Approve anyway?`)) return;
    showToast('OCR data approved and sent to EMR!', 'success');
    setTimeout(() => navigate('/nurse/dashboard'), 1000);
  });

  document.getElementById('edit-resubmit-btn')?.addEventListener('click', () => {
    navigate('/nurse/ocr-edit');
  });
}
