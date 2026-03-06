/**
 * Staff Role Selection Page — Choose registration role
 * Matches Stitch "Staff Role Selection - Dark Blue Theme" screen
 */
import { navigate } from '../router.js';

export async function renderRoleSelection() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-layout">
      <!-- Brand Panel -->
      <div class="auth-brand">
        <div class="auth-brand-content">
          <div class="auth-brand-logo">
            <span class="material-icons-outlined">group_add</span>
          </div>
          <h1>Join AIRA</h1>
          <p>Register as a new staff member or patient. Your role determines access permissions, 
             dashboard layout, and available tools within the system.</p>
        </div>
      </div>

      <!-- Role Selection Panel -->
      <div class="auth-form-wrapper" style="background: var(--gray-50);">
        <div style="width: 100%; max-width: 560px;">
          <h2>Select Your Role</h2>
          <p class="subtitle" style="color: var(--gray-500); margin-bottom: 32px;">
            Choose the primary role for registration. This determines your access permissions and dashboard.
          </p>

          <div class="role-cards">
            <!-- Nurse Role -->
            <div class="role-card" data-role="nurse" tabindex="0">
              <div class="role-card-icon" style="background: var(--info-light); color: #0369a1;">
                <span class="material-icons-outlined">local_hospital</span>
              </div>
              <div class="role-card-content">
                <h3>Nurse</h3>
                <p>Manage patient vitals, intake forms, and assist doctors in procedures. Access to nursing stations and patient logs.</p>
                <div class="role-tags">
                  <span class="badge badge-info">Vitals & Intake</span>
                  <span class="badge badge-info">Care Plans</span>
                </div>
              </div>
              <span class="material-icons-outlined role-card-arrow">arrow_forward</span>
            </div>

            <!-- Doctor Role -->
            <div class="role-card" data-role="doctor" tabindex="0">
              <div class="role-card-icon" style="background: var(--success-light); color: var(--success);">
                <span class="material-icons-outlined">stethoscope</span>
              </div>
              <div class="role-card-content">
                <h3>Doctor</h3>
                <p>Full access to patient records, prescriptions, and diagnosis tools. Authority to sign off on treatments.</p>
                <div class="role-tags">
                  <span class="badge badge-success">Diagnosis & Rx</span>
                  <span class="badge badge-success">Full History Access</span>
                </div>
              </div>
              <span class="material-icons-outlined role-card-arrow">arrow_forward</span>
            </div>

            <!-- Admin Role -->
            <div class="role-card" data-role="admin" tabindex="0">
              <div class="role-card-icon" style="background: var(--warning-light); color: #b45309;">
                <span class="material-icons-outlined">admin_panel_settings</span>
              </div>
              <div class="role-card-content">
                <h3>Admin</h3>
                <p>Manage clinic settings, billing, inventory, and staff accounts. System-wide configuration access.</p>
                <div class="role-tags">
                  <span class="badge badge-warning">Billing & Finance</span>
                  <span class="badge badge-warning">Staff Management</span>
                </div>
              </div>
              <span class="material-icons-outlined role-card-arrow">arrow_forward</span>
            </div>

            <!-- Divider -->
            <div style="display: flex; align-items: center; gap: 12px; margin: 20px 0;">
              <div style="flex: 1; height: 1px; background: var(--gray-200);"></div>
              <span style="font-size: 0.75rem; color: var(--gray-400); text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Or register as</span>
              <div style="flex: 1; height: 1px; background: var(--gray-200);"></div>
            </div>

            <!-- Patient Role -->
            <div class="role-card" data-role="patient" tabindex="0" style="border: 2px solid #7c3aed22;">
              <div class="role-card-icon" style="background: #f3e8ff; color: #7c3aed;">
                <span class="material-icons-outlined">person</span>
              </div>
              <div class="role-card-content">
                <h3>Patient</h3>
                <p>Access your health records, appointments, and prescriptions. View lab results and communicate with your care team.</p>
                <div class="role-tags">
                  <span class="badge" style="background: #f3e8ff; color: #7c3aed;">Health Records</span>
                  <span class="badge" style="background: #f3e8ff; color: #7c3aed;">Appointments</span>
                </div>
              </div>
              <span class="material-icons-outlined role-card-arrow">arrow_forward</span>
            </div>
          </div>

          <div style="margin-top: 24px; text-align: center;">
            <a href="#/login" style="font-size: 0.875rem; display: inline-flex; align-items: center; gap: 4px; color: var(--gray-500);">
              <span class="material-icons-outlined" style="font-size: 16px;">arrow_back</span>
              Already have an account? Sign in
            </a>
          </div>

          <div class="auth-footer">
            <p>AIRA Clinical Workflow • HIPAA Compliant</p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Role card click handlers
  document.querySelectorAll('.role-card').forEach(card => {
    card.addEventListener('click', () => {
      const role = card.dataset.role;
      if (role === 'patient') {
        navigate('/patient-register');
      } else {
        navigate(`/register?role=${role}`);
      }
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        card.click();
      }
    });
  });
}
