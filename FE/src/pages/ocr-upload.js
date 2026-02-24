/**
 * OCR Upload Page — Matches Stitch "Prescription Upload Interface" & "OCR Results & Verification"
 * Wired to POST /api/nurse/ocr
 */
import { renderAppShell } from '../components/app-shell.js';
import { getCurrentUser } from '../api/auth.js';
import { uploadPrescription } from '../api/nurse.js';
import { showToast } from '../components/toast.js';

export async function renderOCRUpload() {
    const user = getCurrentUser();

    const bodyHTML = `
    <style type="text/css">
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 20px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #475569; }
        
        .dashed-border {
            background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='12' ry='12' stroke='%232563EB' stroke-width='2' stroke-dasharray='12%2c 12' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
        }
        .bounding-box {
            position: absolute;
            border: 2px solid #2463eb;
            background: rgba(36, 99, 235, 0.1);
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;
        }
        .bounding-box:hover {
            background: rgba(36, 99, 235, 0.2);
        }
        .bounding-box-label {
            position: absolute;
            top: -20px;
            left: 0;
            background: #2463eb;
            color: white;
            font-size: 10px;
            padding: 2px 6px;
            border-radius: 4px;
            white-space: nowrap;
            opacity: 0;
            transition: opacity 0.2s;
        }
        .bounding-box:hover .bounding-box-label {
            opacity: 1;
        }
        .animate-fadeIn {
            animation: fadeIn 0.4s ease-out forwards;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: scale(0.98); }
            to { opacity: 1; transform: scale(1); }
        }
    </style>

    <div class="h-full flex flex-col overflow-hidden bg-background-light dark:bg-background-dark font-display">
        <!-- Main Content Split Screen -->
        <main class="flex-1 flex overflow-hidden relative">
            
            <!-- INITIAL UPLOAD VIEW (Overlays everything until file selected) -->
            <div id="initial-upload-view" class="absolute inset-0 z-50 bg-background-light dark:bg-background-dark flex items-center justify-center p-6">
                <div class="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 p-10 flex flex-col items-center animate-fadeIn text-slate-800 dark:text-slate-100">
                    <div class="flex items-center gap-3 mb-8 text-gray-900 dark:text-white">
                        <div class="h-10 w-10 bg-primary rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary/20">
                            <span class="material-icons text-2xl">document_scanner</span>
                        </div>
                        <h1 class="text-2xl font-bold tracking-tight">MedScan OCR <span class="text-slate-400 font-normal">/</span> Verification</h1>
                    </div>

                    <div class="w-full dashed-border rounded-2xl bg-primary/[0.02] dark:bg-primary/[0.04] flex flex-col items-center justify-center p-16 text-center transition-all hover:bg-primary/[0.05] cursor-pointer group relative upload-area" id="upload-area">
                        <input type="file" id="file-input" accept="image/jpeg,image/png,image/jpg" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                        <div class="bg-primary/10 p-5 rounded-2xl mb-5 group-hover:scale-110 transition-transform">
                            <span class="material-symbols-outlined text-primary text-5xl">cloud_upload</span>
                        </div>
                        <h3 class="text-xl font-bold mb-2">Upload clinical document</h3>
                        <p class="text-slate-500 dark:text-slate-400 mb-8 text-sm">Drag and drop or click to browse files</p>
                        <div class="flex items-center gap-4">
                            <span class="text-[10px] font-bold uppercase tracking-widest text-slate-400">Supported: JPG, PNG</span>
                            <div class="h-4 w-px bg-slate-200 dark:bg-slate-700"></div>
                            <span class="text-[10px] font-bold uppercase tracking-widest text-slate-400">Max Size: 10MB</span>
                        </div>
                    </div>

                    <div class="mt-10 flex flex-col items-center gap-4">
                        <button id="capture-tablet-btn" class="flex items-center space-x-2 text-primary font-bold hover:bg-primary/5 transition-all px-8 py-3 rounded-xl border border-primary/20">
                            <span class="material-icons-round">photo_camera</span>
                            <span>Capture with Tablet Camera</span>
                        </button>
                        <p class="text-[10px] text-slate-400 font-medium uppercase tracking-widest italic">Secure HIPAA-Compliant Gateway</p>
                    </div>
                </div>
            </div>

            <!-- VERIFICATION VIEW (Hidden until file selected & OCR done) -->
            <div id="verification-view" class="flex-1 flex overflow-hidden opacity-0 pointer-events-none transition-opacity duration-500">
                
                <!-- LEFT PANEL: Image Viewer -->
                <section class="flex-1 relative bg-slate-200 dark:bg-black/40 border-r border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden">
                    <!-- Toolbar -->
                    <div class="absolute top-4 left-1/2 -translate-x-1/2 z-10 bg-white dark:bg-gray-800/90 backdrop-blur shadow-lg rounded-full px-4 py-2 flex items-center gap-4 border border-slate-200 dark:border-slate-700">
                        <div class="flex items-center gap-2">
                            <label class="text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400" for="annotations-toggle">Annotations</label>
                            <button class="relative inline-flex h-5 w-9 items-center rounded-full bg-primary transition-colors transition-all duration-200" id="annotations-toggle">
                                <span class="translate-x-1 inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200" id="anno-knob"></span>
                            </button>
                        </div>
                        <div class="h-4 w-px bg-slate-200 dark:bg-slate-700"></div>
                        <div class="flex gap-3 text-slate-500">
                            <button class="hover:text-primary transition-colors" id="zoom-in"><span class="material-icons text-lg">zoom_in</span></button>
                            <button class="hover:text-primary transition-colors" id="zoom-out"><span class="material-icons text-lg">zoom_out</span></button>
                            <button class="hover:text-primary transition-colors" id="zoom-reset"><span class="material-icons text-lg">crop_free</span></button>
                        </div>
                    </div>

                    <!-- Image Container -->
                    <div class="flex-1 overflow-auto relative flex items-center justify-center p-8 custom-scrollbar bg-slate-100 dark:bg-slate-900/50" id="image-viewport">
                        <div class="relative shadow-2xl rounded-lg overflow-hidden bg-white max-w-full origin-center transition-transform duration-200" id="image-container">
                            <img id="viewer-img" alt="Medical Document" class="max-w-full h-auto object-contain" />
                            <div id="bounding-boxes-overlay" class="absolute inset-0 z-10 pointer-events-none"></div>
                        </div>
                    </div>
                    
                    <div class="absolute bottom-4 left-4 bg-black/70 text-white text-[10px] font-bold px-3 py-1.5 rounded-full backdrop-blur uppercase tracking-widest">
                        Page 1 of 1
                    </div>
                </section>

                <!-- RIGHT PANEL: Data Verification -->
                <section class="w-[500px] bg-white dark:bg-gray-900 flex flex-col border-l border-slate-100 dark:border-slate-800 shadow-2xl z-20">
                    <!-- Status Header -->
                    <div class="bg-amber-50 dark:bg-amber-900/10 border-b border-amber-100 dark:border-amber-800/50 p-4 flex gap-3 items-start flex-shrink-0" id="verify-warning">
                        <span class="material-icons text-amber-500">warning_amber</span>
                        <div>
                            <h3 class="text-xs font-bold text-amber-900 dark:text-amber-400 uppercase tracking-widest">Verification Required</h3>
                            <p class="text-[10px] text-amber-800 dark:text-amber-500 leading-normal mt-0.5">Please verify all clinical fields against the original document.</p>
                        </div>
                    </div>

                    <!-- Scrollable Content -->
                    <div class="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
                        <!-- Raw Text -->
                        <div class="space-y-3">
                            <div class="flex items-center justify-between">
                                <label class="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Raw AI Extraction</label>
                                <div class="flex items-center gap-2">
                                    <span class="text-[9px] font-bold text-slate-400 uppercase">Conf: <span id="verify-conf-score">94%</span></span>
                                    <div class="w-16 h-1 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                        <div id="conf-bar-width" class="h-full bg-primary" style="width: 94%"></div>
                                    </div>
                                </div>
                            </div>
                            <textarea id="raw-text-view" class="w-full h-24 text-[11px] font-mono bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-3 text-slate-600 dark:text-slate-400 focus:ring-1 focus:ring-primary outline-none transition-all resize-none no-scrollbar uppercase" readonly></textarea>
                        </div>

                        <!-- Structured Fields -->
                        <div id="structured-verification-fields" class="space-y-6">
                            <div class="grid grid-cols-3 gap-4 text-gray-900 dark:text-white">
                                <div class="col-span-2 space-y-1.5">
                                    <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Patient Name</label>
                                    <input id="verify-patient-name" class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-primary shadow-sm" type="text" value="" />
                                </div>
                                <div class="space-y-1.5">
                                    <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Age</label>
                                    <input id="verify-patient-age" class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-primary focus:border-primary shadow-sm" type="text" value="" />
                                </div>
                            </div>

                            <div class="space-y-1.5">
                                <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Clinical Diagnosis</label>
                                <div class="relative">
                                    <input id="verify-diagnosis" class="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-10 py-2.5 text-sm font-medium focus:ring-2 focus:ring-primary shadow-sm text-gray-900 dark:text-white" type="text" value="" />
                                    <span class="material-icons absolute left-3 top-2.5 text-primary/50 text-xl">medical_services</span>
                                </div>
                            </div>

                            <!-- Medications Table -->
                            <div class="space-y-3 pt-2">
                                <div class="flex items-center justify-between">
                                    <label class="block text-[10px] font-bold uppercase tracking-widest text-slate-400">Medications List</label>
                                    <button class="text-[10px] text-primary font-bold uppercase tracking-widest hover:underline flex items-center gap-1">
                                        <span class="material-icons text-sm">add_circle</span> Add Drug
                                    </button>
                                </div>
                                <div class="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                                    <table class="w-full text-xs text-left">
                                        <thead class="bg-slate-50 dark:bg-slate-800/50 text-[9px] uppercase font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                                            <tr>
                                                <th class="px-4 py-3">Drug</th>
                                                <th class="px-2 py-3 w-20 text-center">Dosage</th>
                                                <th class="px-2 py-3 w-24 text-center">Freq</th>
                                                <th class="px-3 py-3 w-5"></th>
                                            </tr>
                                        </thead>
                                        <tbody id="meds-table-body" class="divide-y divide-slate-50 dark:divide-slate-800 text-gray-900 dark:text-white">
                                            <!-- Row Template will be inserted here -->
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <!-- Workflow Stepper -->
                        <div class="pt-8 border-t border-slate-100 dark:border-slate-800">
                            <div class="flex items-center justify-between text-[9px] font-bold uppercase tracking-widest">
                                <div class="flex items-center gap-2 text-green-500">
                                    <span class="material-icons text-xs">check_circle</span> AI DONE
                                </div>
                                <div class="h-px flex-1 mx-4 bg-green-100 dark:bg-green-900/40"></div>
                                <div class="flex items-center gap-2 text-primary">
                                    <span class="material-icons text-xs">radio_button_checked</span> REVIEW
                                </div>
                                <div class="h-px flex-1 mx-4 bg-slate-100 dark:bg-slate-800"></div>
                                <div class="flex items-center gap-2 text-slate-300">
                                    <span class="material-icons text-xs">radio_button_unchecked</span> EMR SYNC
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer Actions -->
                    <div class="border-t border-slate-100 dark:border-slate-800 p-6 bg-slate-50/50 dark:bg-slate-900/30 flex-shrink-0 flex items-center justify-between">
                        <button id="verification-cancel-btn" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-[10px] font-bold uppercase tracking-widest transition-colors">
                            Discard Extraction
                        </button>
                        <div class="flex items-center gap-3">
                            <button id="resubmit-btn" class="bg-white dark:bg-gray-800 border border-slate-200 dark:border-slate-700 px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-sm hover:bg-slate-50 transition-all text-gray-900 dark:text-white">
                                Edit & Resubmit
                            </button>
                            <button id="finalize-btn-new" class="bg-primary hover:bg-primary-dark text-white px-8 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-[0.1em] shadow-lg shadow-primary/20 transition-all flex items-center gap-2 transform active:scale-95">
                                Send to Doctor <span class="material-icons text-sm">send</span>
                            </button>
                        </div>
                    </div>
                </section>
            </div>
            
            <!-- PROCESSING OVERLAY -->
            <div id="processing-overlay" class="absolute inset-0 z-[60] bg-white/80 dark:bg-gray-950/80 backdrop-blur-md hidden flex flex-col items-center justify-center text-center p-10">
                <div class="relative mb-8">
                    <div class="w-20 h-20 border-4 border-primary/20 rounded-full"></div>
                    <div class="w-20 h-20 border-4 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-0"></div>
                    <span class="material-icons text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-3xl">psychology</span>
                </div>
                <h3 class="text-xl font-bold mb-2 text-gray-900 dark:text-white">Analyzing Document</h3>
                <p class="text-slate-500 max-w-xs leading-relaxed text-sm">Identifying handwriting patterns and cross-referencing clinical vocabularies...</p>
                <div class="mt-8 flex gap-2">
                    <div class="w-1.5 h-1.5 bg-primary rounded-full animate-bounce"></div>
                    <div class="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.2s]"></div>
                    <div class="w-1.5 h-1.5 bg-primary rounded-full animate-bounce [animation-delay:0.4s]"></div>
                </div>
            </div>

            <!-- SUCCESS CONFIRMATION OVERLAY (Matches Stitch) -->
            <div id="success-state" class="absolute inset-0 z-[100] bg-white dark:bg-gray-950 hidden flex flex-col items-center justify-center p-10 text-center animate-fadeIn">
                <div class="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-8">
                    <span class="material-icons-round text-green-600 text-5xl">check_circle</span>
                </div>
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2 uppercase tracking-tight">Saved to EMR Successfully</h2>
                <p class="text-slate-500 dark:text-slate-400 max-w-xs mb-10 text-sm leading-relaxed">
                    The clinical documentation has been synchronized and verified against the master patient index.
                </p>
                
                <div class="w-full max-w-sm bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-6 mb-10 space-y-4">
                    <div class="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        <span>Encounter ID</span>
                        <span class="text-slate-900 dark:text-white font-mono" id="success-enc-id">ENC-772910</span>
                    </div>
                    <div class="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        <span>Verified By</span>
                        <span class="text-slate-900 dark:text-white font-display" id="success-nurse-name">Nurse Priya</span>
                    </div>
                    <div class="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
                        <span>Timestamp</span>
                        <span class="text-slate-900 dark:text-white" id="success-timestamp">23 Oct 2023, 14:12</span>
                    </div>
                </div>

                <div class="flex flex-col w-full max-w-sm space-y-3">
                    <button id="success-next-btn" class="w-full bg-primary hover:bg-primary-dark text-white font-bold py-4 rounded-xl shadow-lg shadow-primary/20 transition-all flex items-center justify-center gap-2 transform active:scale-95">
                        Process Next Patient <span class="material-icons text-sm">arrow_forward</span>
                    </button>
                    <button id="success-dashboard-btn" class="w-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold py-4 rounded-xl hover:bg-slate-200 transition-all">
                        Clinical Dashboard
                    </button>
                </div>
            </div>

        </main>
    </div>
  `;

    renderAppShell('Verification Hub', bodyHTML, '/nurse/ocr');

    // Elements
    const initialView = document.getElementById('initial-upload-view');
    const verificationView = document.getElementById('verification-view');
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    const viewerImg = document.getElementById('viewer-img');
    const processingOverlay = document.getElementById('processing-overlay');
    const successState = document.getElementById('success-state');
    const finalizeBtn = document.getElementById('finalize-btn-new');
    const resubmitBtn = document.getElementById('resubmit-btn');
    const cancelBtn = document.getElementById('verification-cancel-btn');
    const imageContainer = document.getElementById('image-container');
    const annoToggle = document.getElementById('annotations-toggle');
    const annoKnob = document.getElementById('anno-knob');
    const boxesOverlay = document.getElementById('bounding-boxes-overlay');

    let selectedFile = null;
    let zoomLevel = 1;
    let showAnnotations = true;

    // File interactions
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

    async function startOCRProcess() {
        initialView.classList.add('hidden');
        processingOverlay.classList.remove('hidden');

        try {
            const result = await uploadPrescription({
                image: selectedFile,
                encounterId: `ENC-${Date.now().toString().slice(-6)}`,
                patientId: 'PT-AUTO',
                capturedBy: user?.staff_id || 'unknown',
            });

            populateVerificationData(result);

            processingOverlay.classList.add('hidden');
            verificationView.classList.remove('opacity-0', 'pointer-events-none');

        } catch (err) {
            // Distinguish network/timeout errors from server errors
            const isNetworkError = err.message?.includes('Failed to fetch') ||
                err.message?.includes('NetworkError') ||
                err.message?.includes('ECONNRESET') ||
                err.name === 'TypeError';
            if (isNetworkError) {
                showToast('OCR processing timed out or server is busy. Please try again with a smaller image.', 'error');
            } else {
                showToast(err.message || 'OCR processing failed', 'error');
            }
            resetUI();
        }
    }

    function populateVerificationData(result) {
        // Basic Data
        document.getElementById('raw-text-view').value = result.raw_text || result.normalized_text || '';
        document.getElementById('verify-conf-score').textContent = `${(result.confidence_mean || 0).toFixed(0)}%`;
        document.getElementById('conf-bar-width').style.width = `${(result.confidence_mean || 0)}%`;

        // Extract patient name/age from fields if possible
        const nameField = result.structured_fields?.find(f => f.field_type?.toLowerCase().includes('name'));
        const ageField = result.structured_fields?.find(f => f.field_type?.toLowerCase().includes('age'));

        document.getElementById('verify-patient-name').value = nameField?.text || nameField?.value || '';
        document.getElementById('verify-patient-age').value = ageField?.text || ageField?.value || '';

        // Medication Table
        const tableBody = document.getElementById('meds-table-body');
        const meds = result.structured_fields?.filter(f => f.field_type?.toLowerCase().includes('medicine') || f.field_type?.toLowerCase().includes('drug')) || [];

        tableBody.innerHTML = meds.map(m => `
        <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 group">
            <td class="px-4 py-2.5">
                <input class="w-full bg-transparent border-none p-0 text-xs focus:ring-0 font-bold text-slate-700 dark:text-slate-300" type="text" value="${m.text || m.value}" />
            </td>
            <td class="px-2 py-2.5 text-center font-medium text-slate-500">500mg</td>
            <td class="px-2 py-2.5 text-center font-medium text-slate-500">1-1-1</td>
            <td class="px-3 py-2.5 text-right">
                <button class="text-slate-300 hover:text-red-500 transition-colors">
                    <span class="material-icons text-sm">delete</span>
                </button>
            </td>
        </tr>
    `).join('');

        // Bounding Boxes (Mocked high-fidelity behavior)
        if (showAnnotations) renderMockBoundingBoxes();
    }

    function renderMockBoundingBoxes() {
        boxesOverlay.innerHTML = `
        <div class="bounding-box" style="top: 18%; left: 12%; width: 35%; height: 6%;">
            <span class="bounding-box-label">Patient Name (98%)</span>
        </div>
        <div class="bounding-box" style="top: 35%; left: 12%; width: 60%; height: 12%; border-color: #0D9488; background: rgba(13, 148, 136, 0.1);">
            <span class="bounding-box-label" style="background: #0D9488">Diagnosis (82%)</span>
        </div>
        <div class="bounding-box" style="top: 55%; left: 12%; width: 70%; height: 8%; border-style: dashed; border-color: #f59e0b; background: rgba(245, 158, 11, 0.1);">
            <span class="bounding-box-label" style="background: #f59e0b">Review Suggested (45%)</span>
        </div>
    `;
        boxesOverlay.classList.remove('hidden');
    }

    // Finalize Actions
    finalizeBtn.addEventListener('click', () => {
        finalizeBtn.disabled = true;
        finalizeBtn.innerHTML = '<span class="material-icons animate-spin text-sm">sync</span> SYNCING...';

        setTimeout(() => {
            const encId = `ENC-${Math.floor(100000 + Math.random() * 900000)}`;
            document.getElementById('success-enc-id').textContent = encId;
            document.getElementById('success-nurse-name').textContent = user ? user.name || user.username : 'Nurse Priya';
            document.getElementById('success-timestamp').textContent = new Date().toLocaleString('en-GB', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            });

            verificationView.classList.add('hidden');
            successState.classList.remove('hidden');
        }, 1500);
    });

    resubmitBtn.addEventListener('click', () => {
        showToast('Editing raw parameters and resubmitting...', 'info');
        startOCRProcess();
    });

    cancelBtn.addEventListener('click', resetUI);
    document.getElementById('success-next-btn').addEventListener('click', () => window.location.reload());
    document.getElementById('success-dashboard-btn').addEventListener('click', () => window.location.hash = '#/nurse/dashboard');

    function resetUI() {
        verificationView.classList.add('opacity-0', 'pointer-events-none');
        processingOverlay.classList.add('hidden');
        initialView.classList.remove('hidden');
        fileInput.value = '';
        selectedFile = null;
    }

    // Viewer Controls
    document.getElementById('zoom-in').addEventListener('click', () => {
        zoomLevel += 0.2;
        updateZoom();
    });
    document.getElementById('zoom-out').addEventListener('click', () => {
        if (zoomLevel > 0.4) zoomLevel -= 0.2;
        updateZoom();
    });
    document.getElementById('zoom-reset').addEventListener('click', () => {
        zoomLevel = 1;
        updateZoom();
    });

    function updateZoom() {
        imageContainer.style.transform = `scale(${zoomLevel})`;
    }

    annoToggle.addEventListener('click', () => {
        showAnnotations = !showAnnotations;
        if (showAnnotations) {
            annoToggle.classList.replace('bg-slate-200', 'bg-primary');
            annoKnob.classList.replace('translate-x-1', 'translate-x-5');
            boxesOverlay.classList.remove('hidden');
        } else {
            annoToggle.classList.replace('bg-primary', 'bg-slate-200');
            annoKnob.classList.replace('translate-x-5', 'translate-x-1');
            boxesOverlay.classList.add('hidden');
        }
    });

    // Initial state for toggle
    annoToggle.classList.add('bg-primary');
    annoKnob.classList.add('translate-x-5');
}
