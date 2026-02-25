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

        /* ── Full-Width Verification Layout ── */
        .verify-section {
            display: flex; flex-direction: column; height: 100%; overflow: hidden;
        }

        /* Verification Form — full width */
        .verify-form-panel {
            display: flex; flex-direction: column; overflow: hidden; background: white; flex: 1;
        }
        .verify-topbar {
            display: flex; align-items: center; gap: 12px; padding: 10px 24px;
            background: var(--gray-50); border-bottom: 1px solid var(--gray-200);
            flex-shrink: 0;
        }
        .verify-topbar .patient-ctx {
            display: flex; align-items: center; gap: 8px; font-size: 0.8rem;
            font-weight: 600; color: var(--gray-700); flex: 1;
        }
        .verify-topbar .patient-ctx .material-icons { font-size: 18px; color: var(--primary-500); }
        .verify-topbar .conf-badge {
            display: flex; align-items: center; gap: 6px; padding: 4px 10px;
            background: white; border: 1px solid var(--gray-200); border-radius: var(--radius-full);
            font-size: 0.6rem; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.08em; color: var(--gray-500);
        }
        .verify-topbar .conf-badge .conf-dot {
            width: 6px; height: 6px; border-radius: 50%; background: var(--success);
        }
        .verify-topbar .compare-trigger {
            display: flex; align-items: center; gap: 6px; padding: 6px 14px;
            background: var(--primary-50); border: 1px solid var(--primary-200);
            border-radius: var(--radius-md); cursor: pointer; font-size: 0.68rem;
            font-weight: 700; color: var(--primary-600); transition: all 0.15s;
            text-transform: uppercase; letter-spacing: 0.06em;
        }
        .verify-topbar .compare-trigger:hover { background: var(--primary-100); border-color: var(--primary-300); }
        .verify-topbar .compare-trigger .material-icons { font-size: 16px; }

        .verify-form-scroll { flex: 1; overflow-y: auto; padding: 20px 28px; }

        /* ── Compare Overlay (full-viewport modal) ── */
        .compare-overlay {
            position: fixed; inset: 0; z-index: 200; display: none;
            background: rgba(0,0,0,0.6); backdrop-filter: blur(4px);
        }
        .compare-overlay.open { display: flex; align-items: stretch; justify-content: center; }
        .compare-container {
            width: 96vw; height: 94vh; margin: auto; display: grid;
            grid-template-columns: 1fr 1fr; grid-template-rows: auto 1fr;
            background: white; border-radius: var(--radius-xl);
            box-shadow: 0 25px 60px rgba(0,0,0,0.3); overflow: hidden;
        }
        .compare-header {
            grid-column: 1 / -1; display: flex; align-items: center;
            justify-content: space-between; padding: 14px 24px;
            background: var(--gray-50); border-bottom: 1px solid var(--gray-200);
        }
        .compare-header h3 { margin: 0; font-size: 0.9rem; display: flex; align-items: center; gap: 8px; }
        .compare-close {
            background: none; border: none; cursor: pointer; color: var(--gray-400);
            padding: 6px; border-radius: var(--radius-sm); transition: all 0.15s;
        }
        .compare-close:hover { color: var(--gray-700); background: var(--gray-100); }
        .compare-pane {
            overflow: auto; display: flex; flex-direction: column;
        }
        .compare-pane-label {
            padding: 8px 16px; font-size: 0.6rem; font-weight: 700;
            text-transform: uppercase; letter-spacing: 0.12em; color: var(--gray-400);
            background: var(--gray-50); border-bottom: 1px solid var(--gray-100);
            display: flex; align-items: center; gap: 6px; flex-shrink: 0;
        }
        .compare-pane-label .material-icons { font-size: 14px; }
        .compare-img-wrap {
            flex: 1; display: flex; align-items: flex-start; justify-content: center;
            padding: 20px; overflow: auto; background: var(--gray-100);
        }
        .compare-img-wrap img {
            max-width: 100%; height: auto; border-radius: var(--radius-md);
            box-shadow: var(--shadow-lg); transform-origin: top center;
            transition: transform 0.2s ease;
        }
        .compare-zoom-bar {
            display: flex; align-items: center; justify-content: center;
            gap: 10px; padding: 8px; background: white;
            border-top: 1px solid var(--gray-100); flex-shrink: 0;
        }
        .compare-zoom-bar button {
            background: none; border: none; cursor: pointer; color: var(--gray-500);
            padding: 4px; border-radius: var(--radius-sm); transition: all 0.15s;
        }
        .compare-zoom-bar button:hover { color: var(--primary-500); background: var(--primary-50); }
        .compare-zoom-bar .zoom-level {
            font-size: 0.6rem; font-weight: 700; color: var(--gray-400);
            min-width: 32px; text-align: center;
        }
        .compare-text-pane {
            flex: 1; padding: 16px; overflow: auto;
            border-left: 1px solid var(--gray-200);
        }
        .compare-text-pane textarea {
            width: 100%; height: 100%; min-height: 300px; font-size: 0.82rem;
            font-family: 'JetBrains Mono', monospace; background: white;
            border: 1px solid var(--gray-200); border-radius: var(--radius-md);
            padding: 16px; color: var(--gray-700); resize: none; line-height: 1.8;
        }
        .compare-text-pane textarea:focus {
            outline: none; border-color: var(--primary-400);
            box-shadow: 0 0 0 3px var(--primary-100);
        }
        .compare-text-actions {
            padding: 10px 16px; display: flex; justify-content: flex-end; gap: 8px;
            background: var(--gray-50); border-top: 1px solid var(--gray-100);
            border-left: 1px solid var(--gray-200); flex-shrink: 0;
        }

        /* ── Editable Extracted Text (inline) ── */
        .extracted-text-section {
            margin-bottom: 18px; border: 1px solid var(--gray-200);
            border-radius: var(--radius-md); overflow: hidden;
        }
        .extracted-text-header {
            display: flex; align-items: center; justify-content: space-between;
            padding: 10px 14px; background: var(--gray-50);
            border-bottom: 1px solid var(--gray-100);
        }
        .extracted-text-header .label {
            font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
            letter-spacing: 0.1em; color: var(--gray-500);
            display: flex; align-items: center; gap: 6px;
        }
        .extracted-text-header .label .material-icons { font-size: 15px; color: var(--primary-400); }
        .extracted-text-header .edit-hint {
            font-size: 0.6rem; color: var(--gray-400); font-style: italic;
        }
        .extracted-text-body textarea {
            width: 100%; height: 100px; font-size: 0.75rem; font-family: 'JetBrains Mono', monospace;
            background: white; border: none; padding: 12px 14px; color: var(--gray-700);
            resize: vertical; line-height: 1.7;
        }
        .extracted-text-body textarea:focus {
            outline: none; background: var(--primary-50);
        }

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

        /* ── Vitals Section ── */
        .vitals-section { margin-bottom: 16px; }
        .vitals-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
        .vitals-list { display: flex; flex-direction: column; gap: 6px; }
        .vital-row {
            display: grid; grid-template-columns: 1fr 90px 60px 28px; gap: 6px; align-items: center;
            padding: 8px 12px; background: var(--gray-50); border: 1px solid var(--gray-100);
            border-radius: var(--radius-md); font-size: 0.78rem; transition: all 0.15s;
        }
        .vital-row:hover { border-color: var(--primary-200); background: var(--primary-50); }
        .vital-row .vital-type { font-weight: 700; color: var(--gray-800); display:flex; align-items:center; gap:5px; }
        .vital-row .vital-type .material-icons { font-size:15px; color:var(--primary-400); }
        .vital-row .vital-val { font-weight: 600; text-align: center; color: var(--gray-700); }
        .vital-row .vital-unit { font-size: 0.65rem; color: var(--gray-400); font-weight: 600; text-align: center; }
        .vital-row .vital-del {
            background: none; border: none; color: var(--gray-300); cursor: pointer;
            padding: 2px; border-radius: var(--radius-sm); transition: all 0.15s;
        }
        .vital-row .vital-del:hover { color: var(--error); background: #fee2e2; }
        .vital-empty { padding:24px; text-align:center; color:var(--gray-400); font-size:0.78rem;
            background:var(--gray-50); border:1px dashed var(--gray-200); border-radius:var(--radius-md); }

        /* ── Vital Add Dropdown ── */
        .vital-add-area { position: relative; margin-bottom: 10px; }
        .vital-search-input {
            width: 100%; padding: 9px 12px 9px 34px; border: 1px solid var(--gray-200);
            border-radius: var(--radius-md); font-size: 0.8rem; background: white;
            transition: all var(--transition-fast);
        }
        .vital-search-input:focus { outline:none; border-color:var(--primary-500); box-shadow:0 0 0 3px var(--primary-100); }
        .vital-dropdown {
            position: absolute; top: 100%; left: 0; right: 0; z-index: 30;
            background: white; border: 1px solid var(--gray-200); border-radius: var(--radius-md);
            box-shadow: var(--shadow-lg); max-height: 200px; overflow-y: auto; display: none;
        }
        .vital-dropdown.open { display: block; }
        .vital-dropdown-item {
            display: flex; align-items: center; gap: 8px; padding: 8px 12px;
            cursor: pointer; font-size: 0.78rem; font-weight: 600; transition: background 0.15s;
            border-bottom: 1px solid var(--gray-50);
        }
        .vital-dropdown-item:last-child { border-bottom: none; }
        .vital-dropdown-item:hover { background: var(--primary-50); }
        .vital-dropdown-item .material-icons { font-size: 16px; color: var(--primary-400); }
        .vital-value-row {
            display: grid; grid-template-columns: 1fr 72px; gap: 8px; margin-top: 8px;
            animation: fadeIn 0.2s ease;
        }
        .vital-value-row input {
            padding: 9px 12px; border: 1px solid var(--gray-200); border-radius: var(--radius-md);
            font-size: 0.8rem; font-weight: 600; transition: all var(--transition-fast);
        }
        .vital-value-row input:focus { outline:none; border-color:var(--primary-500); box-shadow:0 0 0 3px var(--primary-100); }

        /* ── Workflow Stepper (compact) ── */
        .workflow-stepper {
            padding-top: 16px; margin-top: 16px; border-top: 1px solid var(--gray-100);
            display: flex; align-items: center; justify-content: space-between;
            font-size: 0.52rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em;
        }
        .step-done { color: var(--success); display: flex; align-items: center; gap: 4px; }
        .step-active { color: var(--primary-500); display: flex; align-items: center; gap: 4px; }
        .step-pending { color: var(--gray-300); display: flex; align-items: center; gap: 4px; }
        .step-line { height: 1px; flex: 1; margin: 0 10px; }
        .step-line.done { background: var(--success-light); }
        .step-line.pending { background: var(--gray-100); }

        /* ── Verify Footer ── */
        .verify-footer {
            padding: 12px 20px; border-top: 1px solid var(--gray-200);
            display: flex; align-items: center; justify-content: space-between;
            background: white; flex-shrink: 0;
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
            <!-- Hidden image holder for compare overlay -->
            <img id="viewer-img" alt="Medical Document" style="display:none;" />

            <!-- Verification Form (full width) -->
            <section class="verify-form-panel">
                <!-- Top Bar: Patient + Confidence + Compare -->
                <div class="verify-topbar">
                    <div class="patient-ctx">
                        <span class="material-icons">person</span>
                        <span id="verify-patient-context"></span>
                    </div>
                    <div class="conf-badge">
                        <span class="conf-dot" id="conf-dot"></span>
                        Conf: <span id="verify-conf-score">—</span>
                    </div>
                    <button class="compare-trigger" id="open-compare-btn">
                        <span class="material-icons">compare</span>
                        Compare with Original
                    </button>
                </div>

                <!-- Scrollable Form Area -->
                <div class="verify-form-scroll custom-scroll">
                    <!-- Editable Extracted Text -->
                    <div class="extracted-text-section">
                        <div class="extracted-text-header">
                            <span class="label">
                                <span class="material-icons">text_snippet</span>
                                AI Extracted Text
                            </span>
                            <span class="edit-hint">Click to edit · Changes auto-save</span>
                        </div>
                        <div class="extracted-text-body">
                            <textarea id="raw-text-view" placeholder="Extracted text will appear here..."></textarea>
                        </div>
                    </div>

                    <!-- Structured Fields (3-column dense) -->
                    <div id="structured-verification-fields">
                        <div style="display:grid;grid-template-columns:2fr 1fr 2fr;gap:14px;margin-bottom:14px;">
                            <div>
                                <span class="field-label">Patient Name</span>
                                <input id="verify-patient-name" class="verify-input" type="text" />
                            </div>
                            <div>
                                <span class="field-label">Age</span>
                                <input id="verify-patient-age" class="verify-input" type="text" />
                            </div>
                            <div>
                                <span class="field-label">Clinical Diagnosis</span>
                                <div style="position:relative;">
                                    <input id="verify-diagnosis" class="verify-input" type="text" style="padding-left:36px;" />
                                    <span class="material-icons" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--primary-300);font-size:18px;">medical_services</span>
                                </div>
                            </div>
                        </div>

                        <!-- Vitals Section -->
                        <div class="vitals-section">
                            <div class="vitals-header">
                                <span class="field-label" style="margin:0;">Vitals</span>
                            </div>
                            <div class="vital-add-area" id="vital-add-area">
                                <span class="material-icons" style="position:absolute;left:10px;top:9px;font-size:16px;color:var(--gray-400);z-index:2;">search</span>
                                <input type="text" class="vital-search-input" id="vital-search" placeholder="Search vital (BP, Temp, SpO2...)" autocomplete="off" />
                                <div class="vital-dropdown" id="vital-dropdown"></div>
                                <div id="vital-value-entry"></div>
                            </div>
                            <div class="vitals-list" id="vitals-list">
                                <div class="vital-empty" id="vitals-empty">
                                    <span class="material-icons" style="font-size:24px;display:block;margin-bottom:4px;color:var(--gray-300);">monitor_heart</span>
                                    No vitals added yet
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Workflow Stepper -->
                    <div class="workflow-stepper">
                        <div class="step-done"><span class="material-icons" style="font-size:13px;">check_circle</span> AI DONE</div>
                        <div class="step-line done"></div>
                        <div class="step-active"><span class="material-icons" style="font-size:13px;">radio_button_checked</span> REVIEW</div>
                        <div class="step-line pending"></div>
                        <div class="step-pending"><span class="material-icons" style="font-size:13px;">radio_button_unchecked</span> SAVE</div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="verify-footer">
                    <button class="discard" id="verification-cancel-btn">Discard</button>
                    <div style="display:flex;align-items:center;gap:10px;">
                        <button class="btn btn-secondary" id="resubmit-btn" style="font-size:0.75rem;">Resubmit</button>
                        <button class="btn btn-primary" id="finalize-btn-new" style="display:flex;align-items:center;gap:6px;font-size:0.8rem;">
                            Save & Send <span class="material-icons" style="font-size:16px;">send</span>
                        </button>
                    </div>
                </div>
            </section>
        </div>

        <!-- ═══════ COMPARE OVERLAY (Full-viewport modal) ═══════ -->
        <div id="compare-overlay" class="compare-overlay">
            <div class="compare-container">
                <div class="compare-header">
                    <h3><span class="material-icons" style="font-size:20px;color:var(--primary-500);">compare</span> Compare: Original Document vs Extracted Text</h3>
                    <button class="compare-close" id="close-compare-btn" title="Close">
                        <span class="material-icons" style="font-size:20px;">close</span>
                    </button>
                </div>
                <!-- Left: Original Image -->
                <div class="compare-pane">
                    <div class="compare-pane-label">
                        <span class="material-icons">image</span> Original Document
                    </div>
                    <div class="compare-img-wrap" id="compare-img-wrap">
                        <img id="compare-img" alt="Original Document" />
                    </div>
                    <div class="compare-zoom-bar">
                        <button id="compare-zoom-out" title="Zoom Out"><span class="material-icons" style="font-size:16px;">remove</span></button>
                        <span class="zoom-level" id="compare-zoom-label">100%</span>
                        <button id="compare-zoom-in" title="Zoom In"><span class="material-icons" style="font-size:16px;">add</span></button>
                        <button id="compare-zoom-reset" title="Fit"><span class="material-icons" style="font-size:16px;">fit_screen</span></button>
                    </div>
                </div>
                <!-- Right: Extracted Text (editable) -->
                <div class="compare-pane" style="display:flex;flex-direction:column;">
                    <div class="compare-pane-label">
                        <span class="material-icons">text_snippet</span> Extracted Text
                        <span style="margin-left:auto;font-size:0.55rem;color:var(--gray-300);font-style:italic;">Editable — corrections sync back</span>
                    </div>
                    <div class="compare-text-pane">
                        <textarea id="compare-text-editor"></textarea>
                    </div>
                    <div class="compare-text-actions">
                        <button class="btn btn-secondary btn-sm" id="compare-discard-btn">Discard Changes</button>
                        <button class="btn btn-primary btn-sm" id="compare-save-btn">
                            <span class="material-icons" style="font-size:14px;">check</span> Apply Changes
                        </button>
                    </div>
                </div>
            </div>
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
            <h2 style="font-size:1.5rem;font-weight:700;margin:0 0 8px;text-transform:uppercase;letter-spacing:-0.01em;">Saved Successfully</h2>
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

    /* ═══════════════ VITALS DATA ═══════════════ */
    const VITAL_TYPES = [
        { key: 'bp', label: 'Blood Pressure', icon: 'favorite', unit: 'mmHg', placeholder: '120/80' },
        { key: 'temp', label: 'Temperature', icon: 'thermostat', unit: '°F', placeholder: '98.6' },
        { key: 'spo2', label: 'SpO2', icon: 'oxygen', unit: '%', placeholder: '98' },
        { key: 'resp', label: 'Resp Rate', icon: 'pulmonology', unit: '/min', placeholder: '18' },
        { key: 'hr', label: 'Heart Rate', icon: 'monitor_heart', unit: 'bpm', placeholder: '72' },
        { key: 'wt', label: 'Weight', icon: 'fitness_center', unit: 'kg', placeholder: '65' },
        { key: 'ht', label: 'Height', icon: 'height', unit: 'cm', placeholder: '170' },
    ];

    /* ═══════════════ STATE ═══════════════ */
    let selectedPatient = null;   // { id, name, age, gender, phone, address }
    let patientMode = 'existing'; // 'existing' | 'new'
    let selectedFile = null;
    let zoomLevel = 1;
    let currentEncId = null;
    let currentVitals = [];       // [{ key, label, icon, unit, value }]


    /* ═══════════════ DOM REFS ═══════════════ */
    const stepPatient = document.getElementById('step-patient-id');
    const stepUpload = document.getElementById('step-upload');
    const stepVerify = document.getElementById('step-verify');
    const proceedBtn = document.getElementById('proceed-to-upload-btn');
    const fileInput = document.getElementById('file-input');
    const viewerImg = document.getElementById('viewer-img');
    const processingOverlay = document.getElementById('processing-overlay');
    const successState = document.getElementById('success-state');


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
            const encId = `ENC-${new Date().getFullYear()}-${Date.now().toString().slice(-3)}`;
            currentEncId = encId;
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

        // Raw text & confidence
        const rawText = result.raw_text || result.normalized_text || '';
        document.getElementById('raw-text-view').value = rawText;
        const conf = Math.round(result.confidence_mean || 0);
        document.getElementById('verify-conf-score').textContent = `${conf}%`;

        // Confidence dot color
        const confDot = document.getElementById('conf-dot');
        if (conf >= 80) confDot.style.background = 'var(--success)';
        else if (conf >= 50) confDot.style.background = '#f59e0b';
        else confDot.style.background = 'var(--error)';

        // Extract patient name/age from OCR fields (fallback to selected patient)
        const nameField = result.structured_fields?.find(f => f.field_type?.toLowerCase().includes('name'));
        const ageField = result.structured_fields?.find(f => f.field_type?.toLowerCase().includes('age'));

        document.getElementById('verify-patient-name').value = nameField?.text || nameField?.value || selectedPatient?.name || '';
        document.getElementById('verify-patient-age').value = ageField?.text || ageField?.value || selectedPatient?.age || '';

        // Load persisted vitals for this encounter
        currentVitals = loadVitalsFromStorage();
        renderVitalsList();
    }

    /* ═══════════════ COMPARE OVERLAY ═══════════════ */
    const compareOverlay = document.getElementById('compare-overlay');
    const compareImg = document.getElementById('compare-img');
    const compareTextEditor = document.getElementById('compare-text-editor');
    let compareZoom = 1;

    document.getElementById('open-compare-btn').addEventListener('click', () => {
        // Populate compare overlay with current data
        compareImg.src = viewerImg.src;
        compareTextEditor.value = document.getElementById('raw-text-view').value;
        compareZoom = 1;
        compareImg.style.transform = 'scale(1)';
        document.getElementById('compare-zoom-label').textContent = '100%';
        compareOverlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    });

    document.getElementById('close-compare-btn').addEventListener('click', () => {
        compareOverlay.classList.remove('open');
        document.body.style.overflow = '';
    });

    // Close on backdrop click
    compareOverlay.addEventListener('click', (e) => {
        if (e.target === compareOverlay) {
            compareOverlay.classList.remove('open');
            document.body.style.overflow = '';
        }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && compareOverlay.classList.contains('open')) {
            compareOverlay.classList.remove('open');
            document.body.style.overflow = '';
        }
    });

    // Apply edited text back to main form
    document.getElementById('compare-save-btn').addEventListener('click', () => {
        document.getElementById('raw-text-view').value = compareTextEditor.value;
        showToast('Extracted text updated', 'success');
        compareOverlay.classList.remove('open');
        document.body.style.overflow = '';
    });

    // Discard changes in compare editor
    document.getElementById('compare-discard-btn').addEventListener('click', () => {
        compareTextEditor.value = document.getElementById('raw-text-view').value;
        showToast('Changes discarded', 'info');
    });

    // Compare overlay zoom controls
    document.getElementById('compare-zoom-in').addEventListener('click', () => {
        compareZoom = Math.min(compareZoom + 0.25, 3);
        compareImg.style.transform = `scale(${compareZoom})`;
        document.getElementById('compare-zoom-label').textContent = `${Math.round(compareZoom * 100)}%`;
    });
    document.getElementById('compare-zoom-out').addEventListener('click', () => {
        compareZoom = Math.max(compareZoom - 0.25, 0.5);
        compareImg.style.transform = `scale(${compareZoom})`;
        document.getElementById('compare-zoom-label').textContent = `${Math.round(compareZoom * 100)}%`;
    });
    document.getElementById('compare-zoom-reset').addEventListener('click', () => {
        compareZoom = 1;
        compareImg.style.transform = 'scale(1)';
        document.getElementById('compare-zoom-label').textContent = '100%';
    });

    /* ═══════════════ VITALS MANAGEMENT ═══════════════ */
    const vitalSearch = document.getElementById('vital-search');
    const vitalDropdown = document.getElementById('vital-dropdown');
    const vitalValueEntry = document.getElementById('vital-value-entry');
    let pendingVitalType = null;

    vitalSearch.addEventListener('focus', () => showVitalDropdown(''));
    vitalSearch.addEventListener('input', () => showVitalDropdown(vitalSearch.value.trim().toLowerCase()));

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.vital-add-area')) {
            vitalDropdown.classList.remove('open');
        }
    });

    function showVitalDropdown(filter) {
        const available = VITAL_TYPES.filter(v =>
            !currentVitals.some(cv => cv.key === v.key) &&
            (filter === '' || v.label.toLowerCase().includes(filter) || v.key.includes(filter))
        );
        if (available.length === 0) {
            vitalDropdown.innerHTML = '<div style="padding:14px;text-align:center;color:var(--gray-400);font-size:0.8rem;">All vitals added</div>';
        } else {
            vitalDropdown.innerHTML = available.map(v => `
                <div class="vital-dropdown-item" data-key="${v.key}">
                    <span class="material-icons">${v.icon}</span>
                    <span>${v.label}</span>
                    <span style="margin-left:auto;font-size:0.65rem;color:var(--gray-400);">${v.unit}</span>
                </div>
            `).join('');

            vitalDropdown.querySelectorAll('.vital-dropdown-item').forEach(item => {
                item.addEventListener('click', () => {
                    const vt = VITAL_TYPES.find(v => v.key === item.dataset.key);
                    if (vt) selectVitalType(vt);
                });
            });
        }
        vitalDropdown.classList.add('open');
    }

    function selectVitalType(vt) {
        pendingVitalType = vt;
        vitalDropdown.classList.remove('open');
        vitalSearch.value = vt.label;
        vitalSearch.disabled = true;

        vitalValueEntry.innerHTML = `
            <div class="vital-value-row">
                <input type="text" id="vital-value-input" placeholder="${vt.placeholder}" autofocus />
                <button class="btn btn-primary" id="vital-add-btn" style="padding:10px 16px;font-size:0.8rem;">Add</button>
            </div>
        `;

        const valInput = document.getElementById('vital-value-input');
        setTimeout(() => valInput.focus(), 50);

        valInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addVital(); });
        document.getElementById('vital-add-btn').addEventListener('click', addVital);
    }

    function addVital() {
        const valInput = document.getElementById('vital-value-input');
        const val = valInput?.value?.trim();
        if (!val || !pendingVitalType) {
            showToast('Please enter a value', 'error');
            return;
        }
        currentVitals.push({
            key: pendingVitalType.key,
            label: pendingVitalType.label,
            icon: pendingVitalType.icon,
            unit: pendingVitalType.unit,
            value: val,
        });
        saveVitalsToStorage();
        renderVitalsList();

        // Reset add area
        pendingVitalType = null;
        vitalSearch.value = '';
        vitalSearch.disabled = false;
        vitalValueEntry.innerHTML = '';
        showToast(`${currentVitals[currentVitals.length - 1].label} added`, 'success');
    }

    function removeVital(key) {
        currentVitals = currentVitals.filter(v => v.key !== key);
        saveVitalsToStorage();
        renderVitalsList();
    }

    function renderVitalsList() {
        const list = document.getElementById('vitals-list');
        const empty = document.getElementById('vitals-empty');
        if (currentVitals.length === 0) {
            list.innerHTML = '';
            list.appendChild(empty.cloneNode(true)).style.display = '';
            return;
        }
        list.innerHTML = currentVitals.map(v => `
            <div class="vital-row" data-key="${v.key}">
                <div class="vital-type"><span class="material-icons">${v.icon}</span> ${v.label}</div>
                <div class="vital-val">${v.value}</div>
                <div class="vital-unit">${v.unit}</div>
                <button class="vital-del" data-key="${v.key}"><span class="material-icons" style="font-size:16px;">close</span></button>
            </div>
        `).join('');

        list.querySelectorAll('.vital-del').forEach(btn => {
            btn.addEventListener('click', () => removeVital(btn.dataset.key));
        });
    }

    /* ═══════════════ VITALS PERSISTENCE ═══════════════ */
    function getVitalsStorageKey() {
        return `ocr_vitals_${currentEncId || 'draft'}_${selectedPatient?.id || 'unknown'}`;
    }
    function saveVitalsToStorage() {
        try { localStorage.setItem(getVitalsStorageKey(), JSON.stringify(currentVitals)); } catch (e) { }
    }
    function loadVitalsFromStorage() {
        try {
            const data = localStorage.getItem(getVitalsStorageKey());
            return data ? JSON.parse(data) : [];
        } catch (e) { return []; }
    }

    /* ═══════════════ STEP 4: FINALIZE ═══════════════ */
    const finalizeBtn = document.getElementById('finalize-btn-new');
    finalizeBtn.addEventListener('click', () => {
        finalizeBtn.disabled = true;
        finalizeBtn.innerHTML = '<span class="material-icons" style="font-size:16px;animation:spin 1s linear infinite;">sync</span> SAVING...';

        setTimeout(() => {
            // Generate proper encounter ID
            const year = new Date().getFullYear();
            const existingEncs = JSON.parse(localStorage.getItem('ocr_encounters') || '[]');
            const nextNum = (existingEncs.length + 1).toString().padStart(3, '0');
            const encId = `ENC-${year}-${nextNum}`;
            currentEncId = encId;

            // Save encounter to localStorage
            const encounter = {
                id: encId,
                patient_name: selectedPatient?.name || '—',
                type: 'Prescription OCR',
                status: 'Completed',
                time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                vitals: currentVitals,
                patient_id: selectedPatient?.id || null,
            };
            existingEncs.push(encounter);
            localStorage.setItem('ocr_encounters', JSON.stringify(existingEncs));

            // Display success
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
        currentVitals = [];
        pendingVitalType = null;
        finalizeBtn.disabled = false;
        finalizeBtn.innerHTML = 'Save & Send <span class="material-icons" style="font-size:16px;">send</span>';
    }

    /* Zoom controls are now in the compare overlay — see COMPARE OVERLAY section above */

}
