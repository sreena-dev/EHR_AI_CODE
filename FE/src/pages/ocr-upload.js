/**
 * OCR Upload Page — Design-System Compliant
 * Step 1: Patient Identification (new/existing) → Step 2: Upload → Step 3: OCR → Step 4: Verify
 */
import { renderAppShell } from '../components/app-shell.js';
import { getCurrentUser } from '../api/auth.js';
import { uploadPrescription, searchPatients, registerPatient } from '../api/nurse.js';
import { showToast } from '../components/toast.js';

export async function renderOCRUpload() {
    const user = getCurrentUser();

    const bodyHTML = `
    <style>
        /* ── Scrollbar ── */
        .custom-scroll::-webkit-scrollbar { width: 6px; }
        .custom-scroll::-webkit-scrollbar-track { background: transparent; }
        .custom-scroll::-webkit-scrollbar-thumb { background-color: var(--gray-300); border-radius: 20px; }

        /* ── Upload dashed border ── */
        .dashed-border {
            background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='12' ry='12' stroke='%232563EB' stroke-width='2' stroke-dasharray='12%2c 12' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
        }

        /* ── Annotation chips ── */
        .anno-sidebar {
            position: absolute; top: 12px; left: 12px; z-index: 15;
            display: flex; flex-direction: column; gap: 6px;
            max-height: calc(100% - 24px); overflow-y: auto;
            pointer-events: auto;
        }
        .anno-chip {
            display: flex; align-items: center; gap: 8px;
            padding: 8px 12px; background: white; border-radius: var(--radius-md);
            box-shadow: var(--shadow-md); border-left: 3px solid var(--primary-500);
            cursor: pointer; transition: all 0.2s; font-size: 0.75rem;
            white-space: nowrap; min-width: 160px;
        }
        .anno-chip:hover { transform: translateX(4px); box-shadow: var(--shadow-lg); }
        .anno-chip.active { background: var(--primary-50); border-left-color: var(--primary-500); }
        .anno-chip .anno-icon { font-size: 16px; flex-shrink: 0; }
        .anno-chip .anno-info { flex: 1; }
        .anno-chip .anno-type { font-weight: 700; font-size: 0.68rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--gray-700); }
        .anno-chip .anno-text { font-size: 0.7rem; color: var(--gray-500); margin-top: 1px; overflow: hidden; text-overflow: ellipsis; max-width: 140px; }
        .anno-chip .anno-conf {
            font-size: 0.6rem; font-weight: 800; padding: 2px 6px;
            border-radius: var(--radius-full); flex-shrink: 0;
        }
        .anno-chip .conf-high { background: #dcfce7; color: #166534; }
        .anno-chip .conf-mid  { background: #fef3c7; color: #92400e; }
        .anno-chip .conf-low  { background: #fee2e2; color: #991b1b; }
        .anno-chip.conf-border-high { border-left-color: var(--success); }
        .anno-chip.conf-border-mid  { border-left-color: #f59e0b; }
        .anno-chip.conf-border-low  { border-left-color: var(--error); }

        /* Highlight effect on verification field */
        .verify-input.field-highlight, .meds-table.field-highlight {
            border-color: var(--primary-500) !important;
            box-shadow: 0 0 0 3px var(--primary-100), 0 0 12px rgba(36,99,235,0.15) !important;
            transition: all 0.3s ease;
        }

        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }

        /* ── Patient ID Step ── */
        .patient-step-card {
            width: 100%; max-width: 650px;
            background: white; border-radius: var(--radius-xl);
            box-shadow: var(--shadow-xl); border: 1px solid var(--gray-200);
            padding: 40px; animation: fadeIn 0.4s ease;
        }
        .step-header {
            display: flex; align-items: center; gap: 12px; margin-bottom: 32px;
        }
        .step-header .icon-box {
            width: 44px; height: 44px; background: var(--primary-500);
            border-radius: var(--radius-lg); display: flex; align-items: center;
            justify-content: center; color: white;
            box-shadow: 0 4px 12px rgba(36, 99, 235, 0.25);
        }
        .step-header h1 { font-size: 1.5rem; font-weight: 700; margin: 0; }
        .step-header h1 span { color: var(--gray-400); font-weight: 400; }

        /* ── Toggle Tabs ── */
        .patient-tabs {
            display: flex; background: var(--gray-100); border-radius: var(--radius-md);
            padding: 4px; margin-bottom: 28px;
        }
        .patient-tab {
            flex: 1; padding: 10px 16px; border: none; background: transparent;
            border-radius: var(--radius-sm); font-size: 0.875rem; font-weight: 600;
            color: var(--gray-500); cursor: pointer; transition: all var(--transition-fast);
            display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .patient-tab.active {
            background: white; color: var(--primary-500);
            box-shadow: var(--shadow-sm);
        }
        .patient-tab .material-icons-outlined { font-size: 18px; }

        /* ── Search Results ── */
        .search-results {
            border: 1px solid var(--gray-200); border-radius: var(--radius-lg);
            max-height: 280px; overflow-y: auto; margin-top: 12px;
        }
        .search-result-item {
            display: flex; align-items: center; gap: 14px;
            padding: 14px 16px; border-bottom: 1px solid var(--gray-100);
            cursor: pointer; transition: background var(--transition-fast);
        }
        .search-result-item:last-child { border-bottom: none; }
        .search-result-item:hover { background: var(--primary-50); }
        .search-result-item.selected { background: var(--primary-50); border-left: 3px solid var(--primary-500); }
        .search-result-item .avatar {
            width: 40px; height: 40px; border-radius: 50%;
            background: var(--primary-100); color: var(--primary-500);
            display: flex; align-items: center; justify-content: center;
            font-weight: 700; font-size: 0.875rem; flex-shrink: 0;
        }
        .search-result-item .info { flex: 1; }
        .search-result-item .info .name { font-weight: 600; font-size: 0.875rem; }
        .search-result-item .info .meta { font-size: 0.75rem; color: var(--gray-500); margin-top: 2px; }
        .search-result-item .pid-badge {
            font-size: 0.7rem; font-weight: 700; color: var(--primary-500);
            background: var(--primary-50); padding: 4px 10px; border-radius: var(--radius-full);
        }

        /* ── Form fields common ── */
        .oform-field { margin-bottom: 18px; }
        .oform-field label {
            display: block; font-size: 0.8rem; font-weight: 600;
            color: var(--gray-700); margin-bottom: 6px;
        }
        .oform-field label .req { color: var(--error); }
        .oform-field input, .oform-field select, .oform-field textarea {
            width: 100%; padding: 10px 14px; background: var(--gray-50);
            border: 1px solid var(--gray-200); border-radius: var(--radius-md);
            font-size: 0.875rem; font-family: inherit;
            transition: all var(--transition-fast);
        }
        .oform-field input:focus, .oform-field select:focus, .oform-field textarea:focus {
            outline: none; border-color: var(--primary-500);
            box-shadow: 0 0 0 3px var(--primary-100);
        }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        @media (max-width: 600px) { .two-col, .three-col { grid-template-columns: 1fr; } }

        .section-divider {
            font-size: 0.65rem; font-weight: 700; color: var(--gray-400);
            text-transform: uppercase; letter-spacing: 0.12em;
            margin: 24px 0 12px; padding-bottom: 6px;
            border-bottom: 1px solid var(--gray-100);
        }

        /* ── Selected Patient Banner ── */
        .selected-patient-banner {
            display: none; background: var(--success-light);
            border: 1px solid #86efac; border-radius: var(--radius-lg);
            padding: 14px 18px; margin-top: 16px;
            align-items: center; gap: 12px;
        }
        .selected-patient-banner.visible { display: flex; }
        .selected-patient-banner .material-icons { color: var(--success); font-size: 22px; }
        .selected-patient-banner .details { flex: 1; }
        .selected-patient-banner .details .name { font-weight: 700; font-size: 0.9rem; }
        .selected-patient-banner .details .meta { font-size: 0.75rem; color: var(--gray-600); }

        /* ── Verification panel ── */
        .verify-section { display: flex; flex: 1; overflow: hidden; }
        .viewer-panel {
            flex: 1; position: relative; background: var(--gray-100);
            border-right: 1px solid var(--gray-200); display: flex; flex-direction: column;
            overflow: hidden;
        }
        .viewer-toolbar {
            position: absolute; top: 16px; left: 50%; transform: translateX(-50%); z-index: 10;
            background: white; box-shadow: var(--shadow-lg); border-radius: var(--radius-full);
            padding: 8px 16px; display: flex; align-items: center; gap: 16px;
            border: 1px solid var(--gray-200);
        }
        .viewer-toolbar label {
            font-size: 0.625rem; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.1em; color: var(--gray-500);
        }
        .viewer-viewport {
            flex: 1; overflow: auto; display: flex; align-items: center; justify-content: center;
            padding: 32px; position: relative;
        }
        .image-wrap {
            position: relative; box-shadow: var(--shadow-xl); border-radius: var(--radius-md);
            overflow: hidden; background: white; transform-origin: center; transition: transform 0.2s;
        }
        .image-wrap img { max-width: 100%; height: auto; display: block; }
        .page-indicator {
            position: absolute; bottom: 16px; left: 16px;
            background: rgba(0,0,0,0.7); color: white; font-size: 0.625rem;
            font-weight: 700; padding: 6px 12px; border-radius: var(--radius-full);
            text-transform: uppercase; letter-spacing: 0.1em;
        }

        .data-panel {
            width: 500px; background: white; display: flex; flex-direction: column;
            border-left: 1px solid var(--gray-100); box-shadow: var(--shadow-xl); z-index: 20;
        }
        .verify-warning {
            background: #fffbeb; border-bottom: 1px solid #fde68a;
            padding: 16px; display: flex; gap: 12px; align-items: flex-start; flex-shrink: 0;
        }
        .verify-warning .material-icons { color: #f59e0b; }
        .verify-warning h3 {
            font-size: 0.625rem; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.12em; color: #92400e; margin: 0;
        }
        .verify-warning p { font-size: 0.625rem; color: #a16207; margin: 4px 0 0; line-height: 1.5; }

        .verify-content { flex: 1; overflow-y: auto; padding: 24px; }

        .field-label {
            font-size: 0.625rem; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.15em; color: var(--gray-400); margin-bottom: 8px; display: block;
        }
        .verify-input {
            width: 100%; background: white; border: 1px solid var(--gray-200);
            border-radius: var(--radius-lg); padding: 10px 16px;
            font-size: 0.875rem; font-weight: 500;
            transition: all var(--transition-fast);
        }
        .verify-input:focus {
            outline: none; border-color: var(--primary-500);
            box-shadow: 0 0 0 3px var(--primary-100);
        }
        .raw-text-box {
            width: 100%; height: 96px; font-size: 0.68rem; font-family: monospace;
            background: var(--gray-50); border: 1px solid var(--gray-100);
            border-radius: var(--radius-lg); padding: 12px; color: var(--gray-600);
            resize: none; text-transform: uppercase;
        }

        .meds-table {
            width: 100%; border: 1px solid var(--gray-200); border-radius: var(--radius-lg);
            overflow: hidden; background: white;
        }
        .meds-table thead { background: var(--gray-50); }
        .meds-table thead th {
            padding: 10px 12px; font-size: 0.56rem; font-weight: 700;
            text-transform: uppercase; letter-spacing: 0.1em; color: var(--gray-400);
            text-align: left; border-bottom: 1px solid var(--gray-100);
        }
        .meds-table tbody td { padding: 10px 12px; font-size: 0.8rem; }
        .meds-table tbody tr:hover { background: var(--gray-50); }
        .meds-table input {
            width: 100%; background: transparent; border: none; padding: 0;
            font-size: 0.8rem; font-weight: 600; color: var(--gray-700);
        }
        .meds-table input:focus { outline: none; }

        .workflow-stepper {
            padding-top: 24px; margin-top: 24px; border-top: 1px solid var(--gray-100);
            display: flex; align-items: center; justify-content: space-between;
            font-size: 0.56rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em;
        }
        .step-done { color: var(--success); display: flex; align-items: center; gap: 6px; }
        .step-active { color: var(--primary-500); display: flex; align-items: center; gap: 6px; }
        .step-pending { color: var(--gray-300); display: flex; align-items: center; gap: 6px; }
        .step-line { height: 1px; flex: 1; margin: 0 16px; }
        .step-line.done { background: var(--success-light); }
        .step-line.pending { background: var(--gray-100); }

        .verify-footer {
            border-top: 1px solid var(--gray-100); padding: 20px 24px;
            background: var(--gray-50); display: flex; align-items: center;
            justify-content: space-between; flex-shrink: 0;
        }
        .verify-footer .discard {
            color: var(--gray-400); font-size: 0.625rem; font-weight: 700;
            text-transform: uppercase; letter-spacing: 0.1em;
            background: none; border: none; cursor: pointer;
            transition: color var(--transition-fast);
        }
        .verify-footer .discard:hover { color: var(--gray-600); }

        /* ── Processing overlay ── */
        .process-overlay {
            position: absolute; inset: 0; z-index: 60;
            background: rgba(255,255,255,0.85); backdrop-filter: blur(8px);
            display: none; flex-direction: column; align-items: center; justify-content: center;
            text-align: center; padding: 40px;
        }
        .process-overlay.visible { display: flex; }
        .process-spinner {
            width: 80px; height: 80px; position: relative; margin-bottom: 32px;
        }
        .process-spinner .ring {
            width: 80px; height: 80px; border: 4px solid var(--primary-100);
            border-radius: 50%; position: absolute;
        }
        .process-spinner .ring-spin {
            width: 80px; height: 80px; border: 4px solid var(--primary-500);
            border-top-color: transparent; border-radius: 50%;
            animation: spin 1s linear infinite; position: absolute;
        }
        .process-spinner .icon {
            position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
            color: var(--primary-500); font-size: 28px;
        }
        .bounce-dots { display: flex; gap: 8px; margin-top: 32px; }
        .bounce-dots span {
            width: 6px; height: 6px; background: var(--primary-500);
            border-radius: 50%; animation: bounce 1.4s infinite ease-in-out both;
        }
        .bounce-dots span:nth-child(2) { animation-delay: 0.2s; }
        .bounce-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
        }

        /* ── Success state ── */
        .success-overlay {
            position: absolute; inset: 0; z-index: 100;
            background: white; display: none; flex-direction: column;
            align-items: center; justify-content: center; padding: 40px;
            text-align: center;
        }
        .success-overlay.visible { display: flex; }
        .success-icon {
            width: 80px; height: 80px; background: var(--success-light);
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
            margin-bottom: 32px;
        }
        .success-icon .material-icons-round { color: var(--success); font-size: 48px; }
        .success-card {
            width: 100%; max-width: 360px; background: var(--gray-50);
            border: 1px solid var(--gray-100); border-radius: var(--radius-xl);
            padding: 24px; margin: 32px 0;
        }
        .success-row {
            display: flex; justify-content: space-between; align-items: center;
            font-size: 0.625rem; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.1em; color: var(--gray-400); padding: 8px 0;
        }
        .success-row .val { color: var(--gray-900); }

        /* ── Toggle Switch ── */
        .toggle-switch {
            position: relative; display: inline-flex; align-items: center;
            width: 36px; height: 20px; cursor: pointer;
        }
        .toggle-switch-track {
            width: 36px; height: 20px; background: var(--primary-500);
            border-radius: 10px; transition: background 0.2s;
        }
        .toggle-switch-knob {
            position: absolute; top: 2px; left: 18px;
            width: 16px; height: 16px; background: white;
            border-radius: 50%; box-shadow: var(--shadow-sm);
            transition: left 0.2s;
        }
        .toggle-switch.off .toggle-switch-track { background: var(--gray-300); }
        .toggle-switch.off .toggle-switch-knob { left: 2px; }

        /* ── Full Layout ── */
        .ocr-main { display: flex; flex-direction: column; flex: 1; overflow: hidden; position: relative; }
    </style>

    <div class="ocr-main">
        <!-- ═══════ STEP 1: PATIENT IDENTIFICATION ═══════ -->
        <div id="step-patient-id" style="flex:1; display:flex; align-items:center; justify-content:center; padding:24px; background:var(--gray-50);">
            <div class="patient-step-card">
                <div class="step-header">
                    <div class="icon-box">
                        <span class="material-icons" style="font-size:22px;">person_search</span>
                    </div>
                    <h1>Patient Identification <span>/ Step 1</span></h1>
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
                            <input type="text" id="patient-search-input" placeholder="Search by name, PID, or phone number..." style="padding-left:40px;" />
                        </div>
                    </div>
                    <div class="search-results" id="search-results-list">
                        <div style="padding:24px;text-align:center;color:var(--gray-400);font-size:0.85rem;">
                            <span class="material-icons-outlined" style="font-size:32px;display:block;margin-bottom:8px;color:var(--gray-300);">person_search</span>
                            Start typing to search patients
                        </div>
                    </div>

                    <div class="selected-patient-banner" id="selected-patient-banner">
                        <span class="material-icons">check_circle</span>
                        <div class="details">
                            <div class="name" id="selected-p-name"></div>
                            <div class="meta" id="selected-p-meta"></div>
                        </div>
                        <button class="btn btn-sm btn-ghost" id="clear-patient-btn" style="font-size:0.75rem;">Change</button>
                    </div>
                </div>

                <!-- ── New Patient Panel ── -->
                <div id="panel-new" style="display:none;">
                    <div class="section-divider">Basic Information</div>
                    <div class="oform-field">
                        <label>Full Name <span class="req">*</span></label>
                        <input type="text" id="new-p-name" placeholder="Patient full name" />
                    </div>
                    <div class="three-col">
                        <div class="oform-field">
                            <label>Age <span class="req">*</span></label>
                            <input type="number" id="new-p-age" placeholder="Age" min="0" max="150" />
                        </div>
                        <div class="oform-field">
                            <label>Gender <span class="req">*</span></label>
                            <select id="new-p-gender">
                                <option value="">Select</option>
                                <option value="M">Male</option>
                                <option value="F">Female</option>
                                <option value="O">Other</option>
                            </select>
                        </div>
                        <div class="oform-field">
                            <label>Phone</label>
                            <input type="tel" id="new-p-phone" placeholder="Mobile number" />
                        </div>
                    </div>
                    <div class="oform-field">
                        <label>Address</label>
                        <input type="text" id="new-p-address" placeholder="Residential address" />
                    </div>
                </div>

                <!-- Proceed Button -->
                <div style="margin-top:28px; display:flex; justify-content:flex-end; gap:12px;">
                    <button class="btn btn-primary" id="proceed-to-upload-btn" disabled style="height:44px; display:flex; align-items:center; gap:8px;">
                        <span>Continue to OCR Upload</span>
                        <span class="material-icons" style="font-size:18px;">arrow_forward</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- ═══════ STEP 2: UPLOAD VIEW ═══════ -->
        <div id="step-upload" style="flex:1; display:none; align-items:center; justify-content:center; padding:24px; background:var(--gray-50);">
            <div class="patient-step-card" style="max-width:680px;">
                <div class="step-header">
                    <div class="icon-box">
                        <span class="material-icons" style="font-size:22px;">document_scanner</span>
                    </div>
                    <h1>MedScan OCR <span>/ Upload</span></h1>
                </div>

                <!-- Patient Context Bar -->
                <div id="upload-patient-context" style="
                    display:flex; align-items:center; gap:12px; padding:12px 16px;
                    background:var(--primary-50); border:1px solid var(--primary-100);
                    border-radius:var(--radius-md); margin-bottom:24px;
                    font-size:0.85rem;
                ">
                    <span class="material-icons" style="color:var(--primary-500);font-size:20px;">person</span>
                    <span id="upload-patient-label" style="font-weight:600;color:var(--primary-700);"></span>
                    <button class="btn btn-sm btn-ghost" id="back-to-patient-btn" style="margin-left:auto;font-size:0.75rem;">
                        <span class="material-icons" style="font-size:14px;">arrow_back</span> Change Patient
                    </button>
                </div>

                <div class="dashed-border" style="
                    border-radius:var(--radius-xl); background:rgba(36,99,235,0.02);
                    display:flex; flex-direction:column; align-items:center; justify-content:center;
                    padding:64px 32px; text-align:center; cursor:pointer; position:relative;
                    transition:background 0.2s;
                " id="upload-area">
                    <input type="file" id="file-input" accept="image/jpeg,image/png,image/jpg" style="position:absolute;inset:0;width:100%;height:100%;opacity:0;cursor:pointer;" />
                    <div style="background:var(--primary-100);padding:20px;border-radius:var(--radius-xl);margin-bottom:20px;transition:transform 0.2s;">
                        <span class="material-symbols-outlined" style="color:var(--primary-500);font-size:48px;">cloud_upload</span>
                    </div>
                    <h3 style="font-size:1.25rem;font-weight:700;margin:0 0 8px;">Upload clinical document</h3>
                    <p style="color:var(--gray-500);font-size:0.875rem;margin:0 0 32px;">Drag and drop or click to browse files</p>
                    <div style="display:flex;align-items:center;gap:16px;">
                        <span style="font-size:0.625rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--gray-400);">Supported: JPG, PNG</span>
                        <div style="width:1px;height:16px;background:var(--gray-200);"></div>
                        <span style="font-size:0.625rem;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:var(--gray-400);">Max Size: 10MB</span>
                    </div>
                </div>

                <div style="margin-top:32px;display:flex;flex-direction:column;align-items:center;gap:16px;">
                    <button id="capture-tablet-btn" style="
                        display:flex;align-items:center;gap:8px;color:var(--primary-500);
                        font-weight:700;padding:12px 32px;border-radius:var(--radius-lg);
                        border:1px solid var(--primary-100);background:none;cursor:pointer;
                        transition:background 0.2s;
                    ">
                        <span class="material-icons-round">photo_camera</span>
                        <span>Capture with Tablet Camera</span>
                    </button>
                    <p style="font-size:0.625rem;color:var(--gray-400);font-weight:600;text-transform:uppercase;letter-spacing:0.15em;font-style:italic;">Secure HIPAA-Compliant Gateway</p>
                </div>
            </div>
        </div>

        <!-- ═══════ STEP 3+4: VERIFICATION VIEW ═══════ -->
        <div id="step-verify" class="verify-section" style="display:none; flex:1;">
            <!-- LEFT: Image Viewer -->
            <section class="viewer-panel">
                <div class="viewer-toolbar">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <label for="annotations-toggle">Annotations</label>
                        <div class="toggle-switch" id="annotations-toggle">
                            <div class="toggle-switch-track"></div>
                            <div class="toggle-switch-knob"></div>
                        </div>
                    </div>
                    <div style="width:1px;height:16px;background:var(--gray-200);"></div>
                    <div style="display:flex;gap:12px;color:var(--gray-500);">
                        <button id="zoom-in" style="background:none;border:none;cursor:pointer;color:inherit;" title="Zoom In"><span class="material-icons" style="font-size:18px;">zoom_in</span></button>
                        <button id="zoom-out" style="background:none;border:none;cursor:pointer;color:inherit;" title="Zoom Out"><span class="material-icons" style="font-size:18px;">zoom_out</span></button>
                        <button id="zoom-reset" style="background:none;border:none;cursor:pointer;color:inherit;" title="Reset"><span class="material-icons" style="font-size:18px;">crop_free</span></button>
                    </div>
                </div>
                <div class="viewer-viewport custom-scroll" id="image-viewport">
                    <div class="image-wrap" id="image-container">
                        <img id="viewer-img" alt="Medical Document" />
                        <div id="bounding-boxes-overlay" style="position:absolute;inset:0;z-index:10;pointer-events:none;"></div>
                    </div>
                </div>
                <div class="page-indicator">Page 1 of 1</div>
            </section>

            <!-- RIGHT: Data Verification -->
            <section class="data-panel">
                <div class="verify-warning" id="verify-warning">
                    <span class="material-icons">warning_amber</span>
                    <div>
                        <h3>Verification Required</h3>
                        <p>Please verify all clinical fields against the original document.</p>
                    </div>
                </div>

                <div class="verify-content custom-scroll">
                    <!-- Patient Context in Verification -->
                    <div style="
                        display:flex;align-items:center;gap:10px;padding:10px 14px;
                        background:var(--gray-50);border:1px solid var(--gray-100);
                        border-radius:var(--radius-md);margin-bottom:20px;
                    ">
                        <span class="material-icons" style="color:var(--primary-500);font-size:18px;">person</span>
                        <span id="verify-patient-context" style="font-size:0.8rem;font-weight:600;color:var(--gray-700);"></span>
                    </div>

                    <!-- Raw Text -->
                    <div style="margin-bottom:20px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                            <span class="field-label" style="margin:0;">Raw AI Extraction</span>
                            <div style="display:flex;align-items:center;gap:8px;">
                                <span style="font-size:0.56rem;font-weight:700;color:var(--gray-400);text-transform:uppercase;">Conf: <span id="verify-conf-score">94%</span></span>
                                <div style="width:64px;height:4px;background:var(--gray-100);border-radius:2px;overflow:hidden;">
                                    <div id="conf-bar-width" style="height:100%;background:var(--primary-500);width:94%;"></div>
                                </div>
                            </div>
                        </div>
                        <textarea id="raw-text-view" class="raw-text-box" readonly></textarea>
                    </div>

                    <!-- Structured Fields -->
                    <div id="structured-verification-fields">
                        <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:16px;">
                            <div>
                                <span class="field-label">Patient Name</span>
                                <input id="verify-patient-name" class="verify-input" type="text" />
                            </div>
                            <div>
                                <span class="field-label">Age</span>
                                <input id="verify-patient-age" class="verify-input" type="text" />
                            </div>
                        </div>
                        <div style="margin-bottom:16px;">
                            <span class="field-label">Clinical Diagnosis</span>
                            <div style="position:relative;">
                                <input id="verify-diagnosis" class="verify-input" type="text" style="padding-left:40px;" />
                                <span class="material-icons" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--primary-300);font-size:20px;">medical_services</span>
                            </div>
                        </div>

                        <!-- Medications Table -->
                        <div style="margin-bottom:16px;">
                            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
                                <span class="field-label" style="margin:0;">Medications List</span>
                                <button style="font-size:0.625rem;color:var(--primary-500);font-weight:700;text-transform:uppercase;letter-spacing:0.08em;background:none;border:none;cursor:pointer;display:flex;align-items:center;gap:4px;">
                                    <span class="material-icons" style="font-size:14px;">add_circle</span> Add Drug
                                </button>
                            </div>
                            <table class="meds-table">
                                <thead>
                                    <tr>
                                        <th>Drug</th>
                                        <th style="width:70px;text-align:center;">Dosage</th>
                                        <th style="width:80px;text-align:center;">Freq</th>
                                        <th style="width:36px;"></th>
                                    </tr>
                                </thead>
                                <tbody id="meds-table-body"></tbody>
                            </table>
                        </div>
                    </div>

                    <!-- Workflow Stepper -->
                    <div class="workflow-stepper">
                        <div class="step-done"><span class="material-icons" style="font-size:14px;">check_circle</span> AI DONE</div>
                        <div class="step-line done"></div>
                        <div class="step-active"><span class="material-icons" style="font-size:14px;">radio_button_checked</span> REVIEW</div>
                        <div class="step-line pending"></div>
                        <div class="step-pending"><span class="material-icons" style="font-size:14px;">radio_button_unchecked</span> EMR SYNC</div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="verify-footer">
                    <button class="discard" id="verification-cancel-btn">Discard Extraction</button>
                    <div style="display:flex;align-items:center;gap:12px;">
                        <button class="btn btn-secondary" id="resubmit-btn">Edit & Resubmit</button>
                        <button class="btn btn-primary" id="finalize-btn-new" style="display:flex;align-items:center;gap:8px;">
                            Send to Doctor <span class="material-icons" style="font-size:16px;">send</span>
                        </button>
                    </div>
                </div>
            </section>
        </div>

        <!-- ═══════ PROCESSING OVERLAY ═══════ -->
        <div id="processing-overlay" class="process-overlay">
            <div class="process-spinner">
                <div class="ring"></div>
                <div class="ring-spin"></div>
                <span class="material-icons icon">psychology</span>
            </div>
            <h3 style="font-size:1.25rem;font-weight:700;margin:0 0 8px;">Analyzing Document</h3>
            <p style="color:var(--gray-500);max-width:320px;font-size:0.875rem;line-height:1.6;">Identifying handwriting patterns and cross-referencing clinical vocabularies...</p>
            <div class="bounce-dots"><span></span><span></span><span></span></div>
        </div>

        <!-- ═══════ SUCCESS OVERLAY ═══════ -->
        <div id="success-state" class="success-overlay">
            <div class="success-icon">
                <span class="material-icons-round">check_circle</span>
            </div>
            <h2 style="font-size:1.5rem;font-weight:700;margin:0 0 8px;text-transform:uppercase;letter-spacing:-0.01em;">Saved to EMR Successfully</h2>
            <p style="color:var(--gray-500);max-width:320px;font-size:0.875rem;line-height:1.6;margin:0;">
                The clinical documentation has been synchronized and verified against the master patient index.
            </p>
            <div class="success-card">
                <div class="success-row"><span>Encounter ID</span><span class="val" style="font-family:monospace;" id="success-enc-id">ENC-772910</span></div>
                <div class="success-row"><span>Patient</span><span class="val" id="success-patient-name">—</span></div>
                <div class="success-row"><span>Verified By</span><span class="val" id="success-nurse-name">Nurse Priya</span></div>
                <div class="success-row"><span>Timestamp</span><span class="val" id="success-timestamp">—</span></div>
            </div>
            <div style="display:flex;flex-direction:column;width:100%;max-width:360px;gap:12px;">
                <button id="success-next-btn" class="btn btn-primary" style="width:100%;padding:14px;display:flex;align-items:center;justify-content:center;gap:8px;">
                    Process Next Patient <span class="material-icons" style="font-size:16px;">arrow_forward</span>
                </button>
                <button id="success-dashboard-btn" class="btn btn-secondary" style="width:100%;padding:14px;">
                    Clinical Dashboard
                </button>
            </div>
        </div>
    </div>
    `;

    renderAppShell('Verification Hub', bodyHTML, '/nurse/ocr');

    /* ═══════════════ STATE ═══════════════ */
    let selectedPatient = null;   // { id, name, age, gender, phone, address }
    let patientMode = 'existing'; // 'existing' | 'new'
    let selectedFile = null;
    let zoomLevel = 1;
    let showAnnotations = true;

    /* ═══════════════ DOM REFS ═══════════════ */
    const stepPatient = document.getElementById('step-patient-id');
    const stepUpload = document.getElementById('step-upload');
    const stepVerify = document.getElementById('step-verify');
    const proceedBtn = document.getElementById('proceed-to-upload-btn');
    const fileInput = document.getElementById('file-input');
    const viewerImg = document.getElementById('viewer-img');
    const processingOverlay = document.getElementById('processing-overlay');
    const successState = document.getElementById('success-state');
    const imageContainer = document.getElementById('image-container');
    const boxesOverlay = document.getElementById('bounding-boxes-overlay');

    /* ═══════════════ STEP 1: PATIENT TABS ═══════════════ */
    const tabExisting = document.getElementById('tab-existing');
    const tabNew = document.getElementById('tab-new');
    const panelExisting = document.getElementById('panel-existing');
    const panelNew = document.getElementById('panel-new');

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

    /* ═══════════════ STEP 1: EXISTING PATIENT SEARCH ═══════════════ */
    const searchInput = document.getElementById('patient-search-input');
    const resultsList = document.getElementById('search-results-list');
    const banner = document.getElementById('selected-patient-banner');
    let searchTimeout;

    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = searchInput.value.trim();
        if (q.length < 2) {
            resultsList.innerHTML = `<div style="padding:24px;text-align:center;color:var(--gray-400);font-size:0.85rem;">
                <span class="material-icons-outlined" style="font-size:32px;display:block;margin-bottom:8px;color:var(--gray-300);">person_search</span>
                Type at least 2 characters to search
            </div>`;
            return;
        }
        resultsList.innerHTML = `<div style="padding:20px;text-align:center;color:var(--gray-400);"><span class="spinner"></span> Searching…</div>`;
        searchTimeout = setTimeout(() => performSearch(q), 350);
    });

    async function performSearch(q) {
        try {
            const data = await searchPatients(q);
            const patients = data.patients || [];
            if (patients.length === 0) {
                resultsList.innerHTML = `<div style="padding:24px;text-align:center;color:var(--gray-400);font-size:0.85rem;">
                    <span class="material-icons-outlined" style="font-size:32px;display:block;margin-bottom:8px;color:var(--gray-300);">person_off</span>
                    No patients found for "${q}"
                </div>`;
                return;
            }
            resultsList.innerHTML = patients.map(p => `
                <div class="search-result-item" data-pid="${p.id}">
                    <div class="avatar">${(p.name || '?')[0]}</div>
                    <div class="info">
                        <div class="name">${p.name}</div>
                        <div class="meta">${p.age || '—'}y / ${p.gender || '—'} · ${p.phone || 'No phone'}</div>
                    </div>
                    <div class="pid-badge">${p.id}</div>
                </div>
            `).join('');

            resultsList.querySelectorAll('.search-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    const pt = patients.find(p => p.id === item.dataset.pid);
                    if (pt) selectPatient(pt);
                });
            });
        } catch (err) {
            resultsList.innerHTML = `<div style="padding:20px;text-align:center;color:var(--error);font-size:0.85rem;">Search failed: ${err.message}</div>`;
        }
    }

    function selectPatient(pt) {
        selectedPatient = pt;
        document.getElementById('selected-p-name').textContent = `${pt.name} (${pt.id})`;
        document.getElementById('selected-p-meta').textContent = `${pt.age || '—'}y / ${pt.gender || '—'} · ${pt.phone || 'No phone'} · ${pt.address || ''}`;
        banner.classList.add('visible');
        resultsList.style.display = 'none';
        searchInput.style.display = 'none';
        updateProceedState();
    }

    document.getElementById('clear-patient-btn').addEventListener('click', () => {
        selectedPatient = null;
        banner.classList.remove('visible');
        resultsList.style.display = '';
        searchInput.style.display = '';
        searchInput.value = '';
        resultsList.innerHTML = `<div style="padding:24px;text-align:center;color:var(--gray-400);font-size:0.85rem;">
            <span class="material-icons-outlined" style="font-size:32px;display:block;margin-bottom:8px;color:var(--gray-300);">person_search</span>
            Start typing to search patients
        </div>`;
        updateProceedState();
    });

    /* ═══════════════ STEP 1: NEW PATIENT FORM ═══════════════ */
    const newNameInput = document.getElementById('new-p-name');
    const newAgeInput = document.getElementById('new-p-age');
    const newGenderInput = document.getElementById('new-p-gender');
    const newPhoneInput = document.getElementById('new-p-phone');
    const newAddressInput = document.getElementById('new-p-address');

    [newNameInput, newAgeInput, newGenderInput].forEach(el => {
        el.addEventListener('input', updateProceedState);
        el.addEventListener('change', updateProceedState);
    });

    function updateProceedState() {
        if (patientMode === 'existing') {
            proceedBtn.disabled = !selectedPatient;
        } else {
            const hasName = newNameInput.value.trim().length > 0;
            const hasAge = newAgeInput.value.trim().length > 0;
            const hasGender = newGenderInput.value !== '';
            proceedBtn.disabled = !(hasName && hasAge && hasGender);
        }
    }

    /* ═══════════════ PROCEED TO UPLOAD ═══════════════ */
    proceedBtn.addEventListener('click', async () => {
        if (patientMode === 'new') {
            // Register new patient first
            proceedBtn.disabled = true;
            proceedBtn.innerHTML = '<span class="spinner" style="margin-right:8px;"></span> Registering...';
            try {
                const result = await registerPatient({
                    name: newNameInput.value.trim(),
                    age: parseInt(newAgeInput.value),
                    gender: newGenderInput.value,
                    phone: newPhoneInput.value.trim(),
                    address: newAddressInput.value.trim(),
                });
                selectedPatient = result.patient;
                showToast(`Patient ${selectedPatient.id} registered successfully`, 'success');
            } catch (err) {
                showToast(err.message || 'Registration failed', 'error');
                proceedBtn.disabled = false;
                proceedBtn.innerHTML = '<span>Continue to OCR Upload</span><span class="material-icons" style="font-size:18px;">arrow_forward</span>';
                return;
            }
        }

        // Transition to upload step
        stepPatient.style.display = 'none';
        stepUpload.style.display = 'flex';
        document.getElementById('upload-patient-label').textContent =
            `${selectedPatient.name} · ${selectedPatient.id} · ${selectedPatient.age || '—'}y / ${selectedPatient.gender || '—'}`;
    });

    /* ═══════════════ BACK TO PATIENT ═══════════════ */
    document.getElementById('back-to-patient-btn').addEventListener('click', () => {
        stepUpload.style.display = 'none';
        stepPatient.style.display = 'flex';
        proceedBtn.disabled = false;
        proceedBtn.innerHTML = '<span>Continue to OCR Upload</span><span class="material-icons" style="font-size:18px;">arrow_forward</span>';
    });

    /* ═══════════════ STEP 2: FILE UPLOAD ═══════════════ */
    const uploadArea = document.getElementById('upload-area');
    uploadArea.addEventListener('click', (e) => {
        if (e.target !== fileInput) fileInput.click();
    });

    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) handleFile(e.target.files[0]);
    });

    function handleFile(file) {
        if (!['image/jpeg', 'image/png', 'image/jpg'].includes(file.type)) {
            showToast('Only JPG/PNG images are supported', 'error');
            return;
        }
        selectedFile = file;
        viewerImg.src = URL.createObjectURL(file);
        startOCRProcess();
    }

    /* ═══════════════ STEP 3: OCR PROCESSING ═══════════════ */
    async function startOCRProcess() {
        stepUpload.style.display = 'none';
        stepVerify.style.display = 'flex';
        processingOverlay.classList.add('visible');

        try {
            const encId = `ENC-${Date.now().toString().slice(-6)}`;
            const result = await uploadPrescription({
                image: selectedFile,
                encounterId: encId,
                patientId: selectedPatient?.id || 'PT-UNKNOWN',
                capturedBy: user?.staff_id || 'unknown',
            });

            populateVerificationData(result);
            processingOverlay.classList.remove('visible');
        } catch (err) {
            const isNetworkError = err.message?.includes('Failed to fetch') ||
                err.message?.includes('NetworkError') ||
                err.message?.includes('ECONNRESET') ||
                err.name === 'TypeError';
            if (isNetworkError) {
                showToast('OCR timed out or server is busy. Try with a smaller image.', 'error');
            } else {
                showToast(err.message || 'OCR processing failed', 'error');
            }
            resetToUpload();
        }
    }

    function populateVerificationData(result) {
        // Patient context
        document.getElementById('verify-patient-context').textContent =
            `${selectedPatient?.name || '—'} · ${selectedPatient?.id || '—'} · ${selectedPatient?.age || '—'}y / ${selectedPatient?.gender || '—'}`;

        // Raw text
        document.getElementById('raw-text-view').value = result.raw_text || result.normalized_text || '';
        document.getElementById('verify-conf-score').textContent = `${(result.confidence_mean || 0).toFixed(0)}%`;
        document.getElementById('conf-bar-width').style.width = `${(result.confidence_mean || 0)}%`;

        // Extract patient name/age from OCR fields (fallback to selected patient)
        const nameField = result.structured_fields?.find(f => f.field_type?.toLowerCase().includes('name'));
        const ageField = result.structured_fields?.find(f => f.field_type?.toLowerCase().includes('age'));

        document.getElementById('verify-patient-name').value = nameField?.text || nameField?.value || selectedPatient?.name || '';
        document.getElementById('verify-patient-age').value = ageField?.text || ageField?.value || selectedPatient?.age || '';

        // Medications
        const tableBody = document.getElementById('meds-table-body');
        const meds = result.structured_fields?.filter(f =>
            f.field_type?.toLowerCase().includes('medicine') || f.field_type?.toLowerCase().includes('drug')
        ) || [];

        tableBody.innerHTML = meds.map(m => `
            <tr>
                <td><input type="text" value="${m.text || m.value}" /></td>
                <td style="text-align:center;color:var(--gray-500);font-weight:500;">500mg</td>
                <td style="text-align:center;color:var(--gray-500);font-weight:500;">1-1-1</td>
                <td style="text-align:right;">
                    <button style="background:none;border:none;color:var(--gray-300);cursor:pointer;transition:color 0.2s;" onmouseover="this.style.color='var(--error)'" onmouseout="this.style.color='var(--gray-300)'">
                        <span class="material-icons" style="font-size:16px;">delete</span>
                    </button>
                </td>
            </tr>
        `).join('');

        if (showAnnotations) renderAnnotations(result.structured_fields || []);
    }

    /* ── Field type → icon + target field mapping ── */
    const FIELD_META = {
        name: { icon: 'person', label: 'Patient Name', targetId: 'verify-patient-name' },
        age: { icon: 'cake', label: 'Age', targetId: 'verify-patient-age' },
        diagnosis: { icon: 'medical_services', label: 'Diagnosis', targetId: 'verify-diagnosis' },
        medicine: { icon: 'medication', label: 'Medication', targetId: 'meds-table-body' },
        drug: { icon: 'medication', label: 'Medication', targetId: 'meds-table-body' },
        medication: { icon: 'medication', label: 'Medication', targetId: 'meds-table-body' },
        lab: { icon: 'science', label: 'Lab Value', targetId: null },
        test: { icon: 'biotech', label: 'Test', targetId: null },
        hospital: { icon: 'local_hospital', label: 'Hospital', targetId: null },
        date: { icon: 'calendar_today', label: 'Date', targetId: null },
        doctor: { icon: 'stethoscope', label: 'Doctor', targetId: null },
    };

    function getFieldMeta(fieldType) {
        if (!fieldType) return { icon: 'description', label: 'Field', targetId: null };
        const ft = fieldType.toLowerCase();
        for (const [key, meta] of Object.entries(FIELD_META)) {
            if (ft.includes(key)) return meta;
        }
        return { icon: 'description', label: fieldType, targetId: null };
    }

    function getConfClass(conf) {
        if (conf >= 80) return 'high';
        if (conf >= 50) return 'mid';
        return 'low';
    }

    function renderAnnotations(fields) {
        if (!fields || fields.length === 0) {
            boxesOverlay.innerHTML = `
                <div class="anno-sidebar">
                    <div class="anno-chip" style="cursor:default;opacity:0.6;">
                        <span class="material-icons anno-icon" style="color:var(--gray-400);">info</span>
                        <div class="anno-info">
                            <div class="anno-type">No fields detected</div>
                            <div class="anno-text">OCR returned no structured data</div>
                        </div>
                    </div>
                </div>`;
            return;
        }

        const chips = fields.map((f, i) => {
            const meta = getFieldMeta(f.field_type);
            const conf = Math.round(f.confidence || 0);
            const confLevel = getConfClass(conf);
            const text = f.text || f.value || '—';
            const truncText = text.length > 22 ? text.slice(0, 22) + '…' : text;

            return `
                <div class="anno-chip conf-border-${confLevel}" data-anno-idx="${i}" data-target="${meta.targetId || ''}">
                    <span class="material-icons anno-icon" style="color:${confLevel === 'high' ? 'var(--success)' : confLevel === 'mid' ? '#f59e0b' : 'var(--error)'}">${meta.icon}</span>
                    <div class="anno-info">
                        <div class="anno-type">${meta.label}</div>
                        <div class="anno-text" title="${text}">${truncText}</div>
                    </div>
                    <span class="anno-conf conf-${confLevel}">${conf}%</span>
                </div>`;
        }).join('');

        boxesOverlay.innerHTML = `<div class="anno-sidebar">${chips}</div>`;

        // Interactive: click chip → highlight the linked verification field
        boxesOverlay.querySelectorAll('.anno-chip[data-target]').forEach(chip => {
            chip.addEventListener('click', () => {
                const targetId = chip.dataset.target;
                if (!targetId) return;

                // Remove previous highlights
                document.querySelectorAll('.field-highlight').forEach(el => el.classList.remove('field-highlight'));
                document.querySelectorAll('.anno-chip.active').forEach(el => el.classList.remove('active'));

                // Highlight this chip
                chip.classList.add('active');

                // Highlight the target field
                const target = document.getElementById(targetId);
                if (!target) return;

                // For the meds table, highlight the table wrapper
                const highlightEl = target.closest('.meds-table') || target;
                highlightEl.classList.add('field-highlight');
                highlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Auto-remove highlight after 3s
                setTimeout(() => {
                    highlightEl.classList.remove('field-highlight');
                    chip.classList.remove('active');
                }, 3000);
            });
        });
    }

    /* ═══════════════ STEP 4: FINALIZE ═══════════════ */
    const finalizeBtn = document.getElementById('finalize-btn-new');
    finalizeBtn.addEventListener('click', () => {
        finalizeBtn.disabled = true;
        finalizeBtn.innerHTML = '<span class="material-icons" style="font-size:16px;animation:spin 1s linear infinite;">sync</span> SYNCING...';

        setTimeout(() => {
            const encId = `ENC-${Math.floor(100000 + Math.random() * 900000)}`;
            document.getElementById('success-enc-id').textContent = encId;
            document.getElementById('success-patient-name').textContent = selectedPatient?.name || '—';
            document.getElementById('success-nurse-name').textContent = user ? user.name || user.username : 'Nurse Priya';
            document.getElementById('success-timestamp').textContent = new Date().toLocaleString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            stepVerify.style.display = 'none';
            successState.classList.add('visible');
        }, 1500);
    });

    document.getElementById('resubmit-btn').addEventListener('click', () => {
        showToast('Re-processing document...', 'info');
        startOCRProcess();
    });

    document.getElementById('verification-cancel-btn').addEventListener('click', resetToUpload);
    document.getElementById('success-next-btn').addEventListener('click', () => window.location.reload());
    document.getElementById('success-dashboard-btn').addEventListener('click', () => window.location.hash = '#/nurse/dashboard');

    function resetToUpload() {
        stepVerify.style.display = 'none';
        processingOverlay.classList.remove('visible');
        stepUpload.style.display = 'flex';
        fileInput.value = '';
        selectedFile = null;
        finalizeBtn.disabled = false;
        finalizeBtn.innerHTML = 'Send to Doctor <span class="material-icons" style="font-size:16px;">send</span>';
    }

    /* ═══════════════ VIEWER CONTROLS ═══════════════ */
    document.getElementById('zoom-in').addEventListener('click', () => { zoomLevel += 0.2; updateZoom(); });
    document.getElementById('zoom-out').addEventListener('click', () => { if (zoomLevel > 0.4) zoomLevel -= 0.2; updateZoom(); });
    document.getElementById('zoom-reset').addEventListener('click', () => { zoomLevel = 1; updateZoom(); });

    function updateZoom() { imageContainer.style.transform = `scale(${zoomLevel})`; }

    // Annotations toggle
    const annoToggle = document.getElementById('annotations-toggle');
    annoToggle.addEventListener('click', () => {
        showAnnotations = !showAnnotations;
        if (showAnnotations) {
            annoToggle.classList.remove('off');
            boxesOverlay.style.display = '';
        } else {
            annoToggle.classList.add('off');
            boxesOverlay.style.display = 'none';
            // Remove any active highlights
            document.querySelectorAll('.field-highlight').forEach(el => el.classList.remove('field-highlight'));
        }
    });
}
