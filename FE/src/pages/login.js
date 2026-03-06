/**
 * Login Page — Staff Portal Login
 * Matches Stitch "Staff Login Screen" design
 */
import { login, isAuthenticated, getCurrentUser } from '../api/auth.js';
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';

export async function renderLogin() {
  // Redirect if already logged in
  if (isAuthenticated()) {
    const user = getCurrentUser();
    navigate(user?.role === 'doctor' ? '/doctor/dashboard' : '/nurse/dashboard');
    return;
  }

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-layout">
      <!-- Brand Panel -->
      <div class="auth-brand">
        <div class="auth-brand-content">
          <div class="auth-brand-logo">
            <span class="material-icons-outlined">favorite</span>
          </div>
          <h1>AIRA Clinical Workflow</h1>
          <p>AI-powered clinical documentation for modern healthcare. 
             Streamline prescriptions, consultations, and patient care with 
             HIPAA-compliant intelligent automation.</p>

          <div style="margin-top: 48px; display: flex; gap: 24px; justify-content: center;">
            <div style="text-align: center;">
              <div style="font-size: 2rem; font-weight: 800;">98%</div>
              <div style="font-size: 0.8125rem; opacity: 0.75;">OCR Accuracy</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 2rem; font-weight: 800;">3min</div>
              <div style="font-size: 0.8125rem; opacity: 0.75;">Avg Note Time</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 2rem; font-weight: 800;">100%</div>
              <div style="font-size: 0.8125rem; opacity: 0.75;">HIPAA Safe</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Login Form -->
      <div class="auth-form-wrapper">
        <div class="auth-form">
          <h2>Staff Portal Login</h2>
          <p class="subtitle">Enter your credentials to access AIRA Clinical Workflow.</p>

          <div id="login-error" class="alert alert-error" style="display:none;"></div>

          <form id="login-form" autocomplete="off">
            <div class="form-group">
              <label class="form-label" for="staff-id">
                <span class="material-icons-outlined" style="font-size:16px; vertical-align: middle;">badge</span>
                Staff ID
              </label>
              <input type="text" id="staff-id" class="form-input" placeholder="Enter your staff ID" required autofocus />
            </div>

            <div class="form-group" style="margin-top: 16px;">
              <label class="form-label" for="password">
                <span class="material-icons-outlined" style="font-size:16px; vertical-align: middle;">lock</span>
                Password
              </label>
              <div style="position: relative;">
                <input type="password" id="password" class="form-input" placeholder="Enter your password" required minlength="8" />
                <button type="button" id="toggle-pw" style="position:absolute; right:12px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color: var(--gray-400);">
                  <span class="material-icons-outlined" style="font-size:20px">visibility_off</span>
                </button>
              </div>
            </div>

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
              <label style="display:flex; align-items:center; gap:6px; font-size:0.875rem; color:var(--gray-600); cursor:pointer;">
                <input type="checkbox" id="remember" style="accent-color: var(--primary-500);" />
                Remember me
              </label>
              <a href="#/forgot-password" style="font-size:0.875rem;">Forgot password?</a>
            </div>

            <button type="submit" id="login-btn" class="btn btn-primary btn-lg btn-block" style="margin-top:24px;">
              <span id="login-text">Sign In</span>
              <span id="login-spinner" class="spinner" style="display:none;"></span>
            </button>
          </form>

          <div class="auth-footer">
            <p style="margin-bottom: 8px;"><a href="#/register-role">New Staff? Register here</a></p>
            <p style="margin-bottom: 8px;">
              <a href="#/patient-login" style="color: #7c3aed; font-weight: 500; font-size: 0.875rem; display: inline-flex; align-items: center; gap: 4px;">
                <span class="material-icons-outlined" style="font-size: 16px;">person</span>
                Patient Portal Login
              </a>
            </p>
            <p>AIRA Clinical Workflow • HIPAA Compliant</p>
            <p style="margin-top:6px;">
              <a href="#">Privacy Policy</a> · <a href="#">Terms of Service</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  `;

  // Event handlers
  const form = document.getElementById('login-form');
  const errorDiv = document.getElementById('login-error');
  const togglePw = document.getElementById('toggle-pw');
  const pwInput = document.getElementById('password');

  // Toggle password visibility
  togglePw.addEventListener('click', () => {
    const isHidden = pwInput.type === 'password';
    pwInput.type = isHidden ? 'text' : 'password';
    togglePw.querySelector('.material-icons-outlined').textContent = isHidden ? 'visibility' : 'visibility_off';
  });

  // Login submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorDiv.style.display = 'none';

    const staffId = document.getElementById('staff-id').value.trim();
    const password = document.getElementById('password').value;
    const loginBtn = document.getElementById('login-btn');
    const loginText = document.getElementById('login-text');
    const loginSpinner = document.getElementById('login-spinner');

    loginBtn.disabled = true;
    loginText.textContent = 'Signing in...';
    loginSpinner.style.display = 'inline-block';

    try {
      const result = await login(staffId, password);
      showToast('Login successful!', 'success');

      // Redirect based on role
      const user = getCurrentUser();
      setTimeout(() => {
        navigate(user?.role === 'doctor' ? '/doctor/dashboard' : '/nurse/dashboard');
      }, 500);

    } catch (err) {
      errorDiv.innerHTML = `
        <span class="material-icons-outlined" style="font-size:18px">error</span>
        ${err.message}
      `;
      errorDiv.style.display = 'flex';
      loginBtn.disabled = false;
      loginText.textContent = 'Sign In';
      loginSpinner.style.display = 'none';
    }
  });
}
