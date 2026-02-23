/**
 * AIRA Clinical Workflow — App Shell Component
 * Sidebar navigation + header for authenticated pages.
 */
import { getCurrentUser, logout } from '../api/auth.js';
import { navigate } from '../router.js';

const NURSE_NAV = [
  { icon: 'dashboard', label: 'Dashboard', path: '/nurse/dashboard' },
  { icon: 'groups', label: 'Patient Queue', path: '/nurse/queue' },
  { icon: 'document_scanner', label: 'OCR Upload', path: '/nurse/ocr' },
];

const DOCTOR_NAV = [
  { icon: 'dashboard', label: 'Dashboard', path: '/doctor/dashboard' },
  { icon: 'calendar_today', label: 'Schedule', path: '/doctor/schedule' },
  { icon: 'groups', label: 'Patient Queue', path: '/doctor/queue' },
  { icon: 'mic', label: 'Consultation', path: '/doctor/consultation' },
  { icon: 'video_call', label: 'Live Consultation', path: '/doctor/live-consultation' },
  { icon: 'verified', label: 'Note Verification', path: '/doctor/note-verification' },
  { icon: 'help_outline', label: 'Clarification', path: '/doctor/clarification' },
  { icon: 'person', label: 'Profile', path: '/doctor/profile' },
];

const ADMIN_NAV = [
  { icon: 'dashboard', label: 'Dashboard', path: '/admin/dashboard' },
  { icon: 'person_add', label: 'Staff Registration', path: '/admin/register' },
  { icon: 'groups', label: 'Patient Queue', path: '/admin/queue' },
  { icon: 'settings', label: 'Settings', path: '/admin/settings' },
];

/**
 * Render the app shell with sidebar and content area
 * @param {string} pageTitle - Title for the header
 * @param {string} bodyHTML - Inner page HTML
 * @param {string} [activePath] - Current active nav path
 */
export function renderAppShell(pageTitle, bodyHTML, activePath) {
  const user = getCurrentUser();
  const role = user?.role || 'nurse';
  const initials = (user?.full_name || user?.staff_id || 'U')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  let navItems;
  switch (role) {
    case 'doctor': navItems = DOCTOR_NAV; break;
    case 'admin': navItems = ADMIN_NAV; break;
    default: navItems = NURSE_NAV;
  }

  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="app-shell">
      <!-- Sidebar -->
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-logo">
            <span class="material-icons-outlined">favorite</span>
          </div>
          <div>
            <div class="sidebar-title">AIRA</div>
            <div class="sidebar-subtitle">Clinical Workflow</div>
          </div>
        </div>

        <nav class="sidebar-nav">
          <div class="sidebar-section-label">Main Menu</div>
          ${navItems.map(item => `
            <a href="#${item.path}" class="sidebar-link ${activePath === item.path ? 'active' : ''}">
              <span class="material-icons-outlined">${item.icon}</span>
              <span>${item.label}</span>
            </a>
          `).join('')}
        </nav>

        <div class="sidebar-footer">
          <div class="sidebar-user" id="user-menu">
            <div class="sidebar-avatar">${initials}</div>
            <div class="sidebar-user-info">
              <div class="sidebar-user-name">${user?.full_name || user?.staff_id || 'User'}</div>
              <div class="sidebar-user-role">${role}</div>
            </div>
            <span class="material-icons-outlined" style="font-size:18px; color: var(--gray-500)">logout</span>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="main-content">
        <header class="top-header">
          <div class="top-header-left">
            <h1 class="page-title">${pageTitle}</h1>
          </div>
          <div class="top-header-right">
            <span class="badge badge-success">
              <span class="material-icons-outlined" style="font-size:14px">verified_user</span>
              HIPAA Compliant
            </span>
          </div>
        </header>

        <div class="page-content" id="page-content">
          ${bodyHTML}
        </div>
      </main>
    </div>
  `;

  // Logout handler
  document.getElementById('user-menu')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to log out?')) {
      logout();
      navigate('/login');
    }
  });
}
