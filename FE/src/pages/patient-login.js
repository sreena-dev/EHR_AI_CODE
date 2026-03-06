/**
 * Patient Login Page — Patient Portal Login
 * Matches AIRA "Staff Login Screen" design with patient-focused messaging
 */
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';

export async function renderPatientLogin() {
  // Redirect if already logged in as patient
  const raw = sessionStorage.getItem('aira_user');
  if (raw) {
    const user = JSON.parse(raw);
    if (user?.role === 'patient') {
      showToast('You are already logged in.', 'success');
      return;
    }
  }

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="auth-layout">
      <!-- Brand Panel -->
      <div class="auth-brand">
        <div class="auth-brand-content">
          <div class="auth-brand-logo">
            <span class="material-icons-outlined">person</span>
          </div>
          <h1>AIRA Patient Portal</h1>
          <p>Access your health records, view appointments, and manage your 
             medical information securely through our HIPAA-compliant 
             patient portal.</p>

          <div style="margin-top: 48px; display: flex; gap: 24px; justify-content: center;">
            <div style="text-align: center;">
              <div style="font-size: 2rem; font-weight: 800;">📋</div>
              <div style="font-size: 0.8125rem; opacity: 0.75;">Health Records</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 2rem; font-weight: 800;">🔒</div>
              <div style="font-size: 0.8125rem; opacity: 0.75;">HIPAA Secure</div>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 2rem; font-weight: 800;">📅</div>
              <div style="font-size: 0.8125rem; opacity: 0.75;">Appointments</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Login Form -->
      <div class="auth-form-wrapper">
        <div class="auth-form">
          <h2>Patient Portal Login</h2>
          <p class="subtitle">Enter your patient credentials to access your health records.</p>

          <div id="login-error" class="alert alert-error" style="display:none;"></div>

          <form id="patient-login-form" autocomplete="off">
            <div class="form-group">
              <label class="form-label" for="patient-id">
                <span class="material-icons-outlined" style="font-size:16px; vertical-align: middle;">badge</span>
                Patient ID
              </label>
              <input type="text" id="patient-id" class="form-input" placeholder="e.g. PID-10001" required autofocus />
            </div>

            <div class="form-group" style="margin-top: 16px;">
              <label class="form-label" for="patient-password">
                <span class="material-icons-outlined" style="font-size:16px; vertical-align: middle;">lock</span>
                Password
              </label>
              <div style="position: relative;">
                <input type="password" id="patient-password" class="form-input" placeholder="Enter your password" required minlength="8" />
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

            <button type="submit" id="patient-login-btn" class="btn btn-primary btn-lg btn-block" style="margin-top:24px;">
              <span id="login-text">Sign In</span>
              <span id="login-spinner" class="spinner" style="display:none;"></span>
            </button>
          </form>

          <div class="auth-footer">
            <p style="margin-bottom: 8px;"><a href="#/patient-register">New Patient? Register here</a></p>
            <p style="margin-bottom: 8px;">
              <a href="#/login" style="color: var(--gray-500); font-size: 0.8125rem;">
                <span class="material-icons-outlined" style="font-size: 14px; vertical-align: middle;">swap_horiz</span>
                Staff Login
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
  const form = document.getElementById('patient-login-form');
  const errorDiv = document.getElementById('login-error');
  const togglePw = document.getElementById('toggle-pw');
  const pwInput = document.getElementById('patient-password');

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

    const patientId = document.getElementById('patient-id').value.trim();
    const password = document.getElementById('patient-password').value;
    const loginBtn = document.getElementById('patient-login-btn');
    const loginText = document.getElementById('login-text');
    const loginSpinner = document.getElementById('login-spinner');

    if (!patientId || !password) {
      errorDiv.innerHTML = `
                <span class="material-icons-outlined" style="font-size:18px">error</span>
                Please enter both Patient ID and Password.
            `;
      errorDiv.style.display = 'flex';
      return;
    }

    loginBtn.disabled = true;
    loginText.textContent = 'Signing in...';
    loginSpinner.style.display = 'inline-block';

    try {
      const res = await fetch('/api/auth/patient/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ patient_id: patientId, password }),
      });

      const data = await res.json();
      console.log('[Patient Login] Response:', res.status, data);

      if (!res.ok || !data.success) {
        throw new Error(data.message || data.detail || 'Login failed. Please check your credentials.');
      }

      // Store tokens and user data
      if (data.token) {
        sessionStorage.setItem('aira_access_token', data.token.access_token);
        sessionStorage.setItem('aira_refresh_token', data.token.refresh_token);
        sessionStorage.setItem('aira_user', JSON.stringify({
          staff_id: data.token.staff_id,
          role: data.token.role,
          full_name: data.patient?.name || data.token.staff_id,
        }));
      }

      // Show success state
      loginText.textContent = '✓ Login Successful';
      loginSpinner.style.display = 'none';
      showToast(`Welcome, ${data.patient?.name || 'Patient'}! Login successful.`, 'success');

      // Navigate to patient dashboard
      setTimeout(() => {
        navigate('/patient/dashboard');
      }, 800);

    } catch (err) {
      console.error('[Patient Login] Error:', err.message);
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
