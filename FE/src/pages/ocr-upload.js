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
    <style type="text/css">
        .no-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .no-scrollbar {
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
        }
        .dashed-border {
            background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='12' ry='12' stroke='%232563EB' stroke-width='2' stroke-dasharray='12%2c 12' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
        }
        .blur-preview {
            filter: blur(8px);
        }
        .upload-area.dragover {
            background-color: rgba(37, 99, 235, 0.1);
            transform: scale(1.01);
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-dropdown {
            animation: fadeIn 0.2s ease-out forwards;
        }
    </style>

    <div class="h-full flex flex-col p-2 md:p-3 overflow-hidden">
        <div class="w-full max-w-7xl mx-auto bg-white dark:bg-gray-900 rounded-xl shadow-xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col md:flex-row flex-1 min-h-0">
        <!-- Left: Upload Section -->
        <section class="flex-1 p-6 md:p-8 lg:p-10 flex flex-col border-b md:border-b-0 md:border-r border-gray-200 dark:border-gray-800 overflow-hidden">
            <div class="flex justify-between items-start mb-6 shrink-0">
                <div>
                    <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Upload Prescription</h1>
                    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Ensure all details are legible for OCR processing</p>
                </div>
                <div class="relative">
                    <button id="language-btn" class="flex items-center space-x-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 transition-all shadow-sm outline-none cursor-pointer min-w-[150px] justify-between h-[42px]">
                        <span class="flex items-center gap-2">
                            <span id="current-lang-text">🇬🇧 English (Auto)</span>
                        </span>
                        <span class="material-icons text-gray-400 text-[18px]">expand_more</span>
                    </button>
                    <div id="language-dropdown" class="hidden absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden animate-dropdown">
                        <button class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-primary/5 transition-all flex items-center justify-between lang-opt" data-value="auto">
                            <span>🇬🇧 English (Auto)</span>
                            <span class="material-icons text-primary text-[18px] opacity-0 check-icon">check</span>
                        </button>
                        <button class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-primary/5 transition-all flex items-center justify-between lang-opt" data-value="ta">
                            <span>🇮🇳 Tamil</span>
                            <span class="material-icons text-primary text-[18px] opacity-0 check-icon">check</span>
                        </button>
                        <button class="w-full text-left px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-primary/5 transition-all flex items-center justify-between lang-opt" data-value="hi">
                            <span>🇮🇳 Hindi</span>
                            <span class="material-icons text-primary text-[18px] opacity-0 check-icon">check</span>
                        </button>
                    </div>
                    <input type="hidden" id="language-hint" value="auto" />
                </div>
            </div>

            <div class="flex-1 flex flex-col">
                <div class="dashed-border rounded-2xl bg-primary/[0.03] dark:bg-primary/[0.05] flex-1 min-h-[320px] flex flex-col items-center justify-center p-10 text-center transition-all hover:bg-primary/[0.06] dark:hover:bg-primary/[0.08] cursor-pointer group relative upload-area" id="upload-area">
                    <input type="file" id="file-input" accept="image/jpeg,image/png,image/jpg" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer" aria-label="Upload prescription file" />
                    <div class="bg-primary/10 dark:bg-primary/20 p-4 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                        <span class="material-symbols-outlined text-primary text-4xl">cloud_upload</span>
                    </div>
                    <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Drag prescription image here</h3>
                    <p class="text-gray-500 dark:text-gray-400 text-base mb-8">or click to browse your local directory</p>
                    <div class="inline-flex items-center px-4 py-1.5 rounded-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-500 dark:text-gray-400 shadow-sm">
                        JPG, PNG (max 10MB)
                    </div>
                </div>
                <div class="mt-8 flex justify-center">
                    <button class="flex items-center space-x-2 text-primary dark:text-blue-400 hover:bg-primary/5 dark:hover:bg-blue-900/20 font-semibold transition-all px-6 py-2.5 rounded-xl border border-primary/20">
                        <span class="material-icons-round">photo_camera</span>
                        <span>Capture with Tablet Camera</span>
                    </button>
                </div>
            </div>
        </section>

        <!-- Right: Preview Section -->
        <section class="w-full md:w-[350px] lg:w-[400px] bg-gray-50 dark:bg-gray-800/30 p-6 md:p-8 flex flex-col border-l border-gray-200 dark:border-gray-800 overflow-hidden">
            <h2 class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-6 shrink-0">File Preview</h2>
            
            <div id="no-preview" class="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl mb-6 bg-white/50 dark:bg-gray-900/50">
                <span class="material-symbols-outlined text-gray-300 dark:text-gray-700 text-6xl">image_not_supported</span>
                <p class="text-xs text-gray-400 mt-2">No file selected</p>
            </div>

            <div id="file-preview" class="flex-1 flex flex-col relative group hidden">
                <div class="relative w-full aspect-[3/4] bg-white dark:bg-gray-950 rounded-xl shadow-md border border-gray-200 dark:border-gray-800 overflow-hidden mb-6">
                    <img id="preview-img" alt="Prescription preview" class="w-full h-full object-cover blur-preview opacity-90" />
                    <div class="absolute bottom-6 left-0 right-0 flex justify-center space-x-4 opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0">
                        <button class="bg-gray-900/90 hover:bg-black text-white p-2.5 rounded-xl backdrop-blur-md transition-all hover:scale-110 shadow-lg" title="Rotate Left">
                            <span class="material-icons-round text-base">rotate_left</span>
                        </button>
                        <button class="bg-gray-900/90 hover:bg-black text-white p-2.5 rounded-xl backdrop-blur-md transition-all hover:scale-110 shadow-lg" title="Crop Image">
                            <span class="material-icons-round text-base">crop</span>
                        </button>
                        <button class="bg-gray-900/90 hover:bg-black text-white p-2.5 rounded-xl backdrop-blur-md transition-all hover:scale-110 shadow-lg" title="Rotate Right">
                            <span class="material-icons-round text-base">rotate_right</span>
                        </button>
                    </div>
                    <div class="absolute top-4 right-4 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 flex items-center shadow-lg">
                        <span class="material-icons-round text-[14px] mr-1.5 text-primary">lock</span>
                        HIPAA SECURE
                    </div>
                </div>

                <div class="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700 flex items-center justify-between mb-8 shadow-sm">
                    <div class="flex items-center space-x-4 overflow-hidden">
                        <div id="file-ext-icon" class="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-xs shrink-0">
                            IMG
                        </div>
                        <div class="min-w-0">
                            <p id="file-name" class="text-sm font-semibold text-gray-900 dark:text-white truncate leading-snug">filename.jpg</p>
                            <p id="file-size" class="text-xs text-gray-500 dark:text-gray-400">0.0 MB • Ready</p>
                        </div>
                    </div>
                    <button id="remove-file-btn" class="text-gray-400 hover:text-red-500 transition-colors p-1">
                        <span class="material-icons-round">delete_outline</span>
                    </button>
                </div>
            </div>

            <div class="mt-auto space-y-5">
                <div id="warning-msg" class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 hidden items-start gap-3">
                    <span class="material-icons-round text-amber-500 text-xl mt-0.5 shrink-0">warning_amber</span>
                    <p class="text-xs text-amber-900 dark:text-amber-200 leading-normal font-medium">
                        <strong>Review Required:</strong> Tamil prescriptions require manual doctor verification before pharmacy routing.
                    </p>
                </div>
                
                <button id="ocr-btn" class="w-full bg-primary hover:bg-primary-hover disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center space-x-3 transition-all shadow-lg shadow-primary/20 active:scale-[0.98]" disabled>
                    <span class="material-symbols-outlined font-normal" id="ocr-btn-icon">verified</span>
                    <span id="ocr-btn-text">Process Prescription</span>
                    <span id="ocr-spinner" class="spinner" style="display:none; width:20px; height:20px; border-width:2px;"></span>
                </button>
                
                <p class="text-center text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-tighter">
                    Encrypted End-to-End Processing
                </p>
            </div>
        </section>
    </div>

    </div>

    <!-- Results Modal/Overlay (Responsive) -->
    <div id="ocr-results" class="fixed inset-0 z-[3000] bg-black/50 backdrop-blur-sm hidden items-center justify-center p-4">
        <div class="w-full max-w-4xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div class="p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center shrink-0">
                <h3 class="text-lg font-bold flex items-center">
                    <span class="material-icons-outlined text-green-500 mr-2">check_circle</span>
                    Extracted Prescription Data
                </h3>
                <button onclick="document.getElementById('ocr-results').classList.add('hidden')" class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors">
                    <span class="material-icons-outlined">close</span>
                </button>
            </div>
            
            <div class="p-6 overflow-y-auto flex-1">
                <div id="result-alert"></div>
                <div id="result-badge" class="badge mb-4 hidden"></div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                        <div class="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Confidence Score</div>
                        <div class="text-xl font-bold text-primary" id="result-confidence">-</div>
                    </div>
                    <div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                        <div class="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Detected Language</div>
                        <div class="text-xl font-bold" id="result-language">-</div>
                    </div>
                    <div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-100 dark:border-gray-700">
                        <div class="text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-1">Processing Delay</div>
                        <div class="text-xl font-bold" id="result-time">-</div>
                    </div>
                </div>

                <div class="mb-6">
                    <label class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block">Raw Text Extraction</label>
                    <textarea id="result-text" class="w-full h-32 p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-mono outline-none resize-none" readonly></textarea>
                </div>

                <div id="result-fields"></div>
                
                <div id="result-safety-flags-container" class="mt-6">
                    <label class="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 block text-red-500">Safety Indicators</label>
                    <div id="result-safety-flags" class="flex flex-wrap gap-2"></div>
                </div>
            </div>

            <div class="p-4 md:p-6 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/50 flex justify-end shrink-0">
                <button onclick="location.hash='#/nurse/ocr-results'" class="btn btn-primary px-8 btn-lg">Verify & Archive</button>
            </div>
        </div>
    </div>
  `;

  renderAppShell('Prescription OCR', bodyHTML, '/nurse/ocr');

  // Elements
  const uploadArea = document.getElementById('upload-area');
  const fileInput = document.getElementById('file-input');
  const noPreview = document.getElementById('no-preview');
  const previewDiv = document.getElementById('file-preview');
  const previewImg = document.getElementById('preview-img');
  const fileName = document.getElementById('file-name');
  const fileSize = document.getElementById('file-size');
  const fileExtIcon = document.getElementById('file-ext-icon');
  const ocrBtn = document.getElementById('ocr-btn');
  const ocrBtnText = document.getElementById('ocr-btn-text');
  const ocrSpinner = document.getElementById('ocr-spinner');
  const ocrBtnIcon = document.getElementById('ocr-btn-icon');
  const removeBtn = document.getElementById('remove-file-btn');
  const warningMsg = document.getElementById('warning-msg');
  const langHiddenInput = document.getElementById('language-hint');

  let selectedFile = null;

  // File interactions
  uploadArea.addEventListener('click', (e) => {
    if (e.target !== fileInput) fileInput.click();
  });

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
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length) handleFile(e.target.files[0]);
  });

  removeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    selectedFile = null;
    fileInput.value = '';
    previewDiv.classList.add('hidden');
    noPreview.classList.remove('hidden');
    ocrBtn.disabled = true;
    warningMsg.classList.add('hidden');
    document.getElementById('ocr-results').classList.add('hidden');
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
    noPreview.classList.add('hidden');
    previewDiv.classList.remove('hidden');

    // Set preview image
    previewImg.src = URL.createObjectURL(file);

    // Set info
    fileName.textContent = file.name;
    fileSize.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB • Ready`;

    const ext = file.name.split('.').pop().toUpperCase();
    fileExtIcon.textContent = ext;

    ocrBtn.disabled = false;

    // Show warning if Tamil is selected or likely
    checkLanguageWarning();
  }

  // Custom Dropdown Logic
  const langBtn = document.getElementById('language-btn');
  const langDropdown = document.getElementById('language-dropdown');
  const currentLangText = document.getElementById('current-lang-text');

  // Set default check
  langDropdown.querySelector('.lang-opt[data-value="auto"] .check-icon').classList.remove('opacity-0');

  langBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    langDropdown.classList.toggle('hidden');
    if (!langDropdown.classList.contains('hidden')) {
      langBtn.classList.add('ring-2', 'ring-primary/20', 'border-primary');
    } else {
      langBtn.classList.remove('ring-2', 'ring-primary/20', 'border-primary');
    }
  });

  document.querySelectorAll('.lang-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const val = opt.getAttribute('data-value');
      const label = opt.querySelector('span').textContent.trim();

      langHiddenInput.value = val;
      currentLangText.textContent = label;

      // Update checks
      document.querySelectorAll('.lang-opt .check-icon').forEach(icon => icon.classList.add('opacity-0'));
      opt.querySelector('.check-icon').classList.remove('opacity-0');

      langDropdown.classList.add('hidden');
      langBtn.classList.remove('ring-2', 'ring-primary/20', 'border-primary');

      checkLanguageWarning();
    });
  });

  window.addEventListener('click', () => {
    langDropdown.classList.add('hidden');
    langBtn.classList.remove('ring-2', 'ring-primary/20', 'border-primary');
  });

  function checkLanguageWarning() {
    if (langHiddenInput.value === 'ta') {
      warningMsg.classList.remove('hidden');
      warningMsg.classList.add('flex');
    } else {
      warningMsg.classList.add('hidden');
      warningMsg.classList.remove('flex');
    }
  }

  // Submit OCR
  ocrBtn.addEventListener('click', async () => {
    if (!selectedFile) return;

    ocrBtn.disabled = true;
    ocrBtnText.textContent = 'Processing...';
    ocrSpinner.style.display = 'inline-block';
    ocrBtnIcon.style.display = 'none';

    try {
      const result = await uploadPrescription({
        image: selectedFile,
        encounterId: `ENC-${Date.now().toString().slice(-6)}`, // Generate temporary IDs if not provided
        patientId: 'PT-AUTO',
        capturedBy: user?.staff_id || 'unknown',
        languageHint: langHiddenInput.value,
      });

      displayResults(result);
      showToast('OCR processing complete!', 'success');

    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      ocrBtn.disabled = false;
      ocrBtnText.textContent = 'Process Prescription';
      ocrSpinner.style.display = 'none';
      ocrBtnIcon.style.display = 'inline-block';
    }
  });

  function displayResults(result) {
    const resultsDiv = document.getElementById('ocr-results');
    resultsDiv.classList.remove('hidden');
    resultsDiv.classList.add('flex');

    // Badge
    const badge = document.getElementById('result-badge');
    if (result.status === 'success') {
      badge.className = 'badge badge-success';
      badge.textContent = 'High Confidence';
    } else if (result.status === 'low_confidence') {
      badge.className = 'badge badge-warning';
      badge.textContent = 'Verify Manually';
    } else {
      badge.className = 'badge badge-error';
      badge.textContent = 'Recognition Error';
    }

    // Alert
    const alertDiv = document.getElementById('result-alert');
    if (result.requires_doctor_review) {
      alertDiv.innerHTML = `
        <div class="mb-6 bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-4">
          <span class="material-icons-outlined text-amber-500">priority_high</span>
          <div>
            <div class="font-bold text-amber-900">Physician Review Required</div>
            <p class="text-sm text-amber-800">The AI identified ambiguous handwriting. This record must be finalized by a presiding doctor.</p>
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
        <label class="text-xs font-bold text-gray-400 upper tracking-widest mb-4 block">Structured Medication Data</label>
        <div class="overflow-x-auto border border-gray-100 dark:border-gray-800 rounded-xl">
          <table class="w-full text-left text-sm">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-4 py-3 font-bold">Category</th>
                <th class="px-4 py-3 font-bold">Detected Value</th>
                <th class="px-4 py-3 font-bold">Conf.</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-50 dark:divide-gray-800">
              ${result.structured_fields.map(f => `
                <tr>
                  <td class="px-4 py-3"><span class="px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-[10px] font-bold uppercase">${f.field_type || f.type || 'Field'}</span></td>
                  <td class="px-4 py-3 font-medium">${f.text || f.value || '-'}</td>
                  <td class="px-4 py-3 text-gray-500">${f.confidence ? f.confidence.toFixed(0) + '%' : '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    } else {
      fieldsDiv.innerHTML = '';
    }

    // Safety flags
    const flagsDiv = document.getElementById('result-safety-flags');
    const flagsContainer = document.getElementById('result-safety-flags-container');
    if (result.safety_flags && result.safety_flags.length > 0) {
      flagsContainer.classList.remove('hidden');
      flagsDiv.innerHTML = result.safety_flags.map(f =>
        `<span class="px-3 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-xs font-bold rounded-lg border border-red-100 dark:border-red-900/50">${f}</span>`
      ).join('');
    } else {
      flagsContainer.classList.add('hidden');
    }

    resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
