/**
 * Admin Staff Management — AIRA Clinical Workflow
 * Staff directory with add/edit/deactivate capabilities.
 */
import { renderAppShell } from '../components/app-shell.js';
import { getCurrentUser } from '../api/auth.js';
import { fetchAllStaff, createStaff, updateStaff } from '../api/admin.js';

/* ── Role display config ── */
const ROLE_BADGE = {
    admin: { cls: 'badge-primary', icon: 'admin_panel_settings' },
    doctor: { cls: 'badge-info', icon: 'medical_services' },
    nurse: { cls: 'badge-success', icon: 'vaccines' },
    receptionist: { cls: 'badge-neutral', icon: 'support_agent' },
};

const STATUS_BADGE = {
    active: 'badge-success',
    suspended: 'badge-warning',
    locked: 'badge-error',
};

export async function renderAdminStaff() {
    const user = getCurrentUser();

    const bodyHTML = `
    <!-- Header -->
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:12px;">
      <div>
        <h2 style="font-size: 1.5rem; font-weight: 700;">Staff Management</h2>
        <p class="text-muted">Manage all clinical and administrative staff accounts.</p>
      </div>
      <button class="btn btn-primary" id="btn-add-staff">
        <span class="material-icons-outlined" style="font-size:18px">person_add</span>
        Add New Staff
      </button>
    </div>

    <!-- Role Filter Chips -->
    <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap;">
      <button class="btn btn-sm btn-primary" data-role-filter="all" id="filter-all">All</button>
      <button class="btn btn-sm btn-secondary" data-role-filter="doctor">Doctors</button>
      <button class="btn btn-sm btn-secondary" data-role-filter="nurse">Nurses</button>
      <button class="btn btn-sm btn-secondary" data-role-filter="admin">Admins</button>
      <button class="btn btn-sm btn-secondary" data-role-filter="receptionist">Receptionists</button>
    </div>

    <!-- Staff Table -->
    <div class="card">
      <div class="card-header">
        <h3 style="font-size:1rem; margin:0;">
          <span class="material-icons-outlined" style="font-size:20px; vertical-align:middle;">groups</span>
          Staff Directory
        </h3>
        <span id="staff-count" class="badge badge-neutral" style="font-size:0.75rem;">Loading…</span>
      </div>
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Staff ID</th>
              <th>Name</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
              <th>Last Login</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody id="staff-body">
            <tr>
              <td colspan="7" style="text-align:center; padding:32px; color:var(--gray-400);">
                <span class="spinner" style="margin-right:8px;"></span> Loading staff…
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Add Staff Modal (hidden by default) -->
    <div id="modal-overlay" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:200; justify-content:center; align-items:center;">
      <div style="background:white; border-radius:var(--radius-lg); box-shadow:var(--shadow-xl); width:90%; max-width:500px; max-height:90vh; overflow-y:auto;">
        <div style="padding:var(--space-lg); border-bottom:1px solid var(--gray-200); display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:1.125rem;" id="modal-title">Add New Staff Member</h3>
          <button class="btn btn-ghost btn-icon" id="modal-close">
            <span class="material-icons-outlined">close</span>
          </button>
        </div>
        <form id="staff-form" style="padding:var(--space-lg);">
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label">Staff ID *</label>
            <input type="text" id="form-staff-id" class="form-input" placeholder="e.g. nurse_002" required minlength="3" maxlength="100">
          </div>
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label">Full Name *</label>
            <input type="text" id="form-full-name" class="form-input" placeholder="e.g. Nurse Lakshmi" required minlength="2" maxlength="200">
          </div>
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label">Role *</label>
            <select id="form-role" class="form-select" required>
              <option value="">Select role…</option>
              <option value="nurse">Nurse</option>
              <option value="doctor">Doctor</option>
              <option value="admin">Admin</option>
              <option value="receptionist">Receptionist</option>
            </select>
          </div>
          <div class="form-group" style="margin-bottom:16px;">
            <label class="form-label">Department</label>
            <input type="text" id="form-department" class="form-input" placeholder="e.g. General Ward">
          </div>
          <div class="form-group" id="password-group" style="margin-bottom:16px;">
            <label class="form-label">Password *</label>
            <input type="password" id="form-password" class="form-input" placeholder="Min 8 chars, 1 uppercase, 1 digit" required minlength="8">
            <div class="form-error" id="password-hint" style="display:none;">
              <span class="material-icons-outlined" style="font-size:14px;">info</span>
              Password must have 8+ chars, uppercase, lowercase, and digit.
            </div>
          </div>
          <div id="form-error" class="form-error" style="display:none; margin-bottom:12px;"></div>
          <div style="display:flex; gap:12px; justify-content:flex-end;">
            <button type="button" class="btn btn-secondary" id="form-cancel">Cancel</button>
            <button type="submit" class="btn btn-primary" id="form-submit">
              <span class="material-icons-outlined" style="font-size:16px;">save</span>
              Create Staff
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

    renderAppShell('Staff Management', bodyHTML, '/admin/staff');

    /* ── Fetch Staff Data ── */
    let allStaff = [];
    const tbody = document.getElementById('staff-body');
    const countBadge = document.getElementById('staff-count');

    try {
        const data = await fetchAllStaff();
        allStaff = data.staff || [];
    } catch (err) {
        console.error('Staff load error:', err);
        tbody.innerHTML = `
      <tr><td colspan="7" style="text-align:center; padding:24px; color:var(--error);">
        <span class="material-icons-outlined" style="font-size:20px;vertical-align:middle;">error</span>
        Failed to load staff — ${err.message}
      </td></tr>`;
        return;
    }

    /* ── Render staff table ── */
    function renderStaffTable(filter = 'all') {
        const filtered = filter === 'all' ? allStaff : allStaff.filter(s => s.role === filter);
        countBadge.textContent = `${filtered.length} member${filtered.length !== 1 ? 's' : ''}`;

        if (filtered.length === 0) {
            tbody.innerHTML = `
        <tr><td colspan="7" style="text-align:center; padding:32px; color:var(--gray-400);">
          <span class="material-icons-outlined" style="font-size:24px; display:block; margin-bottom:8px;">group_off</span>
          No staff members found for this filter.
        </td></tr>`;
            return;
        }

        tbody.innerHTML = filtered.map(s => {
            const rb = ROLE_BADGE[s.role] || { cls: 'badge-neutral', icon: 'person' };
            const sb = STATUS_BADGE[s.status] || 'badge-neutral';
            const loginTime = s.last_login
                ? new Date(s.last_login).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })
                : '—';
            const isCurrentUser = s.staff_id === user?.staff_id;
            const statusToggle = s.status === 'active'
                ? `<button class="btn btn-sm btn-ghost" data-action="deactivate" data-sid="${s.staff_id}" title="Deactivate" ${isCurrentUser ? 'disabled' : ''}>
             <span class="material-icons-outlined" style="font-size:16px; color:var(--error);">block</span>
           </button>`
                : `<button class="btn btn-sm btn-ghost" data-action="activate" data-sid="${s.staff_id}" title="Activate">
             <span class="material-icons-outlined" style="font-size:16px; color:var(--success);">check_circle</span>
           </button>`;

            return `
        <tr>
          <td><strong>${s.staff_id}</strong></td>
          <td>${s.full_name}</td>
          <td><span class="badge ${rb.cls}"><span class="material-icons-outlined" style="font-size:14px;">${rb.icon}</span> ${s.role}</span></td>
          <td>${s.department}</td>
          <td><span class="badge ${sb}">${s.status}</span></td>
          <td class="text-muted text-sm">${loginTime}</td>
          <td style="display:flex; gap:4px;">${statusToggle}</td>
        </tr>`;
        }).join('');

        /* ── Attach action handlers ── */
        tbody.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const action = btn.dataset.action;
                const sid = btn.dataset.sid;
                const newStatus = action === 'deactivate' ? 'suspended' : 'active';
                const confirmMsg = action === 'deactivate'
                    ? `Are you sure you want to deactivate "${sid}"? They will be unable to log in.`
                    : `Reactivate "${sid}"?`;

                if (!confirm(confirmMsg)) return;

                try {
                    await updateStaff(sid, { status: newStatus });
                    // Update local state & re-render
                    const idx = allStaff.findIndex(s => s.staff_id === sid);
                    if (idx >= 0) allStaff[idx].status = newStatus;
                    renderStaffTable(activeFilter);
                } catch (err) {
                    alert(`Failed to update staff: ${err.message}`);
                }
            });
        });
    }

    // Initial render
    renderStaffTable('all');

    /* ── Role filter chips ── */
    let activeFilter = 'all';
    document.querySelectorAll('[data-role-filter]').forEach(chip => {
        chip.addEventListener('click', () => {
            activeFilter = chip.dataset.roleFilter;
            document.querySelectorAll('[data-role-filter]').forEach(c => {
                c.className = c.dataset.roleFilter === activeFilter ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-secondary';
            });
            renderStaffTable(activeFilter);
        });
    });

    /* ── Add Staff Modal ── */
    const overlay = document.getElementById('modal-overlay');
    const form = document.getElementById('staff-form');
    const formError = document.getElementById('form-error');

    function openModal() {
        overlay.style.display = 'flex';
        form.reset();
        formError.style.display = 'none';
        document.getElementById('form-staff-id').focus();
    }

    function closeModal() {
        overlay.style.display = 'none';
    }

    document.getElementById('btn-add-staff').addEventListener('click', openModal);
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('form-cancel').addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        formError.style.display = 'none';

        const data = {
            staff_id: document.getElementById('form-staff-id').value.trim(),
            full_name: document.getElementById('form-full-name').value.trim(),
            role: document.getElementById('form-role').value,
            password: document.getElementById('form-password').value,
            department: document.getElementById('form-department').value.trim() || null,
        };

        const submitBtn = document.getElementById('form-submit');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner"></span> Creating…';

        try {
            const result = await createStaff(data);
            // Add to local state & re-render
            allStaff.push({
                staff_id: data.staff_id,
                full_name: data.full_name,
                role: data.role,
                department: data.department || '—',
                status: 'active',
                last_login: null,
                created_at: new Date().toISOString(),
                failed_attempts: 0,
            });
            renderStaffTable(activeFilter);
            closeModal();
        } catch (err) {
            formError.textContent = err.message;
            formError.style.display = 'flex';
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span class="material-icons-outlined" style="font-size:16px;">save</span> Create Staff';
        }
    });
}
