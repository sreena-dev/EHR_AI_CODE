/**
 * Staff Registration — Multi-step wizard
 * New Design: Layout with Sidebar and Main Content
 * Steps: Core Identity → Pro Credentials → Scheduling → Finalize
 */
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';

const STEPS = [
  { id: 'identity', label: 'Core Identity', subtitle: 'Basic information', icon: 'person' },
  { id: 'credentials', label: 'Professional Credentials', subtitle: 'Medical credentials', icon: 'verified_user' },
  { id: 'scheduling', label: 'Scheduling Preferences', subtitle: 'Availability', icon: 'calendar_today' },
  { id: 'finalize', label: 'Finalize Account', subtitle: 'Review and submit', icon: 'check_circle' },
];

export async function renderRegister() {
  // Get role from URL hash params
  const hash = window.location.hash;
  const roleMatch = hash.match(/role=(\w+)/);
  const role = roleMatch ? roleMatch[1] : 'doctor';
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  let currentStep = 0;
  const formData = {
    role,
    registrationId: `REG-2023-${role.toUpperCase().substring(0, 3)}-${Math.floor(100 + Math.random() * 900)}`
  };

  const app = document.getElementById('app');

  function render() {
    app.innerHTML = `
      <div class="flex flex-col min-h-screen bg-slate-50">
        <!-- Sticky Header -->
        <header class="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div class="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16 items-center">
              <div class="flex items-center gap-4">
                <button id="back-to-role" class="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer border-none bg-transparent">
                  <span class="material-icons">arrow_back</span>
                </button>
                <div>
                  <h1 class="text-lg font-semibold text-slate-900">Register New Staff: ${roleLabel}</h1>
                  <p class="text-xs text-slate-500">Onboarding portal for medical professionals</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <div class="flex-grow flex flex-col md:flex-row max-w-[1440px] mx-auto w-full">
          <!-- Progress Sidebar -->
          <aside class="w-full md:w-80 bg-white border-b md:border-b-0 md:border-r border-slate-200 p-6 flex-shrink-0">
            <nav class="space-y-6">
              ${STEPS.map((step, i) => `
                <div class="flex items-start gap-4">
                  <div class="flex flex-col items-center">
                    <div class="w-8 h-8 rounded-full ${i < currentStep ? 'bg-emerald-100 text-emerald-600 border-2 border-emerald-500' : i === currentStep ? 'bg-primary text-white ring-4 ring-primary/20' : 'bg-slate-100 text-slate-400 border border-slate-300'} flex items-center justify-center">
                      ${i < currentStep ? '<span class="material-icons text-lg">check</span>' : `<span>${i + 1}</span>`}
                    </div>
                    ${i < STEPS.length - 1 ? `<div class="w-0.5 h-12 ${i < currentStep ? 'bg-emerald-200' : 'bg-slate-200'} mt-2"></div>` : ''}
                  </div>
                  <div class="pt-1">
                    <h3 class="text-sm font-semibold ${i === currentStep ? 'text-primary' : i < currentStep ? 'text-slate-900' : 'text-slate-500'}">${step.label}</h3>
                    <p class="text-xs ${i < currentStep ? 'text-emerald-600' : i === currentStep ? 'text-slate-500' : 'text-slate-400'}">${i < currentStep ? 'Completed' : i === currentStep ? 'In Progress' : 'Upcoming'}</p>
                  </div>
                </div>
              `).join('')}
            </nav>

          <div class="mt-12 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
            <p class="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Registration ID</p>
            <div class="flex items-center justify-between">
              <span class="font-mono text-sm font-semibold text-slate-700 dark:text-slate-300">${formData.registrationId}</span>
              <span class="material-icons text-slate-400 text-sm cursor-pointer hover:text-primary" onclick="navigator.clipboard.writeText('${formData.registrationId}'); showToast('ID copied to clipboard', 'success')">content_copy</span>
            </div>
          </div>
        </aside>

          <!-- Main Form Area -->
          <main class="flex-grow py-8 px-4 sm:px-6 lg:px-12">
            <div class="max-w-4xl space-y-8">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-2xl font-bold text-slate-900">${STEPS[currentStep].label}</h2>
                  <p class="text-slate-500 mt-1">${getStepDescription(currentStep, role)}</p>
                </div>
                <div class="hidden md:block">
                  <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20">
                    <span class="material-icons text-base mr-1.5">badge</span>
                    ID: ${formData.registrationId.split('-').pop()}
                  </span>
                </div>
              </div>

              <form id="reg-form" class="space-y-8 pb-24" autocomplete="off">
                ${renderStepFields(currentStep, role, formData)}
              </form>
            </div>
          </main>
        </div>

        <!-- Sticky Footer Actions -->
        <div class="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 p-4 z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
          <div class="max-w-[1440px] mx-auto flex items-center justify-between">
            <button id="prev-btn" class="inline-flex items-center px-4 py-2 border border-slate-300 shadow-sm text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors cursor-pointer" type="button">
              <span class="material-icons text-sm mr-2">arrow_back</span>
              Back
            </button>
            <div class="flex items-center gap-4">
              <button id="draft-btn" class="hidden sm:inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-slate-500 hover:text-slate-700 focus:outline-none transition-colors cursor-pointer" type="button">
                Save as Draft
              </button>
              <button id="next-btn" class="inline-flex items-center px-6 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-primary hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all transform active:scale-95 cursor-pointer" type="button">
                ${currentStep < STEPS.length - 1 ? 'Next' : ` Activate ${roleLabel} Account`}
                <span class="material-icons text-sm ml-2">${currentStep < STEPS.length - 1 ? 'arrow_forward' : ''}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    // Event Bindings
    document.getElementById('back-to-role').onclick = () => navigate('/register-role');

    // Password Analysis Logic
    if (currentStep === 3) {
      const passwordInput = document.getElementById('password');
      const confirmInput = document.getElementById('confirm_password');

      const updateRequirements = () => {
        const pwd = passwordInput.value;
        const confirm = confirmInput.value;

        const reqs = {
          length: pwd.length >= 8,
          special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
          number: /[0-9]/.test(pwd),
          match: pwd && pwd === confirm
        };

        const extra = {
          upper: /[A-Z]/.test(pwd),
          lower: /[a-z]/.test(pwd),
          long: pwd.length >= 14
        };

        // Update UI items
        Object.entries(reqs).forEach(([key, met]) => {
          const el = document.getElementById(`req-${key}`);
          if (!el) return;
          el.className = `flex items-center gap-2 text-sm ${met ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'} transition-colors`;
          el.querySelector('.material-icons').textContent = met ? 'check_circle' : 'radio_button_unchecked';
        });

        // Strength Bar calculation
        // Base points from 3 main reqs + 3 extra ones
        const strengthPoints = [
          reqs.length, reqs.special, reqs.number,
          extra.upper, extra.lower, extra.long
        ].filter(v => v).length;

        const strengthBar = document.getElementById('strength-bar');
        const strengthText = document.getElementById('strength-text');

        const levels = [
          { color: 'bg-red-500', text: 'Very Weak', width: '15%' },
          { color: 'bg-amber-500', text: 'Weak', width: '30%' },
          { color: 'bg-yellow-500', text: 'Fair', width: '45%' },
          { color: 'bg-emerald-400', text: 'Good', width: '60%' },
          { color: 'bg-emerald-500', text: 'Strong', width: '80%' },
          { color: 'bg-blue-500', text: 'Excellent', width: '100%' }
        ];

        if (!pwd) {
          strengthBar.style.width = '0%';
          strengthBar.className = 'h-full bg-slate-200 transition-all duration-300';
          strengthText.textContent = 'Start typing...';
          strengthText.className = 'mt-1 text-xs text-slate-500 font-medium text-right';
        } else {
          const level = levels[Math.min(strengthPoints - 1, 5)] || levels[0];
          strengthBar.style.width = level.width;
          strengthBar.className = `h-full ${level.color} transition-all duration-300`;
          strengthText.textContent = level.text;
          strengthText.className = `mt-1 text-xs ${level.color.replace('bg-', 'text-')} font-medium text-right`;
        }
      };

      passwordInput.oninput = updateRequirements;
      confirmInput.oninput = updateRequirements;
    }

    const prevBtn = document.getElementById('prev-btn');
    if (currentStep === 0) {
      prevBtn.onclick = () => navigate('/register-role');
    } else {
      prevBtn.onclick = () => {
        saveFormGroup(currentStep, formData);
        currentStep--;
        render();
        window.scrollTo(0, 0);
      };
    }

    document.getElementById('next-btn').onclick = () => {
      const isValid = validateStep(currentStep);
      if (!isValid) return;

      saveFormGroup(currentStep, formData);

      if (currentStep < STEPS.length - 1) {
        currentStep++;
        render();
        window.scrollTo(0, 0);
      } else {
        showToast('Registration submitted successfully!', 'success');
        setTimeout(() => navigate('/activation-success'), 800);
      }
    };

    const draftBtn = document.getElementById('draft-btn');
    if (draftBtn) {
      draftBtn.onclick = () => {
        saveFormGroup(currentStep, formData);
        showToast('Draft saved successfully', 'success');
      };
    }

    // Skill tag removal binding
    document.querySelectorAll('.skill-remove-btn').forEach(btn => {
      btn.onclick = (e) => {
        const tag = e.target.closest('.skill-tag');
        tag.remove();
      };
    });
  }

  render();
}

function getStepDescription(step, role) {
  const descriptions = [
    'Please provide the core identity information and contact details.',
    'Enter your medical credentials and professional licensing details.',
    'Set your department assignment and shift availability.',
    'Review your information and finalize your account creation.'
  ];
  return descriptions[step];
}

function renderStepFields(step, role, data) {
  switch (step) {
    case 0: // Core Identity
      return `
        <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6 md:p-8">
          <div class="flex items-center mb-6">
            <h3 class="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <span class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <span class="material-icons text-lg">person</span>
              </span>
              Personal Details
            </h3>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5" for="fullName">Full Name (English)</label>
              <div class="relative">
                <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span class="text-slate-400 text-sm">${role === 'doctor' ? 'Dr.' : role === 'nurse' ? 'Nr.' : ''}</span>
                </div>
                <input class="${role === 'admin' ? 'pl-4' : 'pl-10'} block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" id="fullName" data-key="fullName" placeholder="${role === 'admin' ? 'Full name' : 'Rajesh Kumar'}" type="text" value="${data.fullName || ''}" required />
              </div>
            </div>
            ${role === 'doctor' ? `
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5 flex justify-between" for="fullNameTamil">
                <span>Full Name (Tamil)</span>
                <span class="text-xs text-primary cursor-pointer hover:underline" id="auto-translate-btn">Auto-translate</span>
              </label>
              <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" dir="auto" id="fullNameTamil" data-key="fullNameTamil" placeholder="டாக்டர் ராஜேஷ் குமார்" type="text" value="${data.fullNameTamil || ''}" />
            </div>
            ` : (role === 'nurse' || role === 'admin') ? `
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5">Regional Name (Optional)</label>
              <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" dir="auto" data-key="regionalName" placeholder="Name in regional script" type="text" value="${data.regionalName || ''}" />
            </div>
            ` : ''}
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
              <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" type="email" data-key="email" placeholder="${role === 'admin' ? 'admin@hospitals.org' : 'staff@hospitals.org'}" value="${data.email || ''}" required />
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5">Mobile Number</label>
              <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" type="tel" data-key="phone" placeholder="+91 98765 43210" value="${data.phone || ''}" required />
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5">Date of Birth</label>
              <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" type="date" data-key="dob" value="${data.dob || ''}" required />
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5">Gender</label>
              <select class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" data-key="gender" required>
                <option value="">Select Gender</option>
                <option ${data.gender === 'Male' ? 'selected' : ''}>Male</option>
                <option ${data.gender === 'Female' ? 'selected' : ''}>Female</option>
                <option ${data.gender === 'Other' ? 'selected' : ''}>Other</option>
              </select>
            </div>
          </div>
        </div>
      `;

    case 1: // Professional Credentials
      if (role === 'admin') {
        return `
          <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6 md:p-8">
            <div class="flex items-center mb-6">
              <h3 class="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <span class="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center text-amber-600">
                  <span class="material-icons text-lg">admin_panel_settings</span>
                </span>
                Administrative Access
              </h3>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              <div class="col-span-1">
                <label class="block text-sm font-medium text-slate-700 mb-1.5">Admin Authorization Code</label>
                <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 uppercase font-mono tracking-wide reg-field" data-key="authCode" placeholder="AUTH-XXXX-YYYY" type="text" value="${data.authCode || ''}" required />
                <p class="mt-1 text-xs text-slate-500">Provided by hospital IT administration</p>
              </div>
              <div class="col-span-1">
                <label class="block text-sm font-medium text-slate-700 mb-1.5">Access Level</label>
                <select class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" data-key="accessLevel" required>
                  <option value="">Select Level</option>
                  <option ${data.accessLevel === 'Standard Admin' ? 'selected' : ''}>Standard Admin</option>
                  <option ${data.accessLevel === 'Super Admin' ? 'selected' : ''}>Super Admin</option>
                </select>
              </div>
              <div class="col-span-1">
                <label class="block text-sm font-medium text-slate-700 mb-1.5">Department</label>
                <select class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" data-key="department" required>
                  <option value="">Select Department</option>
                  <option ${data.department === 'Administration' ? 'selected' : ''}>Administration</option>
                  <option ${data.department === 'Finance' ? 'selected' : ''}>Finance</option>
                  <option ${data.department === 'Human Resources' ? 'selected' : ''}>Human Resources</option>
                  <option ${data.department === 'IT' ? 'selected' : ''}>IT</option>
                </select>
              </div>
            </div>
          </div>
        `;
      }

      const isExpiringSoon = data.expiryDate && new Date(data.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      return `
        <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6 md:p-8">
          <div class="flex items-center mb-6">
            <h3 class="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <span class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <span class="material-icons text-lg">verified_user</span>
              </span>
              ${role === 'doctor' ? 'Medical' : 'Nursing'} Credentials
            </h3>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5">License Number</label>
              <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 uppercase font-mono tracking-wide reg-field" data-key="license" placeholder="REG-2023-8890" type="text" value="${data.license || ''}" required />
              <p class="mt-1 text-xs text-slate-500">Format: REG-XXXX-YYYY</p>
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5">License Expiry Date</label>
              <div class="relative">
                <input class="block w-full rounded-lg ${isExpiringSoon ? 'border-red-300 bg-red-50' : 'border-slate-300'} text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" type="date" data-key="expiryDate" value="${data.expiryDate || '2023-11-20'}" required />
                ${isExpiringSoon ? `<div class="absolute inset-y-0 right-8 flex items-center pointer-events-none text-red-500"><span class="material-icons text-lg">warning</span></div>` : ''}
              </div>
              ${isExpiringSoon ? `
                <div class="mt-3 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3">
                  <div class="flex-shrink-0 mt-1">
                    <span class="relative flex h-3 w-3">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                    </span>
                  </div>
                  <div class="flex-1 w-full">
                    <div class="flex justify-between items-center mb-1">
                      <p class="text-xs font-bold text-red-700">Expires soon</p>
                      <span class="text-[10px] font-semibold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">URGENT</span>
                    </div>
                    <p class="text-xs text-red-600 mb-2">Requires renewal before activation.</p>
                    <div class="w-full bg-red-200 rounded-full h-1.5">
                      <div class="bg-red-500 h-1.5 rounded-full" style="width: 85%"></div>
                    </div>
                  </div>
                </div>
              ` : ''}
            </div>
            
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5">${role === 'doctor' ? 'Specialization' : 'Primary Qualification'}</label>
              ${role === 'doctor' ? `
              <select class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" data-key="specialization" required>
                <option value="">Select Specialization</option>
                <option ${data.specialization === 'Cardiology' ? 'selected' : ''}>Cardiology</option>
                <option ${data.specialization === 'Neurology' ? 'selected' : ''}>Neurology</option>
                <option ${data.specialization === 'Pediatrics' ? 'selected' : ''}>Pediatrics</option>
                <option ${data.specialization === 'General Medicine' ? 'selected' : ''}>General Medicine</option>
              </select>
              ` : `
              <select class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" data-key="qualification" required>
                <option value="">Select Qualification</option>
                <option ${data.qualification === 'B.Sc Nursing' ? 'selected' : ''}>B.Sc Nursing</option>
                <option ${data.qualification === 'M.Sc Nursing' ? 'selected' : ''}>M.Sc Nursing</option>
                <option ${data.qualification === 'GNM' ? 'selected' : ''}>GNM</option>
              </select>
              `}
            </div>

            <div class="col-span-1 md:col-span-2">
              <label class="block text-sm font-medium text-slate-700 mb-1.5">Professional Tags</label>
              <div class="p-2 border border-slate-300 rounded-lg bg-white focus-within:ring-1 focus-within:ring-primary focus-within:border-primary min-h-[3rem] flex flex-wrap gap-2 items-center">
                ${(data.tags || (role === 'doctor' ? ['MBBS', 'MD'] : ['RN'])).map(tag => `
                  <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20 skill-tag">
                      ${tag}
                      <button class="ml-1.5 inline-flex items-center justify-center text-primary/70 hover:text-primary focus:outline-none skill-remove-btn" type="button"><span class="material-icons text-sm">close</span></button>
                  </span>
                `).join('')}
                <input class="flex-1 min-w-[120px] border-none bg-transparent p-1 focus:ring-0 text-sm placeholder-slate-400" placeholder="Add tag..." type="text" />
              </div>
            </div>

            <div class="col-span-1 md:col-span-2">
              <label class="block text-sm font-medium text-slate-700 mb-1.5">${role === 'doctor' ? 'E-Signature for Prescriptions' : 'Digital Certification Upload'}</label>
              <div class="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-xl hover:bg-slate-50 transition-colors group cursor-pointer relative">
                <div class="space-y-1 text-center">
                  <div class="mx-auto h-12 w-12 text-slate-400 group-hover:text-primary transition-colors">
                    <span class="material-icons text-5xl">${role === 'doctor' ? 'draw' : 'file_upload'}</span>
                  </div>
                  <div class="flex text-sm text-slate-600 justify-center">
                    <label class="relative cursor-pointer rounded-md font-medium text-primary hover:text-blue-500 focus-within:outline-none">
                      <span>Upload a file</span>
                      <input class="sr-only" type="file" />
                    </label>
                    <p class="pl-1">or drag and drop</p>
                  </div>
                  <p class="text-xs text-slate-500">PNG, JPG, PDF up to 5MB</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

    case 2: // Scheduling
      return `
        <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6 md:p-8">
          <div class="flex items-center mb-6">
            <h3 class="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <span class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <span class="material-icons text-lg">calendar_today</span>
              </span>
              Shift & ${role === 'admin' ? 'Position' : 'Ward'} Assignment
            </h3>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5">Preferred ${role === 'admin' ? 'Duty Area' : 'Ward / Department'}</label>
              <select class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" data-key="ward" required>
                <option value="">Select Area</option>
                ${role === 'admin' ? `
                  <option ${data.ward === 'General Office' ? 'selected' : ''}>General Office</option>
                  <option ${data.ward === 'Billing Desk' ? 'selected' : ''}>Billing Desk</option>
                  <option ${data.ward === 'Reception' ? 'selected' : ''}>Reception</option>
                ` : `
                  <option ${data.ward === 'General Medicine (Floor 1)' ? 'selected' : ''}>General Medicine (Floor 1)</option>
                  <option ${data.ward === 'Pediatric Ward (Floor 3)' ? 'selected' : ''}>Pediatric Ward (Floor 3)</option>
                  <option ${data.ward === 'ICU (Floor 4)' ? 'selected' : ''}>ICU (Floor 4)</option>
                  <option ${data.ward === 'Emergency' ? 'selected' : ''}>Emergency</option>
                `}
              </select>
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5">Preferred Shift</label>
              <select class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" data-key="shift" required>
                <option value="">Select Shift</option>
                <option ${data.shift === 'Morning' ? 'selected' : ''}>Morning (6 AM - 2 PM)</option>
                <option ${data.shift === 'Afternoon' ? 'selected' : ''}>Afternoon (2 PM - 10 PM)</option>
                <option ${data.shift === 'Night' ? 'selected' : ''}>Night (10 PM - 6 AM)</option>
                <option ${data.shift === 'Rotating' ? 'selected' : ''}>Rotating</option>
              </select>
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5">Anticipated Start Date</label>
              <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" type="date" data-key="startDate" value="${data.startDate || ''}" required />
            </div>
          </div>
        </div>
      `;

    case 3: // Finalize
      return `
        <div class="space-y-8">
          <!-- Security Setup -->
          <div class="bg-surface-light dark:bg-surface-dark shadow-sm border border-slate-200 dark:border-slate-700 rounded-xl p-6 md:p-8">
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
              <span class="material-symbols-outlined text-primary">security</span>
              Security Setup
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5" for="password">Set Account Password</label>
                  <div class="relative">
                    <input class="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm h-11 reg-field" id="password" data-key="password" placeholder="••••••••••••" type="password" required />
                    <button class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer" type="button" onclick="const input = this.previousElementSibling; input.type = input.type === 'password' ? 'text' : 'password'; this.firstElementChild.textContent = input.type === 'password' ? 'visibility' : 'visibility_off'">
                      <span class="material-icons text-sm">visibility</span>
                    </button>
                  </div>
                  <div class="mt-2 h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div id="strength-bar" class="h-full bg-slate-300 transition-all duration-300" style="width: 0%"></div>
                  </div>
                  <p id="strength-text" class="mt-1 text-xs text-slate-500 font-medium text-right">Start typing...</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5" for="confirm_password">Confirm Password</label>
                  <input class="block w-full rounded-lg border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm focus:border-primary focus:ring-primary sm:text-sm h-11 reg-field" id="confirm_password" data-key="confirmPassword" placeholder="••••••••••••" type="password" required />
                </div>
              </div>
              <div class="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-lg border border-slate-200 dark:border-slate-700">
                <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Security Requirements</h4>
                <ul class="space-y-2">
                  <li id="req-length" class="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 transition-colors">
                    <span class="material-icons text-base">radio_button_unchecked</span>
                    Minimum 8 characters
                  </li>
                  <li id="req-special" class="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 transition-colors">
                    <span class="material-icons text-base">radio_button_unchecked</span>
                    At least one special character
                  </li>
                  <li id="req-number" class="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 transition-colors">
                    <span class="material-icons text-base">radio_button_unchecked</span>
                    At least one number
                  </li>
                  <li id="req-match" class="flex items-center gap-2 text-sm text-slate-400 dark:text-slate-500 transition-colors">
                    <span class="material-icons text-base">radio_button_unchecked</span>
                    Both passwords match
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Legal & HIPAA -->
          <div class="bg-surface-light dark:bg-surface-dark shadow-sm border border-slate-200 dark:border-slate-700 rounded-xl p-6 md:p-8">
            <h3 class="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-6">
              <span class="material-symbols-outlined text-primary">gavel</span>
              Legal & HIPAA Agreement
            </h3>
            <div class="space-y-6">
              <div class="bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 p-4 h-48 overflow-y-auto text-sm text-slate-600 dark:text-slate-400 leading-relaxed scrollbar-thin scrollbar-thumb-slate-300 dark:scrollbar-thumb-slate-600">
                <p class="mb-4 font-bold text-slate-900 dark:text-white">Business Associate Agreement (BAA) & Terms of Service</p>
                <p class="mb-4">This agreement ("Agreement") is made effective as of today, between the Medical Professional ("Practitioner") and the Healthcare Platform. The Practitioner agrees to maintain the confidentiality and security of Protected Health Information (PHI) in accordance with the Health Insurance Portability and Accountability Act of 1996 (HIPAA) and the Health Information Technology for Economic and Clinical Health (HITECH) Act.</p>
                <p class="mb-4">1. Permitted Uses and Disclosures: The Practitioner shall only use or disclose PHI as necessary to perform functions, activities, or services for, or on behalf of, patients or as required by law.</p>
                <p class="mb-4">2. Safeguards: The Practitioner shall use appropriate administrative, physical, and technical safeguards to prevent use or disclosure of PHI other than as provided for by this Agreement.</p>
                <p class="mb-4">3. Reporting: The Practitioner shall report to the Compliance Officer any use or disclosure of PHI not provided for by this Agreement of which they become aware, including breaches of unsecured PHI.</p>
                <p>4. Compliance with Electronic Transactions: The Practitioner shall comply with the HIPAA Standards for Electronic Transactions and Code Sets, 45 C.F.R. Part 162.</p>
              </div>
              <div class="flex items-start gap-3">
                <div class="flex items-center h-5">
                  <input class="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary reg-field" id="agreement" data-key="agreement" type="checkbox" required />
                </div>
                <div class="text-sm">
                  <label class="font-medium text-slate-700 dark:text-slate-300" for="agreement">I have read and agree to the HIPAA Compliance Agreement and Terms of Service.</label>
                  <p class="text-slate-500 dark:text-slate-400 font-normal">By checking this box, you confirm your legal obligation to protect patient data.</p>
                </div>
              </div>
              <div class="pt-4">
                <label class="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Authorized Signature</label>
                <div class="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900/30 h-32 flex flex-col items-center justify-center relative group cursor-crosshair">
                  <span class="text-slate-400 text-xs italic">Sign within this area using your mouse or touch device</span>
                  <div class="absolute bottom-2 right-2">
                    <button class="text-xs text-primary hover:underline bg-white/80 dark:bg-slate-800/80 px-2 py-1 rounded border-none cursor-pointer" type="button">Clear</button>
                  </div>
                </div>
                <p class="mt-2 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                  <span class="material-icons text-[14px]">lock</span>
                  Digitally encrypted signature - IP recorded for audit trail
                </p>
              </div>
            </div>
          </div>
        </div>
      `;

    default: return '';
  }
}

function saveFormGroup(step, formData) {
  document.querySelectorAll('.reg-field').forEach(el => {
    const key = el.dataset.key;
    if (key) formData[key] = el.value;
  });
}

function validateStep(step) {
  const required = document.querySelectorAll('.reg-field[required]');
  let allValid = true;
  required.forEach(el => {
    if (!el.value) {
      el.classList.add('border-red-500');
      allValid = false;
    } else {
      el.classList.remove('border-red-500');
    }
  });

  if (!allValid) {
    showToast('Please fill in all required fields.', 'error');
  }
  return allValid;
}
