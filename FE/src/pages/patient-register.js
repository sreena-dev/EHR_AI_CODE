/**
 * Patient Registration — Multi-step wizard
 * Design mirrors Staff Registration with patient-specific fields
 * Steps: Personal Info → Medical Info → Account Setup
 */
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';

const STEPS = [
  { id: 'personal', label: 'Personal Information', subtitle: 'Basic details', icon: 'person' },
  { id: 'identity', label: 'ABDM & Identity', subtitle: 'Health ID details', icon: 'badge' },
  { id: 'medical', label: 'Medical Information', subtitle: 'Health details', icon: 'medical_information' },
  { id: 'account', label: 'Account Setup', subtitle: 'Create password', icon: 'lock' },
];

export async function renderPatientRegister() {
  let currentStep = 0;
  const formData = {};

  const app = document.getElementById('app');

  function render() {
    app.innerHTML = `
      <div class="flex flex-col min-h-screen bg-slate-50">
        <!-- Sticky Header -->
        <header class="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div class="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8">
            <div class="flex justify-between h-16 items-center">
              <div class="flex items-center gap-4">
                <button id="back-btn" class="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer border-none bg-transparent">
                  <span class="material-icons">arrow_back</span>
                </button>
                <div>
                  <h1 class="text-lg font-semibold text-slate-900">Patient Registration</h1>
                  <p class="text-xs text-slate-500">Create your patient portal account</p>
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

            <div class="mt-12 p-4 bg-slate-50 rounded-xl border border-slate-200">
              <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Important</p>
              <p class="text-xs text-slate-500 leading-relaxed">
                <span class="material-icons text-sm text-primary align-middle">info</span>
                Your information is protected under HIPAA regulations. All data is encrypted and stored securely.
              </p>
            </div>
          </aside>

          <!-- Main Form Area -->
          <main class="flex-grow py-8 px-4 sm:px-6 lg:px-12">
            <div class="max-w-4xl space-y-8">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-2xl font-bold text-slate-900">${STEPS[currentStep].label}</h2>
                  <p class="text-slate-500 mt-1">${getStepDescription(currentStep)}</p>
                </div>
                <div class="hidden md:block">
                  <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary/10 text-primary border border-primary/20">
                    <span class="material-icons text-base mr-1.5">${STEPS[currentStep].icon}</span>
                    Step ${currentStep + 1} of ${STEPS.length}
                  </span>
                </div>
              </div>

              <form id="patient-reg-form" class="space-y-8 pb-24" autocomplete="off">
                ${renderStepFields(currentStep, formData)}
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
            <button id="next-btn" class="inline-flex items-center px-6 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-primary hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all transform active:scale-95 cursor-pointer" type="button">
              ${currentStep < STEPS.length - 1 ? 'Next' : 'Create Account'}
              <span class="material-icons text-sm ml-2">${currentStep < STEPS.length - 1 ? 'arrow_forward' : ''}</span>
            </button>
          </div>
        </div>
      </div>
    `;

    // Event Bindings
    document.getElementById('back-btn').onclick = () => {
      if (currentStep === 0) {
        navigate('/patient-login');
      } else {
        saveFormFields(formData);
        currentStep--;
        render();
        window.scrollTo(0, 0);
      }
    };

    const prevBtn = document.getElementById('prev-btn');
    if (currentStep === 0) {
      prevBtn.onclick = () => navigate('/patient-login');
    } else {
      prevBtn.onclick = () => {
        saveFormFields(formData);
        currentStep--;
        render();
        window.scrollTo(0, 0);
      };
    }

    document.getElementById('next-btn').onclick = async () => {
      if (!validateStep(currentStep)) return;
      saveFormFields(formData);

      if (currentStep < STEPS.length - 1) {
        currentStep++;
        render();
        window.scrollTo(0, 0);
      } else {
        // Submit registration
        await submitRegistration(formData);
      }
    };

    // Password strength logic (step 3)
    if (currentStep === 3) {
      const passwordInput = document.getElementById('reg-password');
      const confirmInput = document.getElementById('reg-confirm-password');

      const updateRequirements = () => {
        const pwd = passwordInput.value;
        const confirm = confirmInput.value;

        const reqs = {
          length: pwd.length >= 8,
          special: /[!@#$%^&*(),.?":{}|<>]/.test(pwd),
          number: /[0-9]/.test(pwd),
          upper: /[A-Z]/.test(pwd),
          match: pwd && pwd === confirm
        };

        Object.entries(reqs).forEach(([key, met]) => {
          const el = document.getElementById(`req-${key}`);
          if (!el) return;
          el.className = `flex items-center gap-2 text-sm ${met ? 'text-emerald-600' : 'text-slate-400'} transition-colors`;
          el.querySelector('.material-icons').textContent = met ? 'check_circle' : 'radio_button_unchecked';
        });

        // Strength Bar
        const strengthPoints = [
          reqs.length, reqs.special, reqs.number,
          reqs.upper, /[a-z]/.test(pwd), pwd.length >= 14
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
        } else {
          const level = levels[Math.min(strengthPoints - 1, 5)] || levels[0];
          strengthBar.style.width = level.width;
          strengthBar.className = `h-full ${level.color} transition-all duration-300`;
          strengthText.textContent = level.text;
        }
      };

      passwordInput.oninput = updateRequirements;
      confirmInput.oninput = updateRequirements;
    }
  }

  render();
}


function getStepDescription(step) {
  const descriptions = [
    'Please provide your personal details and contact information.',
    'Provide your India Health ID (ABHA) and identity proof for ABDM compliance.',
    'Enter your medical information for accurate healthcare services.',
    'Set up your login credentials and provide required consents.',
  ];
  return descriptions[step];
}


function renderStepFields(step, data) {
  switch (step) {
    case 0: // Personal Information
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
              <label class="block text-sm font-medium text-slate-700 mb-1.5" for="fullName">Full Name *</label>
              <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" id="fullName" data-key="full_name" placeholder="Enter your full name" type="text" value="${data.full_name || ''}" required />
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5" for="dob">Date of Birth *</label>
              <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" type="date" id="dob" data-key="dob" value="${data.dob || ''}" required />
              <p class="mt-1 text-xs text-slate-500">Age will be auto-calculated from DOB</p>
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5" for="gender">Gender *</label>
              <select class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" id="gender" data-key="gender" required>
                <option value="">Select Gender</option>
                <option ${data.gender === 'M' ? 'selected' : ''} value="M">Male</option>
                <option ${data.gender === 'F' ? 'selected' : ''} value="F">Female</option>
                <option ${data.gender === 'O' ? 'selected' : ''} value="O">Other</option>
                <option ${data.gender === 'U' ? 'selected' : ''} value="U">Prefer Not to Say</option>
              </select>
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5" for="phone">Phone Number *</label>
              <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" type="tel" id="phone" data-key="phone" placeholder="+91 98765 43210" value="${data.phone || ''}" required />
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5" for="email">Email Address</label>
              <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" type="email" id="email" data-key="email" placeholder="patient@example.com" value="${data.email || ''}" />
              <p class="mt-1 text-xs text-slate-500">Optional — used for appointment reminders</p>
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5" for="fatherName">Father/Guardian Name *</label>
              <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" id="fatherName" data-key="father_name" placeholder="Required for ABDM" type="text" value="${data.father_name || ''}" required />
            </div>
            <div class="col-span-1 md:col-span-2">
              <label class="block text-sm font-medium text-slate-700 mb-1.5" for="address">Address *</label>
              <textarea class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary reg-field" id="address" data-key="address" placeholder="Enter your full residential address" rows="3" required>${data.address || ''}</textarea>
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5" for="district">District *</label>
              <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" id="district" data-key="district" placeholder="District" type="text" value="${data.district || ''}" required />
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5" for="state">State *</label>
              <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" id="state" data-key="state" placeholder="State" type="text" value="${data.state || ''}" required />
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5" for="pincode">Pincode *</label>
              <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" id="pincode" data-key="pincode" placeholder="6-digit PIN" type="text" value="${data.pincode || ''}" required />
            </div>
          </div>
        </div>
      `;

    case 1: // ABDM Identity
      return `
        <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6 md:p-8">
          <div class="flex items-center mb-6">
            <h3 class="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <span class="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                <span class="material-icons text-lg">badge</span>
              </span>
              ABHA & Identity Verification
            </h3>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5" for="abhaNumber">ABHA Number</label>
              <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" type="text" id="abhaNumber" data-key="abha_number" placeholder="14-digit ABHA (e.g. 91-1234-5678-9012)" value="${data.abha_number || ''}" />
              <p class="mt-1 text-xs text-slate-500">Optional but recommended for digital health records</p>
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5" for="abhaAddress">ABHA Address</label>
              <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" type="text" id="abhaAddress" data-key="abha_address" placeholder="e.g. yourname@abdm" value="${data.abha_address || ''}" />
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5" for="idProofType">ID Proof Type</label>
              <select class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" id="idProofType" data-key="id_proof_type">
                <option value="">Select ID Type</option>
                <option ${data.id_proof_type === 'aadhaar' ? 'selected' : ''} value="aadhaar">Aadhaar Card</option>
                <option ${data.id_proof_type === 'driving_license' ? 'selected' : ''} value="driving_license">Driving License</option>
                <option ${data.id_proof_type === 'voter_id' ? 'selected' : ''} value="voter_id">Voter ID</option>
              </select>
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5" for="idProofNumber">ID Proof Number</label>
              <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" type="text" id="idProofNumber" data-key="id_proof_number" placeholder="Enter ID number" value="${data.id_proof_number || ''}" />
            </div>
          </div>
        </div>
      `;

    case 2: // Medical Information
      return `
        <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6 md:p-8">
          <div class="flex items-center mb-6">
            <h3 class="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <span class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                <span class="material-icons text-lg">medical_information</span>
              </span>
              Health Information
            </h3>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5" for="bloodGroup">Blood Group</label>
              <select class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" id="bloodGroup" data-key="blood_group">
                <option value="">Select Blood Group</option>
                <option ${data.blood_group === 'A+' ? 'selected' : ''}>A+</option>
                <option ${data.blood_group === 'A-' ? 'selected' : ''}>A-</option>
                <option ${data.blood_group === 'B+' ? 'selected' : ''}>B+</option>
                <option ${data.blood_group === 'B-' ? 'selected' : ''}>B-</option>
                <option ${data.blood_group === 'AB+' ? 'selected' : ''}>AB+</option>
                <option ${data.blood_group === 'AB-' ? 'selected' : ''}>AB-</option>
                <option ${data.blood_group === 'O+' ? 'selected' : ''}>O+</option>
                <option ${data.blood_group === 'O-' ? 'selected' : ''}>O-</option>
              </select>
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5" for="insuranceId">Insurance / Health ID</label>
              <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" type="text" id="insuranceId" data-key="insurance_id" placeholder="e.g. AYUSHMAN-12345" value="${data.insurance_id || ''}" />
              <p class="mt-1 text-xs text-slate-500">Optional — Aadhar, ABHA, or insurance number</p>
            </div>
            <div class="col-span-1 md:col-span-2">
              <label class="block text-sm font-medium text-slate-700 mb-1.5" for="allergies">
                <span class="material-icons text-sm text-error align-middle mr-1">warning</span>
                Known Allergies
              </label>
              <textarea class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary reg-field" id="allergies" data-key="allergies" placeholder="List any drug allergies, food allergies, or latex allergies (e.g. Penicillin, Sulfa drugs, Peanuts)" rows="3">${data.allergies || ''}</textarea>
              <p class="mt-1 text-xs text-red-500 font-medium">
                <span class="material-icons text-xs align-middle">info</span>
                Critical for patient safety — please list ALL known allergies
              </p>
            </div>
            <div class="col-span-1 md:col-span-2">
              <label class="block text-sm font-medium text-slate-700 mb-1.5" for="medicalHistory">Medical History / Chronic Conditions</label>
              <textarea class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary reg-field" id="medicalHistory" data-key="medical_history" placeholder="List any chronic conditions (e.g. Diabetes Type 2, Hypertension, Asthma, Thyroid disorders)" rows="3">${data.medical_history || ''}</textarea>
            </div>
          </div>
        </div>

        <!-- Emergency Contact -->
        <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6 md:p-8">
          <div class="flex items-center mb-6">
            <h3 class="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <span class="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center text-red-600">
                <span class="material-icons text-lg">emergency</span>
              </span>
              Emergency Contact
            </h3>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5" for="emergencyName">Emergency Contact Name *</label>
              <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" type="text" id="emergencyName" data-key="emergency_contact_name" placeholder="Full name of emergency contact" value="${data.emergency_contact_name || ''}" required />
            </div>
            <div class="col-span-1">
              <label class="block text-sm font-medium text-slate-700 mb-1.5" for="emergencyPhone">Emergency Contact Phone *</label>
              <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" type="tel" id="emergencyPhone" data-key="emergency_contact_phone" placeholder="+91 98765 43210" value="${data.emergency_contact_phone || ''}" required />
            </div>
          </div>
          <div class="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p class="text-xs text-amber-800 flex items-center gap-2">
              <span class="material-icons text-sm">info</span>
              Emergency contact information is required by medical standards and will only be used in case of a medical emergency.
            </p>
          </div>
        </div>
      `;

    case 3: // Account Setup & Consent
      return `
        <div class="space-y-8">
          <!-- Password Setup -->
          <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6 md:p-8">
            <h3 class="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-6">
              <span class="material-icons text-primary">security</span>
              Set Your Password
            </h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1.5" for="reg-password">Password *</label>
                  <div class="relative">
                    <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" id="reg-password" data-key="password" placeholder="Create a strong password" type="password" required />
                    <button class="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer" type="button" onclick="const input = this.previousElementSibling; input.type = input.type === 'password' ? 'text' : 'password'; this.firstElementChild.textContent = input.type === 'password' ? 'visibility' : 'visibility_off'">
                      <span class="material-icons text-sm">visibility</span>
                    </button>
                  </div>
                  <div class="mt-2 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div id="strength-bar" class="h-full bg-slate-300 transition-all duration-300" style="width: 0%"></div>
                  </div>
                  <p id="strength-text" class="mt-1 text-xs text-slate-500 font-medium text-right">Start typing...</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-slate-700 mb-1.5" for="reg-confirm-password">Confirm Password *</label>
                  <input class="block w-full rounded-lg border-slate-300 text-slate-900 shadow-sm focus:border-primary focus:ring-primary h-11 reg-field" id="reg-confirm-password" data-key="confirm_password" placeholder="Re-enter your password" type="password" required />
                </div>
              </div>
              <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Security Requirements</h4>
                <ul class="space-y-2">
                  <li id="req-length" class="flex items-center gap-2 text-sm text-slate-400 transition-colors">
                    <span class="material-icons text-base">radio_button_unchecked</span>
                    Minimum 8 characters
                  </li>
                  <li id="req-upper" class="flex items-center gap-2 text-sm text-slate-400 transition-colors">
                    <span class="material-icons text-base">radio_button_unchecked</span>
                    At least one uppercase letter
                  </li>
                  <li id="req-number" class="flex items-center gap-2 text-sm text-slate-400 transition-colors">
                    <span class="material-icons text-base">radio_button_unchecked</span>
                    At least one number
                  </li>
                  <li id="req-special" class="flex items-center gap-2 text-sm text-slate-400 transition-colors">
                    <span class="material-icons text-base">radio_button_unchecked</span>
                    At least one special character
                  </li>
                  <li id="req-match" class="flex items-center gap-2 text-sm text-slate-400 transition-colors">
                    <span class="material-icons text-base">radio_button_unchecked</span>
                    Both passwords match
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <!-- Consent -->
          <div class="bg-white shadow-sm border border-slate-200 rounded-xl p-6 md:p-8">
            <h3 class="text-lg font-semibold text-slate-900 flex items-center gap-2 mb-6">
              <span class="material-icons text-primary">gavel</span>
              Patient Consent & Terms
            </h3>
            <div class="space-y-6">
              <div class="bg-slate-50 rounded-lg border border-slate-200 p-4 h-48 overflow-y-auto text-sm text-slate-600 leading-relaxed">
                <p class="mb-4 font-bold text-slate-900">Patient Portal Terms & Privacy Notice</p>
                <p class="mb-4">By creating an account on the AIRA Patient Portal, you acknowledge and agree to the following:</p>
                <p class="mb-4">1. <strong>Data Usage:</strong> Your personal and medical information will be used solely for the purpose of providing healthcare services, managing appointments, and maintaining accurate health records.</p>
                <p class="mb-4">2. <strong>Privacy:</strong> All data is stored and transmitted in compliance with the Health Insurance Portability and Accountability Act (HIPAA). Your information will not be shared with third parties without your explicit consent, except as required by law.</p>
                <p class="mb-4">3. <strong>Security:</strong> You are responsible for maintaining the confidentiality of your login credentials. Report any unauthorized access immediately to the clinic administration.</p>
                <p class="mb-4">4. <strong>Accuracy:</strong> You confirm that all information provided during registration is accurate and complete to the best of your knowledge. Inaccurate medical information may affect the quality of care provided.</p>
                <p>5. <strong>Emergency Access:</strong> In case of a medical emergency, your health records may be accessed by authorized healthcare providers to ensure your safety.</p>
              </div>
              <div class="flex items-start gap-3">
                <div class="flex items-center h-5">
                  <input class="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary reg-field" id="consentHealthData" data-key="consent_health_data" type="checkbox" ${data.consent_health_data ? 'checked' : ''} required />
                </div>
                <div class="text-sm">
                  <label class="font-medium text-slate-700" for="consentHealthData">I consent to the collection and storage of my health data. *</label>
                  <p class="text-slate-500 font-normal text-xs">Required for clinic operations and maintaining your medical history.</p>
                </div>
              </div>
              
              <div class="flex items-start gap-3 mt-4">
                <div class="flex items-center h-5">
                  <input class="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary reg-field" id="consentDataSharing" data-key="consent_data_sharing" type="checkbox" ${data.consent_data_sharing ? 'checked' : ''} />
                </div>
                <div class="text-sm">
                  <label class="font-medium text-slate-700" for="consentDataSharing">I consent to linking my records with the Ayushman Bharat Digital Mission (ABDM).</label>
                  <p class="text-slate-500 font-normal text-xs">Optional. Allows sharing records with other doctors via your ABHA ID.</p>
                </div>
              </div>
              
              <div class="flex items-start gap-3 mt-4 pt-4 border-t border-slate-100">
                <div class="flex items-center h-5">
                  <input class="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary reg-field" id="agreement" data-key="agreement" type="checkbox" required />
                </div>
                <div class="text-sm">
                  <label class="font-medium text-slate-700" for="agreement">I agree to the Terms of Service and Privacy Policy. *</label>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

    default: return '';
  }
}


function saveFormFields(formData) {
  document.querySelectorAll('.reg-field').forEach(el => {
    const key = el.dataset.key;
    if (key) {
      if (el.type === 'checkbox') {
        formData[key] = el.checked;
      } else {
        formData[key] = el.value;
      }
    }
  });
}


function validateStep(step) {
  const required = document.querySelectorAll('.reg-field[required]');
  let allValid = true;
  required.forEach(el => {
    if (el.type === 'checkbox') {
      if (!el.checked) {
        el.closest('.flex')?.classList.add('ring-2', 'ring-red-300', 'rounded');
        allValid = false;
      } else {
        el.closest('.flex')?.classList.remove('ring-2', 'ring-red-300', 'rounded');
      }
    } else if (!el.value) {
      el.classList.add('border-red-500');
      allValid = false;
    } else {
      el.classList.remove('border-red-500');
    }
  });

  // Password validation on step 3
  if (step === 3) {
    const pwd = document.getElementById('reg-password')?.value || '';
    const confirm = document.getElementById('reg-confirm-password')?.value || '';

    if (pwd.length < 8) {
      showToast('Password must be at least 8 characters.', 'error');
      return false;
    }
    if (!/[A-Z]/.test(pwd)) {
      showToast('Password must contain an uppercase letter.', 'error');
      return false;
    }
    if (!/[a-z]/.test(pwd)) {
      showToast('Password must contain a lowercase letter.', 'error');
      return false;
    }
    if (!/[0-9]/.test(pwd)) {
      showToast('Password must contain a digit.', 'error');
      return false;
    }
    if (pwd !== confirm) {
      showToast('Passwords do not match.', 'error');
      return false;
    }
  }

  if (!allValid) {
    showToast('Please fill in all required fields.', 'error');
  }
  return allValid;
}


async function submitRegistration(formData) {
  const nextBtn = document.getElementById('next-btn');
  nextBtn.disabled = true;
  nextBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Creating Account...';

  try {
    const payload = {
      full_name: formData.full_name,
      dob: formData.dob,
      gender: formData.gender,
      phone: formData.phone,
      email: formData.email || null,
      address: formData.address,
      district: formData.district || null,
      state: formData.state || null,
      pincode: formData.pincode || null,
      father_name: formData.father_name || null,
      abha_number: formData.abha_number || null,
      abha_address: formData.abha_address || null,
      id_proof_type: formData.id_proof_type || null,
      id_proof_number: formData.id_proof_number || null,
      blood_group: formData.blood_group || null,
      allergies: formData.allergies || null,
      medical_history: formData.medical_history || null,
      emergency_contact_name: formData.emergency_contact_name,
      emergency_contact_phone: formData.emergency_contact_phone,
      insurance_id: formData.insurance_id || null,
      consent_health_data: !!formData.consent_health_data,
      consent_data_sharing: !!formData.consent_data_sharing,
      password: formData.password,
    };

    const res = await fetch('/api/auth/patient/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.detail || data.message || 'Registration failed');
    }

    showToast(`Registration successful! Your Patient ID is ${data.patient_id}. Please login.`, 'success');
    setTimeout(() => navigate('/patient-login'), 1500);

  } catch (err) {
    showToast(err.message || 'Registration failed. Please try again.', 'error');
    nextBtn.disabled = false;
    nextBtn.innerHTML = 'Create Account';
  }
}
