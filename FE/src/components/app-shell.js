/**
 * AIRA Clinical Workflow — App Shell Component
 * Sidebar navigation + header for authenticated pages.
 * Includes subscription-aware feature gating with lock icons.
 */
import { getCurrentUser, logout, authFetch } from '../api/auth.js';
import { navigate } from '../router.js';

/* ── Subscription cache (fetched once per session) ── */
let _subCache = null;
let _subFetching = false;

async function getSubscriptionStatus() {
  if (_subCache) return _subCache;
  if (_subFetching) return null;
  _subFetching = true;
  try {
    const res = await authFetch('/api/billing/status');
    if (res.ok) {
      _subCache = await res.json();
    }
  } catch (e) { /* ignore – billing may not be available for all roles */ }
  _subFetching = false;
  return _subCache;
}

/** Call this when subscription changes (e.g. after upgrade) */
export function clearSubscriptionCache() { _subCache = null; }

/* ── Elite-only nav items ── */
const ELITE_FEATURE_PATHS = new Set([
  '/doctor/live-consultation',
  '/doctor/tracking',
  '/nurse/tracking',
]);

const NURSE_NAV = [
  { icon: 'dashboard', label: 'Dashboard', path: '/nurse/dashboard' },
  { icon: 'groups', label: 'Patient Queue', path: '/nurse/queue' },
  { icon: 'document_scanner', label: 'OCR Upload', path: '/nurse/ocr' },
  { icon: 'insights', label: 'Disease Tracking', path: '/nurse/tracking', elite: true },
];

const DOCTOR_NAV = [
  { icon: 'dashboard', label: 'Dashboard', path: '/doctor/dashboard' },
  { icon: 'calendar_today', label: 'Schedule', path: '/doctor/schedule' },
  { icon: 'groups', label: 'Patient Queue', path: '/doctor/queue' },
  { icon: 'mic', label: 'Consultation', path: '/doctor/consultation' },
  { icon: 'video_call', label: 'Live Consultation', path: '/doctor/live-consultation', elite: true },
  { icon: 'insights', label: 'Disease Tracking', path: '/doctor/tracking', elite: true },
  { icon: 'credit_card', label: 'Billing & Plans', path: '/doctor/billing' },
];

const ADMIN_NAV = [
  { icon: 'dashboard', label: 'Dashboard', path: '/admin/dashboard' },
  { icon: 'people', label: 'Staff Management', path: '/admin/staff' },
  { icon: 'assignment', label: 'Encounters', path: '/admin/encounters' },
  { icon: 'history', label: 'Audit Trail', path: '/admin/audit' },
  { icon: 'credit_card', label: 'Billing & Plans', path: '/admin/billing' },
];

const PATIENT_NAV = [
  { icon: 'dashboard', label: 'Dashboard', path: '/patient/dashboard' },
  { icon: 'description', label: 'Health Records', path: '/patient/records' },
  { icon: 'person', label: 'My Profile', path: '/patient/profile' },
];

/* ── Paywall modal ── */
function showPaywall(featureName) {
  document.getElementById('paywall-modal')?.remove();

  const modal = document.createElement('div');
  modal.id = 'paywall-modal';
  modal.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;animation:fadeIn 0.2s ease;" onclick="document.getElementById('paywall-modal')?.remove()">
      <div style="background:var(--card-bg,#1e293b);border:1px solid var(--border,#334155);border-radius:20px;padding:36px 32px;max-width:420px;width:90%;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.5);animation:slideUp 0.25s ease;" onclick="event.stopPropagation()">
        <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#4338ca,#7c3aed);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;">
          <span class="material-icons-outlined" style="font-size:32px;color:#fff;">lock</span>
        </div>
        <h2 style="margin:0 0 8px;font-size:1.3rem;font-weight:800;color:var(--text-primary,#f1f5f9);">Elite Feature</h2>
        <p style="margin:0 0 20px;color:var(--text-secondary,#94a3b8);font-size:0.9rem;line-height:1.6;">
          <strong>${featureName}</strong> is available on the <span style="color:#a78bfa;font-weight:700;">Elite</span> plan. Upgrade to unlock advanced analytics, multi-clinic support, and more.
        </p>
        <div style="display:flex;gap:10px;justify-content:center;">
          <button onclick="document.getElementById('paywall-modal')?.remove()" style="padding:10px 20px;border-radius:10px;border:1px solid var(--border,#475569);background:transparent;color:var(--text-secondary,#94a3b8);font-weight:600;cursor:pointer;">Maybe Later</button>
          <button id="paywall-upgrade-btn" style="padding:10px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#4338ca,#7c3aed);color:#fff;font-weight:700;cursor:pointer;box-shadow:0 4px 16px rgba(99,102,241,0.4);">Upgrade Now</button>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('paywall-upgrade-btn').addEventListener('click', () => {
    modal.remove();
    const user = getCurrentUser();
    const role = user?.role || 'doctor';
    navigate(`/${role}/billing`);
  });
}

/**
 * Apply lock icons to Elite-only sidebar items (called after subscription status loads)
 */
function applyLockIcons(isElite, role) {
  if (isElite) return; // No locks needed for Elite users

  document.querySelectorAll('.sidebar-link[data-elite="true"]').forEach(link => {
    link.classList.add('sidebar-link--locked');
    // Change href to prevent navigation
    const originalHref = link.getAttribute('href');
    link.setAttribute('data-original-href', originalHref);
    link.setAttribute('href', 'javascript:void(0)');
    // Add lock icon
    const lockIcon = document.createElement('span');
    lockIcon.className = 'material-icons-outlined sidebar-lock-icon';
    lockIcon.style.cssText = 'font-size:14px;margin-left:auto;opacity:0.5;color:#a78bfa;';
    lockIcon.textContent = 'lock';
    link.appendChild(lockIcon);
    // Add click handler for paywall
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const label = link.querySelector('span:nth-child(2)')?.textContent || 'This feature';
      showPaywall(label);
    });
  });

  // Add upgrade pill to header if not already there
  const headerRight = document.querySelector('.top-header-right');
  if (headerRight && !document.getElementById('upgrade-pill')) {
    const pill = document.createElement('a');
    pill.id = 'upgrade-pill';
    pill.href = `#/${role}/billing`;
    pill.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:4px 12px;border-radius:8px;background:linear-gradient(135deg,#4338ca,#7c3aed);color:#fff;font-size:0.7rem;font-weight:700;text-decoration:none;text-transform:uppercase;letter-spacing:0.05em;margin-right:10px;';
    pill.innerHTML = '<span class="material-icons-outlined" style="font-size:14px;">diamond</span> Upgrade';
    headerRight.prepend(pill);
  }
}

/**
 * Render the app shell with sidebar and content area.
 * This is SYNCHRONOUS — it renders immediately, then applies lock icons async.
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
    case 'patient': navItems = PATIENT_NAV; break;
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
            <a href="#${item.path}"
               class="sidebar-link ${activePath === item.path ? 'active' : ''}"
               ${item.elite ? 'data-elite="true"' : ''}
               title="${item.label}">
              <span class="material-icons-outlined">${item.icon}</span>
              <span>${item.label}</span>
            </a>
          `).join('')}
        </nav>

        <div class="sidebar-footer">
          <div class="sidebar-user hover:bg-slate-800 transition-all cursor-pointer p-3 rounded-xl mx-2 mb-2" id="user-menu">
            <div class="sidebar-avatar shadow-lg shadow-primary/20">${initials}</div>
            <div class="sidebar-user-info">
              <div class="sidebar-user-name">${user?.full_name || user?.staff_id || 'User'}</div>
              <div class="sidebar-user-role capitalize">${role}</div>
            </div>
            <span class="material-icons-outlined text-slate-500 group-hover:text-primary transition-colors" style="font-size:18px">chevron_right</span>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="main-content" style="height: 100vh; overflow: hidden;">
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

        <div class="page-content" id="page-content" style="height: calc(100vh - var(--header-height)); overflow-y: auto;">
          ${bodyHTML}
        </div>
      </main>
    </div>
  `;

  // Register global paywall handler
  window.__showPaywall = showPaywall;

  // Profile navigation handler
  document.getElementById('user-menu')?.addEventListener('click', () => {
    const role = getCurrentUser()?.role || 'nurse';
    navigate(`/${role}/profile`);
  });

  // Fetch subscription status ASYNC — apply lock icons after it resolves
  // This does NOT block page rendering
  getSubscriptionStatus().then(sub => {
    const isElite = sub?.plan_id === 'plan_elite' && sub?.status === 'active';
    applyLockIcons(isElite, role);
  });
}
