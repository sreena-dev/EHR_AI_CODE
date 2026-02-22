/**
 * Activation Success Page — Staff account activated
 * Matches Stitch "Doctor/Nurse Activation Success" screens
 */
import { navigate } from '../router.js';

export async function renderActivationSuccess() {
    // Mock data — in production this would come from registration response
    const staffData = {
        name: 'Priya Sharma',
        regionalName: 'பிரியா சர்மா',
        role: 'Registered Nurse',
        staffId: 'NUR-143',
        email: 'priya.sharma@chennai-clinic.org',
        phone: '+91 98765 43210',
        department: 'Pediatric Ward (Floor 3)',
        clinic: 'Chennai City Clinic',
    };

    const app = document.getElementById('app');
    app.innerHTML = `
    <div class="auth-layout">
      <!-- Brand Panel -->
      <div class="auth-brand" style="background: linear-gradient(145deg, #059669 0%, #10b981 50%, #34d399 100%);">
        <div class="auth-brand-content">
          <div class="auth-brand-logo" style="background: rgba(255,255,255,0.2);">
            <span class="material-icons-outlined">celebration</span>
          </div>
          <h1>Welcome Aboard!</h1>
          <p>Your account has been created and activated. You're all set to start using AIRA Clinical Workflow.</p>

          <!-- Staff ID Card -->
          <div class="staff-id-card">
            <div class="staff-id-header">
              <span class="material-icons-outlined" style="font-size: 20px;">favorite</span>
              <span style="font-weight: 700; font-size: 0.875rem;">${staffData.clinic}</span>
            </div>
            <div class="staff-id-body">
              <div class="staff-id-avatar">
                <span class="material-icons-outlined" style="font-size: 36px; color: var(--primary-500);">person</span>
              </div>
              <div class="staff-id-name">${staffData.name}</div>
              <div class="staff-id-regional">${staffData.regionalName}</div>
              <div class="staff-id-role">${staffData.role}</div>
              <div class="staff-id-code">ID: ${staffData.staffId}</div>
              <div class="staff-id-qr">
                <span class="material-icons-outlined" style="font-size: 48px; color: var(--gray-400);">qr_code_2</span>
                <p class="text-xs text-muted" style="margin-top: 4px;">Scan for verification</p>
              </div>
            </div>
            <div class="staff-id-footer">
              <span class="text-xs">Official Digital Staff ID Card</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Details Panel -->
      <div class="auth-form-wrapper">
        <div class="auth-form" style="max-width: 480px;">
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="width: 64px; height: 64px; border-radius: 50%; background: var(--success-light); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
              <span class="material-icons-outlined" style="font-size: 32px; color: var(--success);">check_circle</span>
            </div>
            <h2>Activation Successful!</h2>
            <p class="subtitle">Welcome to the team, ${staffData.name.split(' ')[0]}. Your credentials are now active.</p>
          </div>

          <!-- Account Summary -->
          <div class="card" style="margin-bottom: 24px;">
            <div class="card-header" style="border-bottom: 1px solid var(--gray-100);">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="material-icons-outlined" style="font-size: 18px; color: var(--primary-500);">contact_mail</span>
                <span style="font-weight: 600; font-size: 0.9375rem;">Account Summary</span>
              </div>
            </div>
            <div class="card-body" style="padding: 0;">
              <div class="summary-row">
                <span class="summary-label">Email Address</span>
                <span class="summary-value">${staffData.email}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Contact Number</span>
                <span class="summary-value">${staffData.phone}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Department</span>
                <span class="summary-value">${staffData.department}</span>
              </div>
              <div class="summary-row">
                <span class="summary-label">Staff ID</span>
                <span class="summary-value" style="font-weight: 700; color: var(--primary-600);">${staffData.staffId}</span>
              </div>
            </div>
          </div>

          <div class="alert alert-info" style="margin-bottom: 24px;">
            <span class="material-icons-outlined" style="font-size: 18px;">help_outline</span>
            <span>Need help? Contact hospital IT support at <strong>ext-555</strong> or <a href="mailto:support@chennai-clinic.org">support@chennai-clinic.org</a></span>
          </div>

          <a href="#/login" class="btn btn-primary btn-lg btn-block" style="text-decoration: none;">
            <span class="material-icons-outlined" style="font-size: 18px;">login</span>
            Go to Login
          </a>

          <div class="auth-footer">
            <p>AIRA Clinical Workflow • HIPAA Compliant</p>
          </div>
        </div>
      </div>
    </div>
  `;
}
