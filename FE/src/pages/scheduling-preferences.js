/**
 * Scheduling Preferences Page — Doctor's schedule settings
 * Matches Stitch "Scheduling Preferences - High Density UI" screen
 */
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { renderAppShell } from '../components/app-shell.js';

export async function renderSchedulingPreferences() {
    const settings = {
        weeklyHours: 40,
        maxAppointments: 25,
        bufferTime: 10, // minutes
        automaticSync: true,
        shifts: [
            { day: 'Monday', hours: '08:00 AM - 04:00 PM', active: true },
            { day: 'Tuesday', hours: '08:00 AM - 04:00 PM', active: true },
            { day: 'Wednesday', hours: '08:00 AM - 04:00 PM', active: true },
            { day: 'Thursday', hours: '08:00 AM - 04:00 PM', active: true },
            { day: 'Friday', hours: '08:00 AM - 04:00 PM', active: true },
            { day: 'Saturday', hours: 'Closed', active: false },
            { day: 'Sunday', hours: 'Closed', active: false },
        ],
        visitTypes: [
            { type: 'Consultation', duration: 20, active: true },
            { type: 'Follow-up', duration: 15, active: true },
            { type: 'Emergency', duration: 30, active: true },
            { type: 'Tele-consult', duration: 15, active: true },
        ]
    };

    const bodyHTML = `
    <div style="max-width: 1000px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
        <div>
          <h2 style="font-size: 1.5rem; font-weight: 700;">Scheduling Preferences</h2>
          <p class="text-muted">Manage your availability, shift timings, and visit type configurations.</p>
        </div>
        <div style="display: flex; gap: 12px;">
          <button class="btn btn-secondary" id="reset-settings">Reset to Default</button>
          <button class="btn btn-primary" id="save-settings">Save Changes</button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 24px;">
        <!-- Left Column: Shifts & Availability -->
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <!-- Weekly Schedule Card -->
          <div class="card">
            <div class="card-header">
              <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                <span class="material-icons-outlined" style="font-size: 20px; color: var(--primary-500);">calendar_view_week</span>
                Weekly Schedule
              </h3>
            </div>
            <div class="card-body" style="padding: 0;">
              <table class="table" style="margin: 0;">
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Working Hours</th>
                    <th style="text-align: right;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${settings.shifts.map(shift => `
                    <tr>
                      <td style="font-weight: 600;">${shift.day}</td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <input type="text" class="form-input text-xs" style="width: 160px; padding: 4px 8px;" value="${shift.hours}" ${!shift.active ? 'disabled' : ''}>
                          <span class="material-icons-outlined text-muted" style="font-size: 16px; cursor: pointer;">edit</span>
                        </div>
                      </td>
                      <td style="text-align: right;">
                        <label class="switch">
                          <input type="checkbox" ${shift.active ? 'checked' : ''}>
                          <span class="slider round"></span>
                        </label>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Visit Type Configuration -->
          <div class="card">
            <div class="card-header">
              <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">
                <span class="material-icons-outlined" style="font-size: 20px; color: var(--primary-500);">settings_suggest</span>
                Visit Type Configuration
              </h3>
            </div>
            <div class="card-body" style="padding: 0;">
              <table class="table" style="margin: 0;">
                <thead>
                  <tr>
                    <th>Visit Type</th>
                    <th>Duration (min)</th>
                    <th style="text-align: right;">Active</th>
                  </tr>
                </thead>
                <tbody>
                  ${settings.visitTypes.map(visit => `
                    <tr>
                      <td style="font-weight: 600;">${visit.type}</td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 8px;">
                          <input type="number" class="form-input text-xs" style="width: 60px; padding: 4px 8px;" value="${visit.duration}" ${!visit.active ? 'disabled' : ''}>
                          <span class="text-xs text-muted">mins</span>
                        </div>
                      </td>
                      <td style="text-align: right;">
                        <label class="switch">
                          <input type="checkbox" ${visit.active ? 'checked' : ''}>
                          <span class="slider round"></span>
                        </label>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Right Column: General Settings -->
        <div style="display: flex; flex-direction: column; gap: 24px;">
          <div class="card">
            <div class="card-header">
              <h3 style="margin: 0;">General Rules</h3>
            </div>
            <div class="card-body" style="display: flex; flex-direction: column; gap: 16px;">
              <div class="form-group">
                <label class="form-label text-xs">Weekly Working Hours Limit</label>
                <input type="number" class="form-input" value="${settings.weeklyHours}">
              </div>
              <div class="form-group">
                <label class="form-label text-xs">Max Appointments / Day</label>
                <input type="number" class="form-input" value="${settings.maxAppointments}">
              </div>
              <div class="form-group">
                <label class="form-label text-xs">Buffer Time (minutes)</label>
                <input type="number" class="form-input" value="${settings.bufferTime}">
              </div>
              <hr style="border: none; border-top: 1px solid var(--gray-200); margin: 8px 0;">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span class="text-sm">Automatic Sync with EMR</span>
                <label class="switch">
                  <input type="checkbox" ${settings.automaticSync ? 'checked' : ''}>
                  <span class="slider round"></span>
                </label>
              </div>
            </div>
          </div>

          <div class="card" style="background: var(--primary-50); border: 1px dashed var(--primary-300);">
            <div class="card-body" style="text-align: center; padding: 24px;">
              <span class="material-icons-outlined" style="font-size: 48px; color: var(--primary-500); margin-bottom: 12px;">info</span>
              <h4 style="margin-bottom: 8px; color: var(--primary-700);">Important Note</h4>
              <p class="text-xs" style="color: var(--primary-600); line-height: 1.5;">
                Changes to scheduling preferences will take effect from the next working day. Existing appointments for today will not be affected.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <style>
      /* Toggle Switch Styles */
      .switch {
        position: relative;
        display: inline-block;
        width: 36px;
        height: 20px;
      }
      .switch input { opacity: 0; width: 0; height: 0; }
      .slider {
        position: absolute;
        cursor: pointer;
        top: 0; left: 0; right: 0; bottom: 0;
        background-color: var(--gray-300);
        transition: .3s;
      }
      .slider:before {
        position: absolute;
        content: "";
        height: 14px; width: 14px;
        left: 3px; bottom: 3px;
        background-color: white;
        transition: .3s;
      }
      input:checked + .slider { background-color: var(--primary-500); }
      input:checked + .slider:before { transform: translateX(16px); }
      .slider.round { border-radius: 20px; }
      .slider.round:before { border-radius: 50%; }

      .table td { vertical-align: middle; padding: 12px 16px; }
      .form-input:disabled { background: var(--gray-50); color: var(--gray-400); cursor: not-allowed; }
    </style>
  `;

    renderAppShell('Scheduling Preferences', bodyHTML, '/doctor/scheduling-preferences');

    // Logic
    document.getElementById('save-settings')?.addEventListener('click', () => {
        showToast('Scheduling preferences saved successfully', 'success');
    });

    document.getElementById('reset-settings')?.addEventListener('click', () => {
        showToast('Settings reset to default', 'info');
    });
}
