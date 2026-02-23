/**
 * Doctor Profile Page — Staff profile details & settings
 * Matches Stitch "Doctor Details - Profile" screen
 */
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { renderAppShell } from '../components/app-shell.js';
import { getCurrentUser } from '../api/auth.js';

export async function renderDoctorProfile() {
  // Mock profile data
  const profile = {
    name: 'Dr. Anand Krishnamurthy',
    regionalName: 'ஆனந்த் கிருஷ்ணமூர்த்தி',
    staffId: 'DOC-078',
    specialization: 'General Medicine',
    license: 'MCI-TN-2018-084721',
    email: 'anand.k@chennai-clinic.org',
    phone: '+91 98765 11234',
    department: 'General Medicine (Floor 1)',
    shift: 'Morning (6:00 AM – 2:00 PM)',
    joinDate: '15 Mar 2018',
    experience: '8 years',
    consultations: 12847,
    avgRating: 4.8,
    notesGenerated: 3206,
  };

  renderAppShell('Profile', `
    <div style="max-width: 960px; margin: 0 auto;">
      <!-- Profile Header -->
      <div class="card" style="margin-bottom: 24px; overflow: hidden;">
        <div style="height: 100px; background: linear-gradient(135deg, var(--primary-600), var(--primary-400));"></div>
        <div class="card-body" style="padding: 0 24px 24px;">
          <div style="display: flex; gap: 24px; align-items: flex-end; margin-top: -40px;">
            <div style="width: 80px; height: 80px; border-radius: 50%; background: white; border: 4px solid white; display: flex; align-items: center; justify-content: center; box-shadow: var(--shadow-md);">
              <span class="material-icons-outlined" style="font-size: 40px; color: var(--primary-500);">person</span>
            </div>
            <div style="flex: 1; padding-bottom: 4px;">
              <h2 style="margin-bottom: 2px;">${profile.name}</h2>
              <p class="text-sm text-muted">${profile.regionalName}</p>
              <div style="display: flex; gap: 8px; margin-top: 6px; flex-wrap: wrap;">
                <span class="badge badge-info">${profile.specialization}</span>
                <span class="badge badge-neutral">${profile.staffId}</span>
                <span class="badge badge-success">Active</span>
              </div>
            </div>
            <button class="btn btn-secondary" id="edit-profile-btn">
              <span class="material-icons-outlined" style="font-size: 16px;">edit</span>
              Edit Profile
            </button>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <!-- Stats -->
        <div class="card">
          <div class="card-header">
            <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">
              <span class="material-icons-outlined" style="font-size: 18px; color: var(--primary-500);">insights</span>
              Performance
            </h3>
          </div>
          <div class="card-body" style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
            <div class="stat-mini">
              <div class="stat-mini-value">${profile.consultations.toLocaleString()}</div>
              <div class="stat-mini-label">Total Consultations</div>
            </div>
            <div class="stat-mini">
              <div class="stat-mini-value">${profile.notesGenerated.toLocaleString()}</div>
              <div class="stat-mini-label">Notes Generated</div>
            </div>
            <div class="stat-mini">
              <div class="stat-mini-value">${profile.avgRating}</div>
              <div class="stat-mini-label">Avg. Rating ⭐</div>
            </div>
            <div class="stat-mini">
              <div class="stat-mini-value">${profile.experience}</div>
              <div class="stat-mini-label">Experience</div>
            </div>
          </div>
        </div>

        <!-- Contact Info -->
        <div class="card">
          <div class="card-header">
            <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">
              <span class="material-icons-outlined" style="font-size: 18px; color: var(--primary-500);">contact_mail</span>
              Contact Information
            </h3>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="summary-row">
              <span class="summary-label">Email</span>
              <span class="summary-value">${profile.email}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Phone</span>
              <span class="summary-value">${profile.phone}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Department</span>
              <span class="summary-value">${profile.department}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Shift</span>
              <span class="summary-value">${profile.shift}</span>
            </div>
          </div>
        </div>

        <!-- License Info -->
        <div class="card">
          <div class="card-header">
            <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">
              <span class="material-icons-outlined" style="font-size: 18px; color: var(--success);">verified</span>
              License & Credentials
            </h3>
          </div>
          <div class="card-body" style="padding: 0;">
            <div class="summary-row">
              <span class="summary-label">License #</span>
              <span class="summary-value" style="font-weight: 600; color: var(--primary-600);">${profile.license}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Joined</span>
              <span class="summary-value">${profile.joinDate}</span>
            </div>
            <div class="summary-row">
              <span class="summary-label">Status</span>
              <span class="badge badge-success">Verified</span>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="card">
          <div class="card-header">
            <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">
              <span class="material-icons-outlined" style="font-size: 18px; color: var(--primary-500);">widgets</span>
              Quick Actions
            </h3>
          </div>
          <div class="card-body" style="display: flex; flex-direction: column; gap: 8px;">
            <a href="#/doctor/scheduling-preferences" class="btn btn-ghost" style="justify-content: flex-start; text-decoration: none;">
              <span class="material-icons-outlined" style="font-size: 18px;">calendar_month</span>
              Scheduling Preferences
            </a>
            <a href="#/doctor/drafts" class="btn btn-ghost" style="justify-content: flex-start; text-decoration: none;">
              <span class="material-icons-outlined" style="font-size: 18px;">drafts</span>
              Local Drafts
            </a>
            <button class="btn btn-ghost" style="justify-content: flex-start;" id="change-pw-btn">
              <span class="material-icons-outlined" style="font-size: 18px;">lock</span>
              Change Password
            </button>
          </div>
        </div>
      </div>
    </div>
  `, '/doctor/profile');

  document.getElementById('edit-profile-btn')?.addEventListener('click', () => {
    showToast('Profile editing coming soon', 'info');
  });
  document.getElementById('change-pw-btn')?.addEventListener('click', () => {
    showToast('Password change dialog coming soon', 'info');
  });
}
