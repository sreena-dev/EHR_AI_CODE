/**
 * Scheduling Preferences Page — Shift & availability management
 * Matches Stitch "Scheduling Preferences" screen
 */
import { showToast } from '../components/toast.js';
import { renderAppShell } from '../components/app-shell.js';

export async function renderScheduling() {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const shifts = ['Morning', 'Afternoon', 'Night', 'Off'];

    // Mock saved preferences
    const savedPrefs = {
        Monday: 'Morning', Tuesday: 'Morning', Wednesday: 'Afternoon',
        Thursday: 'Morning', Friday: 'Morning', Saturday: 'Off', Sunday: 'Off',
    };

    renderAppShell('Scheduling Preferences', `
    <div style="max-width: 800px; margin: 0 auto;">
      <div style="margin-bottom: 24px;">
        <h1 style="margin-bottom: 4px;">Scheduling Preferences</h1>
        <p class="text-sm text-muted">Set your preferred shifts and availability for each day of the week.</p>
      </div>

      <!-- Current Week Schedule -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">
            <span class="material-icons-outlined" style="font-size: 18px; color: var(--primary-500);">calendar_month</span>
            Weekly Schedule
          </h3>
          <span class="badge badge-info">Week of 17 Feb 2026</span>
        </div>
        <div class="card-body" style="padding: 0;">
          <table class="table" style="margin: 0;">
            <thead>
              <tr>
                <th>Day</th>
                <th>Preferred Shift</th>
                <th>Hours</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${days.map(day => {
        const pref = savedPrefs[day];
        const hours = pref === 'Morning' ? '6:00 AM – 2:00 PM' :
            pref === 'Afternoon' ? '2:00 PM – 10:00 PM' :
                pref === 'Night' ? '10:00 PM – 6:00 AM' : '—';
        return `
                <tr>
                  <td style="font-weight: 600;">${day}</td>
                  <td>
                    <select class="form-select shift-select" data-day="${day}" style="min-width: 140px; padding: 6px 10px; font-size: 0.8125rem;">
                      ${shifts.map(s => `<option ${s === pref ? 'selected' : ''}>${s}</option>`).join('')}
                    </select>
                  </td>
                  <td class="text-sm text-muted">${hours}</td>
                  <td>
                    <span class="badge ${pref === 'Off' ? 'badge-neutral' : 'badge-success'}">
                      ${pref === 'Off' ? 'Day Off' : 'Active'}
                    </span>
                  </td>
                </tr>
              `}).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Leave Requests -->
      <div class="card" style="margin-bottom: 24px;">
        <div class="card-header">
          <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">
            <span class="material-icons-outlined" style="font-size: 18px; color: #b45309;">event_busy</span>
            Leave Requests
          </h3>
          <button class="btn btn-sm btn-primary" id="request-leave-btn">
            <span class="material-icons-outlined" style="font-size: 16px;">add</span>
            Request Leave
          </button>
        </div>
        <div class="card-body" style="padding: 0;">
          <div class="summary-row">
            <div>
              <div style="font-weight: 600; font-size: 0.875rem;">Annual Leave</div>
              <span class="text-xs text-muted">25 Feb – 28 Feb 2026</span>
            </div>
            <span class="badge badge-warning">Pending Approval</span>
          </div>
          <div class="summary-row">
            <div>
              <div style="font-weight: 600; font-size: 0.875rem;">Half Day</div>
              <span class="text-xs text-muted">10 Feb 2026 (Morning)</span>
            </div>
            <span class="badge badge-success">Approved</span>
          </div>
        </div>
      </div>

      <!-- Save Button -->
      <div style="display: flex; gap: 12px; justify-content: flex-end;">
        <button class="btn btn-secondary" id="reset-schedule-btn">Reset to Default</button>
        <button class="btn btn-primary" id="save-schedule-btn">
          <span class="material-icons-outlined" style="font-size: 18px;">save</span>
          Save Preferences
        </button>
      </div>
    </div>
  `, '/doctor/dashboard');

    document.getElementById('save-schedule-btn')?.addEventListener('click', () => {
        showToast('Scheduling preferences saved!', 'success');
    });
    document.getElementById('reset-schedule-btn')?.addEventListener('click', () => {
        showToast('Schedule reset to default', 'info');
    });
    document.getElementById('request-leave-btn')?.addEventListener('click', () => {
        showToast('Leave request dialog coming soon', 'info');
    });
}
