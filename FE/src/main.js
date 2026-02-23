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

// Utility & settings pages
import { renderDoctorProfile } from './pages/doctor-profile.js';
import { renderScheduling } from './pages/scheduling.js';
import { renderDraftsRecovery } from './pages/drafts-recovery.js';
import { renderSchedulingPreferences } from './pages/scheduling-preferences.js';

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

// ═══════════════════════════════════
// Nurse routes
// ═══════════════════════════════════
route('/nurse/dashboard', requireAuth(renderNurseDashboard));
route('/nurse/ocr', requireAuth(renderOCRUpload));
route('/nurse/ocr-results', requireAuth(renderOCRResults));
route('/nurse/ocr-edit', requireAuth(renderOCREdit));
route('/nurse/queue', requireAuth(renderPatientQueue));

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
route('/doctor/profile', requireAuth(renderDoctorProfile));
route('/doctor/scheduling', requireAuth(renderScheduling));
route('/doctor/schedule', requireAuth(renderScheduling));
route('/doctor/drafts', requireAuth(renderDraftsRecovery));
route('/doctor/case', requireAuth(renderClinicalCase));
route('/doctor/emr-success', requireAuth(renderEMRSuccess));
route('/doctor/scheduling-preferences', requireAuth(renderSchedulingPreferences));

// ═══════════════════════════════════
// Admin routes
// ═══════════════════════════════════
route('/admin/dashboard', requireAuth(renderNurseDashboard));
route('/admin/queue', requireAuth(renderPatientQueue));

// Default route
route('/', () => {
  if (isAuthenticated()) {
    const user = getCurrentUser();
    navigate(user?.role === 'doctor' ? '/doctor/dashboard' : '/nurse/dashboard');
  } else {
    navigate('/login');
  }
});

// Start the app
startRouter();
