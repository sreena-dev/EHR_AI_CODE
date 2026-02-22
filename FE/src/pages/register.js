/**
 * Staff Registration — Multi-step wizard
 * Matches Stitch "Staff Registration - Doctor/Nurse Details" screens
 * Steps: Identity → Contact → Credentials → Deployment
 */
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';

const STEPS = [
    { id: 'identity', label: 'Identity Details', icon: 'person' },
    { id: 'contact', label: 'Contact Info', icon: 'contact_mail' },
    { id: 'credentials', label: 'Credentials', icon: 'badge' },
    { id: 'deployment', label: 'Deployment Info', icon: 'business' },
];

export async function renderRegister() {
    // Get role from URL hash params
    const hash = window.location.hash;
    const roleMatch = hash.match(/role=(\w+)/);
    const role = roleMatch ? roleMatch[1] : 'nurse';
    const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

    let currentStep = 0;
    const formData = { role };

    const app = document.getElementById('app');

    function render() {
        const progress = ((currentStep + 1) / STEPS.length) * 100;

        app.innerHTML = `
      <div class="auth-layout">
        <!-- Brand Panel -->
        <div class="auth-brand">
          <div class="auth-brand-content">
            <div class="auth-brand-logo">
              <span class="material-icons-outlined">${role === 'doctor' ? 'stethoscope' : role === 'admin' ? 'admin_panel_settings' : 'local_hospital'}</span>
            </div>
            <h1>${roleLabel} Registration</h1>
            <p>Step ${currentStep + 1} of ${STEPS.length}: ${STEPS[currentStep].label}</p>

            <!-- Step Progress -->
            <div class="reg-steps-sidebar">
              ${STEPS.map((step, i) => `
                <div class="reg-step-item ${i < currentStep ? 'completed' : ''} ${i === currentStep ? 'active' : ''} ${i > currentStep ? 'upcoming' : ''}">
                  <div class="reg-step-dot">
                    ${i < currentStep
                ? '<span class="material-icons-outlined" style="font-size: 16px;">check</span>'
                : `<span>${i + 1}</span>`
            }
                  </div>
                  <div class="reg-step-label">${step.label}</div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Form Panel -->
        <div class="auth-form-wrapper" style="align-items: flex-start; padding-top: 80px;">
          <div style="width: 100%; max-width: 520px;">
            <!-- Progress Bar -->
            <div class="reg-progress-bar">
              <div class="reg-progress-fill" style="width: ${progress}%"></div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span class="text-xs text-muted">Step ${currentStep + 1} of ${STEPS.length}</span>
              <span class="text-xs text-muted">${Math.round(progress)}% Complete</span>
            </div>

            <h2 style="margin-bottom: 4px;">${STEPS[currentStep].label}</h2>
            <p class="subtitle" style="margin-bottom: 28px;">${getStepDescription(currentStep, role)}</p>

            <form id="reg-form" autocomplete="off">
              ${renderStepFields(currentStep, role, formData)}

              <!-- Action Buttons -->
              <div style="display: flex; gap: 12px; margin-top: 32px;">
                ${currentStep > 0 ? `
                  <button type="button" id="prev-btn" class="btn btn-secondary" style="flex: 1;">
                    <span class="material-icons-outlined" style="font-size: 18px;">arrow_back</span>
                    Previous
                  </button>
                ` : `
                  <a href="#/register-role" class="btn btn-secondary" style="flex: 1; text-decoration: none;">
                    <span class="material-icons-outlined" style="font-size: 18px;">arrow_back</span>
                    Change Role
                  </a>
                `}
                <button type="submit" id="next-btn" class="btn btn-primary" style="flex: 2;">
                  ${currentStep < STEPS.length - 1 ? `
                    Continue
                    <span class="material-icons-outlined" style="font-size: 18px;">arrow_forward</span>
                  ` : `
                    <span class="material-icons-outlined" style="font-size: 18px;">check_circle</span>
                    Complete Registration
                  `}
                </button>
              </div>
            </form>

            <div class="auth-footer">
              <p>AIRA Clinical Workflow • HIPAA Compliant</p>
            </div>
          </div>
        </div>
      </div>
    `;

        // Event handlers
        const form = document.getElementById('reg-form');
        const prevBtn = document.getElementById('prev-btn');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                saveCurrentStep(currentStep, formData);
                currentStep--;
                render();
            });
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            saveCurrentStep(currentStep, formData);

            if (currentStep < STEPS.length - 1) {
                currentStep++;
                render();
                window.scrollTo(0, 0);
            } else {
                // Final submission
                showToast('Registration submitted successfully!', 'success');
                setTimeout(() => navigate('/activation-success'), 800);
            }
        });
    }

    render();
}

function getStepDescription(step, role) {
    const descriptions = [
        'Provide your full name and identification details.',
        'Enter your contact information for system notifications.',
        role === 'doctor'
            ? 'Provide your medical license and council registration details.'
            : role === 'nurse'
                ? 'Provide your professional license details and council registration.'
                : 'Provide your administrative credentials and authorization.',
        'Assign department, floor, and scheduling preferences.',
    ];
    return descriptions[step];
}

function renderStepFields(step, role, data) {
    switch (step) {
        case 0: return `
      <div class="form-group">
        <label class="form-label">Full Name</label>
        <input class="form-input reg-field" data-key="fullName" placeholder="Enter your full name" value="${data.fullName || ''}" required />
      </div>
      <div class="form-group" style="margin-top: 16px;">
        <label class="form-label">Name in Regional Script (Optional)</label>
        <input class="form-input reg-field" data-key="regionalName" placeholder="e.g. பிரியா சர்மா" value="${data.regionalName || ''}" />
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px;">
        <div class="form-group">
          <label class="form-label">Date of Birth</label>
          <input type="date" class="form-input reg-field" data-key="dob" value="${data.dob || ''}" required />
        </div>
        <div class="form-group">
          <label class="form-label">Gender</label>
          <select class="form-select reg-field" data-key="gender" required>
            <option value="">Select</option>
            <option ${data.gender === 'male' ? 'selected' : ''}>Male</option>
            <option ${data.gender === 'female' ? 'selected' : ''}>Female</option>
            <option ${data.gender === 'other' ? 'selected' : ''}>Other</option>
          </select>
        </div>
      </div>
      <div class="form-group" style="margin-top: 16px;">
        <label class="form-label">Government ID Number</label>
        <input class="form-input reg-field" data-key="govId" placeholder="Aadhaar / PAN / Passport" value="${data.govId || ''}" required />
      </div>
    `;

        case 1: return `
      <div class="form-group">
        <label class="form-label">
          <span class="material-icons-outlined" style="font-size:16px; vertical-align:middle;">email</span>
          Email Address
        </label>
        <input type="email" class="form-input reg-field" data-key="email" placeholder="staff@clinic.org" value="${data.email || ''}" required />
      </div>
      <div class="form-group" style="margin-top: 16px;">
        <label class="form-label">
          <span class="material-icons-outlined" style="font-size:16px; vertical-align:middle;">phone</span>
          Mobile Number
        </label>
        <input type="tel" class="form-input reg-field" data-key="phone" placeholder="+91 98765 43210" value="${data.phone || ''}" required />
      </div>
      <div class="form-group" style="margin-top: 16px;">
        <label class="form-label">Emergency Contact Name</label>
        <input class="form-input reg-field" data-key="emergencyName" placeholder="Full name" value="${data.emergencyName || ''}" />
      </div>
      <div class="form-group" style="margin-top: 16px;">
        <label class="form-label">Emergency Contact Phone</label>
        <input type="tel" class="form-input reg-field" data-key="emergencyPhone" placeholder="+91 ..." value="${data.emergencyPhone || ''}" />
      </div>
    `;

        case 2:
            if (role === 'doctor') return `
        <div class="card" style="margin-bottom: 20px;">
          <div class="card-body" style="display: flex; align-items: center; gap: 12px;">
            <span class="material-icons-outlined" style="color: var(--success);">verified</span>
            <div><span class="text-sm" style="font-weight: 600;">License verified with central medical council database</span></div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Medical License Number</label>
          <input class="form-input reg-field" data-key="license" placeholder="MCI / SMC License Number" value="${data.license || ''}" required />
        </div>
        <div class="form-group" style="margin-top: 16px;">
          <label class="form-label">Specialization</label>
          <select class="form-select reg-field" data-key="specialization" required>
            <option value="">Select specialization</option>
            <option>General Medicine</option>
            <option>Cardiology</option>
            <option>Pediatrics</option>
            <option>Orthopedics</option>
            <option>Dermatology</option>
            <option>Neurology</option>
            <option>Oncology</option>
            <option>Psychiatry</option>
          </select>
        </div>
        <div class="form-group" style="margin-top: 16px;">
          <label class="form-label">Years of Experience</label>
          <input type="number" class="form-input reg-field" data-key="experience" placeholder="e.g. 8" min="0" max="60" value="${data.experience || ''}" />
        </div>
        <div class="form-group" style="margin-top: 20px;">
          <label class="form-label">Medical Degree Certificate</label>
          <div class="upload-area" id="cert-upload" style="padding: 24px;">
            <span class="material-icons-outlined">upload_file</span>
            <p style="font-size: 0.875rem; color: var(--gray-600); margin-top: 8px;">Drop your certificate here or click to browse</p>
            <p class="text-xs text-muted">PDF or JPG up to 10MB</p>
            <input type="file" id="cert-file" accept=".pdf,.jpg,.jpeg,.png" style="display:none;" />
          </div>
        </div>
      `;
            if (role === 'nurse') return `
        <div class="card" style="margin-bottom: 20px;">
          <div class="card-body" style="display: flex; align-items: center; gap: 12px;">
            <span class="material-icons-outlined" style="color: var(--success);">verified</span>
            <div><span class="text-sm" style="font-weight: 600;">License verified with central council database</span></div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Nursing License Number</label>
          <input class="form-input reg-field" data-key="license" placeholder="Nursing Council Registration" value="${data.license || ''}" required />
        </div>
        <div class="form-group" style="margin-top: 16px;">
          <label class="form-label">Qualification</label>
          <select class="form-select reg-field" data-key="qualification" required>
            <option value="">Select qualification</option>
            <option>B.Sc Nursing</option>
            <option>M.Sc Nursing</option>
            <option>GNM</option>
            <option>ANM</option>
            <option>Post-Basic Nursing</option>
          </select>
        </div>
        <div class="form-group" style="margin-top: 20px;">
          <label class="form-label">Nursing Degree Certificate</label>
          <div class="upload-area" id="cert-upload" style="padding: 24px;">
            <span class="material-icons-outlined">upload_file</span>
            <p style="font-size: 0.875rem; color: var(--gray-600); margin-top: 8px;">Drop your certificate here or click to browse</p>
            <p class="text-xs text-muted">PDF or JPG up to 10MB</p>
            <input type="file" id="cert-file" accept=".pdf,.jpg,.jpeg,.png" style="display:none;" />
          </div>
        </div>
        <div class="form-group" style="margin-top: 20px;">
          <label class="form-label">Valid Registration Card</label>
          <div class="upload-area" id="reg-upload" style="padding: 24px;">
            <span class="material-icons-outlined">upload_file</span>
            <p style="font-size: 0.875rem; color: var(--gray-600); margin-top: 8px;">Both sides required</p>
            <p class="text-xs text-muted">PDF or JPG up to 10MB</p>
            <input type="file" id="reg-file" accept=".pdf,.jpg,.jpeg,.png" style="display:none;" />
          </div>
        </div>
      `;
            // Admin
            return `
        <div class="form-group">
          <label class="form-label">Admin Authorization Code</label>
          <input class="form-input reg-field" data-key="authCode" placeholder="Provided by hospital IT" value="${data.authCode || ''}" required />
        </div>
        <div class="form-group" style="margin-top: 16px;">
          <label class="form-label">Department</label>
          <select class="form-select reg-field" data-key="department" required>
            <option value="">Select department</option>
            <option>Hospital Administration</option>
            <option>Finance & Billing</option>
            <option>Human Resources</option>
            <option>IT & Systems</option>
          </select>
        </div>
        <div class="form-group" style="margin-top: 16px;">
          <label class="form-label">Access Level</label>
          <select class="form-select reg-field" data-key="accessLevel" required>
            <option value="">Select access level</option>
            <option>Standard Admin</option>
            <option>Super Admin</option>
          </select>
        </div>
      `;

        case 3: return `
      <div class="form-group">
        <label class="form-label">Assigned Department / Ward</label>
        <select class="form-select reg-field" data-key="ward" required>
          <option value="">Select department</option>
          <option>General Medicine (Floor 1)</option>
          <option>Pediatric Ward (Floor 3)</option>
          <option>ICU (Floor 4)</option>
          <option>Emergency Department</option>
          <option>Outpatient Clinic</option>
          <option>Surgery (Floor 2)</option>
        </select>
      </div>
      <div class="form-group" style="margin-top: 16px;">
        <label class="form-label">Preferred Shift</label>
        <select class="form-select reg-field" data-key="shift" required>
          <option value="">Select preferred shift</option>
          <option>Morning (6:00 AM – 2:00 PM)</option>
          <option>Afternoon (2:00 PM – 10:00 PM)</option>
          <option>Night (10:00 PM – 6:00 AM)</option>
          <option>Rotating</option>
        </select>
      </div>
      <div class="form-group" style="margin-top: 16px;">
        <label class="form-label">Start Date</label>
        <input type="date" class="form-input reg-field" data-key="startDate" value="${data.startDate || ''}" required />
      </div>
      <div class="form-group" style="margin-top: 16px;">
        <label class="form-label">Staff ID (auto-generated)</label>
        <input class="form-input" value="${role === 'doctor' ? 'DOC-' : role === 'nurse' ? 'NUR-' : 'ADM-'}${Math.floor(100 + Math.random() * 900)}" readonly style="background: var(--gray-50); color: var(--gray-500);" />
      </div>

      <!-- Summary Card -->
      <div class="card" style="margin-top: 24px; border-color: var(--primary-200); background: var(--primary-50);">
        <div class="card-body" style="padding: 16px 20px;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
            <span class="material-icons-outlined" style="font-size: 18px; color: var(--primary-600);">info</span>
            <span style="font-weight: 600; font-size: 0.875rem; color: var(--primary-700);">Registration Summary</span>
          </div>
          <div style="font-size: 0.8125rem; color: var(--primary-700); line-height: 1.8;">
            <div><strong>Name:</strong> ${data.fullName || '—'}</div>
            <div><strong>Role:</strong> ${role.charAt(0).toUpperCase() + role.slice(1)}</div>
            <div><strong>Email:</strong> ${data.email || '—'}</div>
            <div><strong>License:</strong> ${data.license || data.authCode || '—'}</div>
          </div>
        </div>
      </div>
    `;

        default: return '';
    }
}

function saveCurrentStep(step, formData) {
    document.querySelectorAll('.reg-field').forEach(el => {
        const key = el.dataset.key;
        if (key) formData[key] = el.value;
    });
}
