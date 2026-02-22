/**
 * Forgot Password Page — Request Reset & Success Confirmation
 * Matches Stitch "Forgot Password" screens
 */
import { navigate } from '../router.js';

export async function renderForgotPassword() {
    const app = document.getElementById('app');
    app.innerHTML = `
    <div class="auth-layout">
      <!-- Brand Panel -->
      <div class="auth-brand">
        <div class="auth-brand-content">
          <div class="auth-brand-logo">
            <span class="material-icons-outlined">lock_reset</span>
          </div>
          <h1>AIRA Clinical Workflow</h1>
          <p>Secure password recovery for staff members. 
             Your account security is our top priority — all reset links are encrypted and expire after 15 minutes.</p>

          <div style="margin-top: 48px; display: flex; gap: 32px; justify-content: center;">
            <div style="text-align: center;">
              <span class="material-icons-outlined" style="font-size: 28px; opacity: 0.8;">verified_user</span>
              <div style="font-size: 0.8125rem; opacity: 0.75; margin-top: 6px;">Encrypted</div>
            </div>
            <div style="text-align: center;">
              <span class="material-icons-outlined" style="font-size: 28px; opacity: 0.8;">timer</span>
              <div style="font-size: 0.8125rem; opacity: 0.75; margin-top: 6px;">15min Expiry</div>
            </div>
            <div style="text-align: center;">
              <span class="material-icons-outlined" style="font-size: 28px; opacity: 0.8;">shield</span>
              <div style="font-size: 0.8125rem; opacity: 0.75; margin-top: 6px;">HIPAA Safe</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Form Panel -->
      <div class="auth-form-wrapper">
        <div class="auth-form">
          <!-- Request Form State -->
          <div id="reset-request-view">
            <h2>Request Password Reset</h2>
            <p class="subtitle">Enter your credentials to receive a secure recovery link.</p>

            <div id="reset-error" class="alert alert-error" style="display:none;"></div>

            <form id="reset-form" autocomplete="off">
              <div class="form-group">
                <label class="form-label" for="reset-staff-id">
                  <span class="material-icons-outlined" style="font-size:16px; vertical-align: middle;">badge</span>
                  Staff ID
                </label>
                <input type="text" id="reset-staff-id" class="form-input" placeholder="Enter your staff ID" required autofocus />
              </div>

              <div class="form-group" style="margin-top: 16px;">
                <label class="form-label" for="reset-email">
                  <span class="material-icons-outlined" style="font-size:16px; vertical-align: middle;">email</span>
                  Registered Email
                </label>
                <input type="email" id="reset-email" class="form-input" placeholder="Enter your registered email" required />
              </div>

              <button type="submit" id="reset-btn" class="btn btn-primary btn-lg btn-block" style="margin-top: 24px;">
                <span id="reset-text">Send Reset Link</span>
                <span id="reset-spinner" class="spinner" style="display:none;"></span>
              </button>
            </form>

            <div style="margin-top: 20px; text-align: center;">
              <a href="#/login" style="font-size: 0.875rem; display: inline-flex; align-items: center; gap: 4px;">
                <span class="material-icons-outlined" style="font-size: 16px;">arrow_back</span>
                Back to Login
              </a>
            </div>
          </div>

          <!-- Success Confirmation State -->
          <div id="reset-success-view" style="display: none; text-align: center;">
            <div style="width: 72px; height: 72px; border-radius: 50%; background: var(--success-light); display: flex; align-items: center; justify-content: center; margin: 0 auto 24px;">
              <span class="material-icons-outlined" style="font-size: 36px; color: var(--success);">mark_email_read</span>
            </div>
            <h2>Check your email</h2>
            <p class="subtitle" style="margin-top: 8px; max-width: 360px; margin-left: auto; margin-right: auto;">
              If an account exists for this Staff ID, a password reset link has been sent to your registered email address.
            </p>

            <div class="card" style="margin-top: 24px; text-align: left;">
              <div class="card-body" style="padding: 16px 20px;">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                  <span class="material-icons-outlined" style="font-size: 18px; color: var(--info);">info</span>
                  <span style="font-weight: 600; font-size: 0.875rem;">What to do next:</span>
                </div>
                <ul style="font-size: 0.8125rem; color: var(--gray-600); padding-left: 20px; display: flex; flex-direction: column; gap: 6px;">
                  <li>Check your inbox (and spam folder)</li>
                  <li>Click the reset link within 15 minutes</li>
                  <li>Create a new secure password</li>
                </ul>
              </div>
            </div>

            <div style="margin-top: 24px; display: flex; flex-direction: column; gap: 12px; align-items: center;">
              <a href="#/login" class="btn btn-primary btn-lg btn-block">
                <span class="material-icons-outlined" style="font-size: 18px;">arrow_back</span>
                Back to Login
              </a>
              <a href="#" id="contact-it" style="font-size: 0.8125rem; color: var(--gray-500);">
                <span class="material-icons-outlined" style="font-size: 14px; vertical-align: middle;">support_agent</span>
                Contact IT Support
              </a>
            </div>
          </div>

          <div class="auth-footer">
            <p>AIRA Clinical Workflow • HIPAA Compliant • v2.1.0</p>
          </div>
        </div>
      </div>
    </div>
  `;

    // Form submission handler
    const form = document.getElementById('reset-form');
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('reset-btn');
        const text = document.getElementById('reset-text');
        const spinner = document.getElementById('reset-spinner');
        const errorDiv = document.getElementById('reset-error');

        btn.disabled = true;
        text.textContent = 'Sending...';
        spinner.style.display = 'inline-block';
        errorDiv.style.display = 'none';

        // Simulate API call (no backend endpoint yet)
        await new Promise(r => setTimeout(r, 1500));

        // Show success state regardless (security: never reveal if account exists)
        document.getElementById('reset-request-view').style.display = 'none';
        document.getElementById('reset-success-view').style.display = 'block';
    });
}
