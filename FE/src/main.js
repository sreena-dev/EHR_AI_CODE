/**
 * AIRA Clinical Workflow — Frontend Entry Point
 * Registers routes and initializes the SPA router.
 */
import './styles/main.css';
import { route, startRouter, navigate } from './router.js';
import { isAuthenticated, getCurrentUser } from './api/auth.js';

// === Page Imports ===

// Auth pages (public)
import { renderLogin } from './pages/login.js';
import { renderForgotPassword } from './pages/forgot-password.js';
import { renderRoleSelection } from './pages/register-role.js';
import { renderRegister } from './pages/register.js';
import { renderActivationSuccess } from './pages/activation-success.js';
import { renderPatientLogin } from './pages/patient-login.js';
import { renderPatientRegister } from './pages/patient-register.js';
import { renderPatientDashboard } from './pages/patient-dashboard.js';

// Clinical workflow pages
import { renderNurseDashboard } from './pages/nurse-dashboard.js';
import { renderDoctorDashboard } from './pages/doctor-dashboard.js';
import { renderOCRUpload } from './pages/ocr-upload.js';
import { renderConsultation } from './pages/consultation.js';
import { renderPatientQueue } from './pages/patient-queue.js';
import { renderNoteVerification } from './pages/note-verification.js';
import { renderClarification } from './pages/clarification.js';
import { renderEMRError } from './pages/emr-error.js';
import { renderClinicalCase } from './pages/clinical-case.js';
import { renderOCRResults } from './pages/ocr-results.js';
import { renderOCREdit } from './pages/ocr-edit.js';
import { renderEMRSuccess } from './pages/emr-success.js';
import { renderLiveConsultation } from './pages/live-consultation.js';
import { renderVitalsEntry } from './pages/vitals-entry.js';

// Utility & settings pages
import { renderProfile } from './pages/profile.js';
import { renderScheduling } from './pages/scheduling.js';
import { renderDraftsRecovery } from './pages/drafts-recovery.js';
import { renderSchedulingPreferences } from './pages/scheduling-preferences.js';
import { renderDiseaseTracking } from './pages/disease-tracking.js';
import { renderPricing } from './pages/pricing.js';

// Admin pages
import { renderAdminDashboard } from './pages/admin-dashboard.js';
import { renderAdminStaff } from './pages/admin-staff.js';
import { renderAdminEncounters } from './pages/admin-encounters.js';
import { renderAdminAudit } from './pages/admin-audit.js';

// Auth guard — redirect to login if not authenticated
function requireAuth(renderFn) {
  return async () => {
    if (!isAuthenticated()) {
      navigate('/login');
      return;
    }
    return renderFn();
  };
}

// ═══════════════════════════════════
// Public routes (no auth required)
// ═══════════════════════════════════
route('/login', renderLogin);
route('/forgot-password', renderForgotPassword);
route('/register-role', renderRoleSelection);
route('/register', renderRegister);
route('/activation-success', renderActivationSuccess);
route('/patient-login', renderPatientLogin);
route('/patient-register', renderPatientRegister);

// ═══════════════════════════════════
// Nurse routes
// ═══════════════════════════════════
route('/nurse/dashboard', requireAuth(renderNurseDashboard));
route('/nurse/ocr', requireAuth(renderOCRUpload));
route('/nurse/ocr-results', requireAuth(renderOCRResults));
route('/nurse/ocr-edit', requireAuth(renderOCREdit));
route('/nurse/queue', requireAuth(renderPatientQueue));
route('/nurse/vitals', requireAuth(renderVitalsEntry));
route('/nurse/tracking', requireAuth(renderDiseaseTracking));
route('/nurse/profile', requireAuth(renderProfile));

// ═══════════════════════════════════
// Doctor routes
// ═══════════════════════════════════
route('/doctor/dashboard', requireAuth(renderDoctorDashboard));
route('/doctor/consultation', requireAuth(renderConsultation));
route('/doctor/live-consultation', requireAuth(renderLiveConsultation));
route('/doctor/notes', requireAuth(renderConsultation));
route('/doctor/queue', requireAuth(renderPatientQueue));
route('/doctor/note-verification', requireAuth(renderNoteVerification));
route('/doctor/clarification', requireAuth(renderClarification));
route('/doctor/emr-error', requireAuth(renderEMRError));
route('/doctor/profile', requireAuth(renderProfile));
route('/doctor/scheduling', requireAuth(renderScheduling));
route('/doctor/schedule', requireAuth(renderScheduling));
route('/doctor/drafts', requireAuth(renderDraftsRecovery));
route('/doctor/case', requireAuth(renderClinicalCase));
route('/doctor/emr-success', requireAuth(renderEMRSuccess));
route('/doctor/scheduling-preferences', requireAuth(renderSchedulingPreferences));
route('/doctor/tracking', requireAuth(renderDiseaseTracking));
route('/doctor/billing', requireAuth(renderPricing));

// ═══════════════════════════════════
// Admin routes
// ═══════════════════════════════════
route('/admin/dashboard', requireAuth(renderAdminDashboard));
route('/admin/staff', requireAuth(renderAdminStaff));
route('/admin/encounters', requireAuth(renderAdminEncounters));
route('/admin/audit', requireAuth(renderAdminAudit));
route('/admin/queue', requireAuth(renderPatientQueue));
route('/admin/profile', requireAuth(renderProfile));
route('/admin/billing', requireAuth(renderPricing));

// ═══════════════════════════════════
// Patient routes
// ═══════════════════════════════════
route('/patient/dashboard', requireAuth(renderPatientDashboard));
route('/patient/records', requireAuth(renderPatientDashboard));  // Records view TBD
route('/patient/profile', requireAuth(renderProfile));

// Default route
route('/', () => {
  if (isAuthenticated()) {
    const user = getCurrentUser();
    const role = user?.role;
    if (role === 'patient') navigate('/patient/dashboard');
    else if (role === 'doctor') navigate('/doctor/dashboard');
    else if (role === 'admin') navigate('/admin/dashboard');
    else navigate('/nurse/dashboard');
  } else {
    navigate('/login');
  }
});

// Start the app
startRouter();
