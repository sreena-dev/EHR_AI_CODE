/**
 * Intelligent Vitals Entry Page for Nurses
 * Features: Smart Search, Dynamic Form, Safety Alerts, Tamil Support, Tablet Optimized
 */
import { renderAppShell } from '../components/app-shell.js';
import { getCurrentUser } from '../api/auth.js';

// Persistent State for the Vitals Entry workflow
let language = 'EN'; // EN or TA
let activeVital = null; // 'BP', 'Temp', 'SpO2', etc.
let selectedPatient = null; // { id, name, age, gender, previousVitals }
let currentStep = 'SELECT_PATIENT'; // 'SELECT_PATIENT', 'QUICK_REG', 'ENTRY'

export async function renderVitalsEntry() {
  const user = getCurrentUser();

  const vitalsData = {
    'BP': { label: 'Blood Pressure', ta: 'இரத்த அழுத்தம்', icon: 'monitor_heart', color: 'blue' },
    'Temp': { label: 'Temperature', ta: 'வெப்பநிலை', icon: 'thermostat', color: 'orange' },
    'SpO2': { label: 'Oxygen Saturation', ta: 'ஆக்ஸிஜன் அளவீடு', icon: 'opacity', color: 'blue' },
    'Resp': { label: 'Respiratory Rate', ta: 'சுவாச விகிதம்', icon: 'air', color: 'indigo' },
    'HR': { label: 'Heart Rate', ta: 'இதயத் துடிப்பு', icon: 'favorite', color: 'red' },
    'Weight': { label: 'Weight', ta: 'எடை', icon: 'fitness_center', color: 'slate' },
    'Height': { label: 'Height', ta: 'உயரம்', icon: 'straighten', color: 'slate' }
  };

  const getLabel = (key) => language === 'EN' ? vitalsData[key].label : vitalsData[key].ta;

  const renderSelectPatientStep = () => `
    <div class="max-w-2xl mx-auto py-10 px-6">
      <div class="text-center mb-8">
        <h1 class="text-xl font-extrabold text-slate-900 mb-1">Vitals Entry Workflow</h1>
        <p class="text-xs text-slate-500">Search for an existing record or register a new walk-in patient</p>
      </div>

      <div class="space-y-5">
        <!-- Search Existing -->
        <div class="relative group">
          <span class="material-icons absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">person_search</span>
          <input type="text" id="patient-search-input" 
                 class="w-full pl-12 pr-6 py-4 bg-white border-2 border-slate-100 rounded-2xl shadow-sm focus:border-blue-500 focus:ring-4 focus:ring-blue-500/5 transition-all text-base font-medium" 
                 placeholder="Search by Patient Name or PID...">
          
          <div id="patient-search-results" class="hidden absolute top-full left-0 right-0 mt-3 bg-white border border-slate-200 rounded-[2rem] shadow-2xl z-50 py-3 overflow-hidden animate-in fade-in slide-in-from-top-4">
            <!-- Results injected here -->
          </div>
        </div>

        <div class="flex items-center gap-4 py-2">
          <div class="flex-1 h-px bg-slate-100"></div>
          <span class="text-xs font-bold text-slate-300 uppercase tracking-widest">OR</span>
          <div class="flex-1 h-px bg-slate-100"></div>
        </div>

        <!-- Quick Registration -->
        <button id="btn-quick-reg" class="w-full flex items-center justify-between p-6 bg-blue-50 border-2 border-blue-100 rounded-[2rem] hover:bg-blue-100 transition-all group overflow-hidden relative">
          <div class="flex items-center gap-5">
            <div class="w-14 h-14 rounded-2xl bg-white text-blue-600 flex items-center justify-center border border-blue-200/50 shadow-sm">
              <span class="material-icons text-3xl">person_add_alt</span>
            </div>
            <div class="text-left">
              <p class="font-bold text-blue-900 text-lg">New Walk-in Patient</p>
              <p class="text-sm text-blue-700/70 font-medium">Quick 1-step registration for vitals collection</p>
            </div>
          </div>
          <span class="material-icons text-blue-400 group-hover:translate-x-1 transition-transform">arrow_forward</span>
        </button>
      </div>
    </div>
  `;

  const renderQuickRegStep = () => `
    <div class="max-w-xl mx-auto py-12 px-6">
      <button id="back-to-search" class="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase tracking-widest mb-8 hover:text-slate-600 transition-colors">
        <span class="material-icons text-[18px]">arrow_back</span>
        Return to Search
      </button>

      <div class="bg-white rounded-[2rem] p-8 shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-300">
        <div class="mb-5">
          <h2 class="text-lg font-bold text-slate-900 mb-1">Patient Registration</h2>
          <p class="text-[11px] text-slate-400 font-medium">Quick details for vitals capture</p>
        </div>

        <form id="quick-reg-form" class="space-y-4">
          <div class="vital-input-group">
            <label>Full Patient Name</label>
            <input type="text" id="reg-name" class="vital-input text-base py-2.5 px-4 border-2 border-slate-50 focus:bg-white" placeholder="e.g. John Doe" required>
          </div>
          
          <div class="grid grid-cols-2 gap-4">
            <div class="vital-input-group">
              <label>Phone Number</label>
              <input type="tel" id="reg-phone" class="vital-input text-base py-2.5 px-4 border-2 border-slate-50 focus:bg-white" placeholder="10-digit number" required>
            </div>
            <div class="vital-input-group">
              <label>Locality / Area</label>
              <input type="text" id="reg-locality" class="vital-input text-base py-2.5 px-4 border-2 border-slate-50 focus:bg-white" placeholder="e.g. Mandaveli">
            </div>
          </div>

          <div class="grid grid-cols-3 gap-4">
            <div class="vital-input-group">
              <label>Age (Years)</label>
              <input type="number" id="reg-age" class="vital-input text-base py-2.5 px-4 border-2 border-slate-50 focus:bg-white" placeholder="42" required>
            </div>
            <div class="vital-input-group">
              <label>Gender</label>
              <select id="reg-gender" class="vital-input text-base py-2.5 px-4 border-2 border-slate-50 focus:bg-white bg-white h-[52px]" required>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div class="vital-input-group">
              <label>Blood Group</label>
              <select id="reg-blood" class="vital-input text-base py-2.5 px-4 border-2 border-slate-50 focus:bg-white bg-white h-[52px]">
                <option value="">Unknown</option>
                <option value="A+">A+</option>
                <option value="B+">B+</option>
                <option value="O+">O+</option>
                <option value="AB+">AB+</option>
                <option value="A-">A-</option>
                <option value="B-">B-</option>
                <option value="O-">O-</option>
                <option value="AB-">AB-</option>
              </select>
            </div>
          </div>

          <button type="submit" class="w-full py-4 bg-blue-600 text-white rounded-xl font-bold shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all mt-2 uppercase tracking-widest text-sm">
            Register & Collect Vitals
          </button>
        </form>
      </div>
    </div>
  `;

  const renderEntryStep = () => `
    <div class="vitals-container max-w-5xl mx-auto px-6 py-4 space-y-5 animate-in fade-in duration-500">
      <!-- Top Bar: Search & Lang Toggle -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div class="relative flex-1 max-w-xl">
          <div class="relative">
            <span class="material-icons absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]">search</span>
            <input type="text" id="vitals-smart-search" 
                   class="w-full pl-10 pr-10 py-2.5 bg-white border border-slate-200 rounded-lg shadow-sm focus:border-[#2463eb] focus:ring-4 focus:ring-[#2463eb]/5 transition-all text-xs font-medium" 
                   placeholder="Search vital sign (e.g., 'BP', 'Blood Pressure')">
            <button class="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-50 rounded-lg text-slate-400 hover:text-[#2463eb] transition-colors">
              <span class="material-icons text-[18px]">mic</span>
            </button>
          </div>
          <div id="search-suggestions" class="hidden absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1 overflow-hidden"></div>
        </div>

        <div class="flex items-center bg-slate-100/60 p-0.5 rounded-lg self-start">
          <button id="lang-en" class="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${language === 'EN' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/50' : 'text-slate-500'}">EN</button>
          <button id="lang-ta" class="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${language === 'TA' ? 'bg-white shadow-sm text-slate-900 border border-slate-200/50' : 'text-slate-500'}">Tamil</button>
        </div>
      </div>

      <!-- Patient Context Bar -->
      <div class="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 relative group overflow-hidden">
        <div class="flex items-center gap-5">
          <div class="w-14 h-14 rounded-2xl bg-blue-50 text-[#2463eb] flex items-center justify-center text-xl font-bold border border-blue-100/50">
            ${selectedPatient.name.charAt(0)}
          </div>
          <div>
            <div class="flex items-center gap-3">
              <span class="font-bold text-base text-slate-900">${selectedPatient.name}</span>
              <span class="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold uppercase tracking-wider border border-slate-200/50">${selectedPatient.id}</span>
            </div>
            <p class="text-slate-500 text-[11px] mt-0.5 flex items-center gap-2">
              <span>${selectedPatient.age}Y • ${selectedPatient.gender} ${selectedPatient.bloodGroup ? `• ${selectedPatient.bloodGroup}` : ''}</span>
              ${selectedPatient.phone ? `<span class="w-1 h-1 rounded-full bg-slate-300"></span> <span>${selectedPatient.phone}</span>` : ''}
              <span class="w-1 h-1 rounded-full bg-slate-300"></span>
              <button id="change-patient" class="text-blue-600 font-bold hover:underline cursor-pointer">Change Patient</button>
            </p>
          </div>
        </div>
        
        <div class="flex gap-4 scroll-hide">
          ${selectedPatient.previousVitals ? selectedPatient.previousVitals.map(v => `
            <div class="px-4 py-2.5 rounded-xl border border-slate-100 bg-slate-50/50 min-w-[120px]">
               <p class="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Previous ${v.type}</p>
               <div class="flex items-center gap-2 mt-0.5">
                 <p class="text-base font-bold text-slate-700">${v.value}</p>
                 <span class="material-icons text-${v.trend === 'up' ? 'amber-500' : 'slate-400'} text-[16px]">trending_${v.trend === 'up' ? 'up' : 'flat'}</span>
               </div>
            </div>
          `).join('') : '<p class="text-slate-300 font-bold italic text-sm">No previous vitals found</p>'}
        </div>
      </div>

      <!-- Quick Entry Grid -->
      <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
        ${Object.keys(vitalsData).map(key => `
          <button data-vital="${key}" class="quick-entry-btn flex flex-col items-center gap-1.5 p-2.5 bg-white border border-slate-200 rounded-xl hover:border-[#2463eb] hover:bg-blue-50/30 transition-all shadow-sm group active:scale-95">
            <div class="p-1.5 rounded-lg bg-slate-50 group-hover:bg-blue-100/50 transition-colors">
              <span class="material-icons text-[18px] text-slate-400 group-hover:text-[#2463eb] transition-colors">${vitalsData[key].icon}</span>
            </div>
            <span class="text-[9px] font-bold text-slate-600 group-hover:text-blue-700 uppercase tracking-wider text-center">${getLabel(key)}</span>
          </button>
        `).join('')}
      </div>

      <!-- Dynamic Form Area -->
      <div id="vitals-form-container" class="animate-in fade-in duration-500">
        <div id="form-placeholder" class="bg-white border-2 border-dashed border-slate-100 rounded-3xl p-12 text-center">
          <div class="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <span class="material-symbols-outlined text-3xl text-slate-300">pulse</span>
          </div>
          <p class="text-slate-900 font-bold text-base">Ready for Vitals Entry</p>
          <p class="text-slate-400 text-xs mt-1">Select a metric from the quick buttons or search to begin.</p>
        </div>
      </div>

      <!-- Offline/Sync Footer -->
      <div class="flex items-center justify-center gap-2 py-6">
         <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
         <p class="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">✓ System Secure & Syncing</p>
      </div>

      <!-- Sticky Footer -->
      <div class="fixed bottom-0 left-0 right-0 md:left-64 bg-white/95 backdrop-blur-md border-t border-slate-200/60 p-3.5 z-[2000] shadow-[0_-4px_20px_rgba(0,0,0,0.03)]">
        <div class="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <button id="vitals-cancel" class="px-6 py-2 text-slate-500 font-bold text-xs hover:text-slate-800 transition-colors uppercase tracking-wider">Cancel</button>
          <div class="flex gap-3">
             <button id="vitals-save-another" class="hidden md:flex items-center gap-2 px-6 py-2 bg-slate-50 text-slate-600 rounded-lg font-bold text-xs hover:bg-slate-100 transition-all border border-slate-200/50 uppercase tracking-wider">
               Save & Add Another
             </button>
             <button id="vitals-save" class="px-8 py-2 bg-[#2463eb] text-white rounded-lg font-bold text-xs shadow-lg shadow-blue-600/20 hover:bg-blue-700 transition-all disabled:opacity-30 disabled:grayscale uppercase tracking-wider">
               Save Vital Sign
             </button>
          </div>
        </div>
      </div>
    </div>
  `;

  const getFullHTML = () => {
    let content = '';
    if (currentStep === 'SELECT_PATIENT') content = renderSelectPatientStep();
    else if (currentStep === 'QUICK_REG') content = renderQuickRegStep();
    else content = renderEntryStep();

    return `
      <div class="vitals-entry-root">
        ${content}
      </div>
      <style>
        .scroll-hide::-webkit-scrollbar { display: none; }
        .vitals-container { padding-bottom: 120px; }
        .vital-input-group label { display: block; font-size: 10px; font-weight: 700; color: #64748b; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; }
        .vital-input { width: 100%; padding: 12px 16px; border: 1px solid #e2e8f0; border-radius: 0.75rem; font-size: 1rem; font-weight: 600; transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1); background: #f8fafc; color: #1e293b; }
        .vital-input:focus { border-color: #2463eb; outline: none; background: #ffffff; box-shadow: 0 0 20px rgba(36, 99, 235, 0.05); }
        .safety-alert { margin-top: 10px; font-size: 11px; font-weight: 700; display: flex; items-center gap-1.5; padding: 6px 12px; border-radius: 8px; width: fit-content; }
        .alert-red { background: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }
        .alert-amber { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
        
        @media (min-width: 768px) {
          .vitals-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
        }

        #patient-search-results button:last-child { border-bottom: none; }
      </style>
    `;
  };

  const bodyHTML = getFullHTML();
  renderAppShell('Vitals Entry', bodyHTML, '/nurse/vitals');

  const refreshUI = () => {
    renderVitalsEntry();
  };

  const setupStepLogic = () => {
    if (currentStep === 'SELECT_PATIENT') {
      const pSearchInput = document.getElementById('patient-search-input');
      const pResultsDiv = document.getElementById('patient-search-results');
      const btnQuickReg = document.getElementById('btn-quick-reg');

      const mockPatients = [
        { id: 'PID-101', name: 'Sarah Johnson', age: 42, gender: 'Female', previousVitals: [{ type: 'BP', value: '145/90', trend: 'up' }, { type: 'Temp', value: '37.2°C', trend: 'flat' }] },
        { id: 'PID-102', name: 'Michael Chen', age: 55, gender: 'Male', previousVitals: [{ type: 'BP', value: '120/80', trend: 'flat' }] },
        { id: 'PID-103', name: 'Priya Sharma', age: 29, gender: 'Female', previousVitals: null }
      ];

      pSearchInput?.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim();
        if (val.length < 2) {
          pResultsDiv.classList.add('hidden');
          return;
        }

        const matches = mockPatients.filter(p => p.name.toLowerCase().includes(val) || p.id.toLowerCase().includes(val));

        if (matches.length > 0) {
          pResultsDiv.innerHTML = matches.map(p => `
            <button class="patient-result-item w-full px-6 py-4 text-left hover:bg-slate-50 flex items-center justify-between group transition-all border-b border-slate-50 last:border-none" data-id="${p.id}">
              <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-sm">
                  ${p.name.charAt(0)}
                </div>
                <div>
                  <p class="font-bold text-slate-900">${p.name}</p>
                  <p class="text-xs text-slate-400 font-medium">${p.id} • ${p.age}Y • ${p.gender}</p>
                </div>
              </div>
              <span class="material-icons text-blue-400 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">chevron_right</span>
            </button>
          `).join('');
          pResultsDiv.classList.remove('hidden');
        } else {
          pResultsDiv.classList.add('hidden');
        }
      });

      pResultsDiv?.addEventListener('click', (e) => {
        const item = e.target.closest('.patient-result-item');
        if (item) {
          const patient = mockPatients.find(p => p.id === item.dataset.id);
          selectedPatient = patient;
          currentStep = 'ENTRY';
          refreshUI();
        }
      });

      btnQuickReg?.addEventListener('click', () => {
        currentStep = 'QUICK_REG';
        refreshUI();
      });
    }

    if (currentStep === 'QUICK_REG') {
      const backBtn = document.getElementById('back-to-search');
      const regForm = document.getElementById('quick-reg-form');

      backBtn?.addEventListener('click', () => {
        currentStep = 'SELECT_PATIENT';
        refreshUI();
      });

      regForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('reg-name').value;
        const age = document.getElementById('reg-age').value;
        const gender = document.getElementById('reg-gender').value;
        const phone = document.getElementById('reg-phone').value;
        const locality = document.getElementById('reg-locality').value;
        const blood = document.getElementById('reg-blood').value;

        selectedPatient = {
          id: 'PID-' + Math.floor(1000 + Math.random() * 9000),
          name: name,
          age: age,
          gender: gender,
          phone: phone,
          locality: locality,
          bloodGroup: blood,
          previousVitals: null
        };
        currentStep = 'ENTRY';
        refreshUI();
      });
    }

    if (currentStep === 'ENTRY') {
      const searchInput = document.getElementById('vitals-smart-search');
      const suggestionsDiv = document.getElementById('search-suggestions');
      const formContainer = document.getElementById('vitals-form-container');
      const saveBtn = document.getElementById('vitals-save');
      const changePatientBtn = document.getElementById('change-patient');

      changePatientBtn?.addEventListener('click', () => {
        currentStep = 'SELECT_PATIENT';
        selectedPatient = null;
        activeVital = null;
        refreshUI();
      });

      const updateLanguage = (newLang) => {
        language = newLang;
        refreshUI();
      };

      document.getElementById('lang-en')?.addEventListener('click', () => updateLanguage('EN'));
      document.getElementById('lang-ta')?.addEventListener('click', () => updateLanguage('TA'));

      searchInput?.addEventListener('input', (e) => {
        const val = e.target.value.toLowerCase().trim();
        if (val.length < 1) {
          suggestionsDiv.classList.add('hidden');
          return;
        }

        const matches = Object.keys(vitalsData).filter(key =>
          key.toLowerCase().includes(val) ||
          vitalsData[key].label.toLowerCase().includes(val) ||
          vitalsData[key].ta.toLowerCase().includes(val)
        );

        if (matches.length > 0) {
          suggestionsDiv.innerHTML = matches.map(key => `
            <button class="suggestion-item w-full px-6 py-3 text-left hover:bg-slate-50 flex items-center justify-between group transition-all" data-key="${key}">
              <div class="flex items-center gap-3">
                 <span class="material-icons text-slate-400 group-hover:text-[#2463eb]">${vitalsData[key].icon}</span>
                 <div>
                    <p class="font-bold text-slate-900">${vitalsData[key].label}</p>
                    <p class="text-xs text-slate-400">${vitalsData[key].ta}</p>
                 </div>
              </div>
              <span class="material-icons text-slate-300 opacity-0 group-hover:opacity-100 transition-all">chevron_right</span>
            </button>
          `).join('');
          suggestionsDiv.classList.remove('hidden');
        } else {
          suggestionsDiv.classList.add('hidden');
        }
      });

      const loadForm = (key) => {
        activeVital = key;
        suggestionsDiv.classList.add('hidden');
        searchInput.value = '';

        let formHTML = '';
        const label = language === 'EN' ? vitalsData[key].label : vitalsData[key].ta;

        if (key === 'BP') {
          formHTML = `
            <div class="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/60 animate-in fade-in slide-in-from-bottom-6 duration-500">
              <div class="flex items-center gap-4 mb-6">
                <div class="w-12 h-12 rounded-xl bg-blue-50 text-[#2463eb] flex items-center justify-center border border-blue-100">
                  <span class="material-icons-outlined text-2xl">monitor_heart</span>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-slate-800">${label}</h3>
                  <p class="text-xs text-slate-400 font-medium">Capture arterial blood pressure readings</p>
                </div>
              </div>

              <div class="vitals-grid">
                <div class="vital-input-group mb-8">
                  <label>${language === 'EN' ? 'Systolic (mmHg)' : 'சிஸ்டாலிக்'}</label>
                  <input type="number" id="bp-systolic" class="vital-input px-6" placeholder="120" autofocus>
                  <div id="bp-sys-alert" class="safety-alert hidden"></div>
                </div>
                <div class="vital-input-group mb-8">
                  <label>${language === 'EN' ? 'Diastolic (mmHg)' : 'டயஸ்டாலிக்'}</label>
                  <input type="number" id="bp-diastolic" class="vital-input px-6" placeholder="80">
                  <div id="bp-dia-alert" class="safety-alert hidden"></div>
                </div>
              </div>

              <div class="grid grid-cols-2 gap-6 mt-2">
                <div class="vital-input-group">
                  <label>${language === 'EN' ? 'Position' : 'நிலை'}</label>
                  <select class="vital-input text-base h-[64px] py-0 px-6 font-bold bg-white">
                    <option>Sitting</option>
                    <option>Standing</option>
                    <option>Lying</option>
                  </select>
                </div>
                <div class="vital-input-group">
                  <label>${language === 'EN' ? 'Measurement Arm' : 'அளவீட்டு கை'}</label>
                  <select class="vital-input text-base h-[64px] py-0 px-6 font-bold bg-white">
                    <option>Right Arm</option>
                    <option>Left Arm</option>
                  </select>
                </div>
              </div>
              
              <div class="mt-8">
                <label class="block text-[11px] font-extrabold text-slate-500 mb-3 uppercase tracking-widest">${language === 'EN' ? 'Clinical Observations' : 'குறிப்புகள்'}</label>
                <textarea class="w-full p-5 border border-slate-200 rounded-2xl text-sm focus:border-[#2463eb] outline-none bg-slate-50/50 transition-all font-medium" rows="3" placeholder="Add any relevant observations..."></textarea>
              </div>
            </div>
          `;
        } else if (key === 'Temp') {
          formHTML = `
            <div class="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/60 animate-in fade-in slide-in-from-bottom-6 duration-500">
              <div class="flex items-center gap-4 mb-6">
                <div class="w-12 h-12 rounded-xl bg-blue-50 text-[#2463eb] flex items-center justify-center border border-blue-100">
                  <span class="material-icons-outlined text-2xl">thermostat</span>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-slate-800">${label}</h3>
                  <p class="text-xs text-slate-400 font-medium">Core body temperature measurement</p>
                </div>
              </div>

              <div class="vitals-grid">
                <div class="vital-input-group">
                  <label>${language === 'EN' ? 'Temperature Value (°C)' : 'வெப்பநிலை (மதிப்பு)'}</label>
                  <input type="number" step="0.1" id="temp-value" class="vital-input px-6" placeholder="36.8" autofocus>
                  <div id="temp-alert" class="safety-alert hidden"></div>
                </div>
                <div class="vital-input-group">
                  <label>${language === 'EN' ? 'Measurement Route' : 'வழிமுறை'}</label>
                  <select class="vital-input text-base h-[64px] py-0 px-6 font-bold bg-white">
                    <option>Oral</option>
                    <option>Axillary</option>
                    <option>Tympanic</option>
                    <option>Rectal</option>
                  </select>
                </div>
              </div>
            </div>
          `;
        } else {
          formHTML = `
            <div class="bg-white rounded-3xl p-6 md:p-8 shadow-xl border border-slate-200/60 animate-in fade-in slide-in-from-bottom-6 duration-500">
              <div class="flex items-center gap-4 mb-6">
                <div class="w-12 h-12 rounded-xl bg-blue-50 text-[#2463eb] flex items-center justify-center border border-blue-100">
                  <span class="material-icons-outlined text-2xl">${vitalsData[key].icon}</span>
                </div>
                <div>
                  <h3 class="text-xl font-bold text-slate-800">${label}</h3>
                  <p class="text-xs text-slate-400 font-medium">Standard clinical measurement</p>
                </div>
              </div>
              <div class="vital-input-group max-w-sm">
                <label>Measured Value</label>
                <input type="number" class="vital-input px-6" placeholder="0" autofocus>
              </div>
            </div>
          `;
        }
        formContainer.innerHTML = formHTML;
        saveBtn.disabled = false;

        if (key === 'BP') {
          const sysInput = document.getElementById('bp-systolic');
          const sysAlert = document.getElementById('bp-sys-alert');
          sysInput?.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            if (val > 180 || val < 90) {
              sysInput.classList.add('border-red-500', 'bg-red-50');
              sysAlert.innerHTML = '<span class="material-icons text-[14px]">warning</span> Critical Value!';
              sysAlert.className = 'safety-alert alert-red';
            } else if (val > 140) {
              sysInput.classList.add('border-amber-400', 'bg-amber-50');
              sysAlert.innerHTML = '<span class="material-icons text-[14px]">info</span> High Reading';
              sysAlert.className = 'safety-alert alert-amber';
            } else {
              sysInput.classList.remove('border-red-500', 'bg-red-50', 'border-amber-400', 'bg-amber-50');
              sysAlert.className = 'safety-alert hidden';
            }
          });
        }

        if (key === 'Temp') {
          const tempInput = document.getElementById('temp-value');
          const tempAlert = document.getElementById('temp-alert');
          tempInput?.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            if (val > 38.5) {
              tempInput.classList.add('border-amber-500', 'bg-amber-50');
              tempAlert.innerHTML = '<span class="material-icons text-[14px]">local_fire_department</span> Fever Alert';
              tempAlert.className = 'safety-alert alert-amber';
            } else if (val > 40) {
              tempInput.classList.add('border-red-500', 'bg-red-50');
              tempAlert.innerHTML = '<span class="material-icons text-[14px]">warning</span> Critical Fever!';
              tempAlert.className = 'safety-alert alert-red';
            } else {
              tempInput.classList.remove('border-amber-500', 'bg-amber-50', 'border-red-500', 'bg-red-50');
              tempAlert.className = 'safety-alert hidden';
            }
          });
        }
      };

      document.addEventListener('click', (e) => {
        const suggestionBtn = e.target.closest('.suggestion-item');
        if (suggestionBtn) {
          loadForm(suggestionBtn.dataset.key);
          return;
        }

        const quickBtn = e.target.closest('.quick-entry-btn');
        if (quickBtn) {
          loadForm(quickBtn.dataset.vital);
          return;
        }

        if (searchInput && !searchInput.contains(e.target)) {
          suggestionsDiv?.classList.add('hidden');
        }
      });

      saveBtn?.addEventListener('click', () => {
        if (!activeVital) return;
        saveBtn.innerHTML = '<span class="material-icons animate-spin text-[20px]">sync</span> Saving...';
        saveBtn.disabled = true;
        setTimeout(() => {
          window.showToast?.(`${vitalsData[activeVital].label} saved for ${selectedPatient.name}`, 'success');
          location.hash = '#/nurse/dashboard';
        }, 1000);
      });

      document.getElementById('vitals-cancel')?.addEventListener('click', () => {
        location.hash = '#/nurse/dashboard';
      });
    }
  };

  setupStepLogic();
}
