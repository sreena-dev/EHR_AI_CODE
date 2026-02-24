/**
 * Staff Profile Page — Redesigned professional profile for Doctors and Nurses
 */
import { renderAppShell } from '../components/app-shell.js';
import { getCurrentUser, logout } from '../api/auth.js';
import { navigate } from '../router.js';

export async function renderProfile() {
    const user = getCurrentUser();
    const role = user?.role || 'nurse';
    const initials = (user?.full_name || user?.staff_id || 'U')
        .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    // Dynamic content based on role
    const isDoctor = role === 'doctor';

    // Mock data expansion
    const profileData = {
        name: user?.full_name || (isDoctor ? 'Dr. Anand Krishnamurthy' : 'Nurse Priya Sharma'),
        staffId: user?.staff_id || (isDoctor ? 'DOC-078' : 'NUR-112'),
        email: user?.email || (isDoctor ? 'anand.k@chennai-clinic.org' : 'priya.s@chennai-clinic.org'),
        phone: isDoctor ? '+91 98765 11234' : '+91 91234 56789',
        department: isDoctor ? 'General Medicine (Floor 1)' : 'Emergency/OPD',
        specialization: isDoctor ? 'General Medicine' : 'Critical Care',
        license: isDoctor ? 'MCI-TN-2018-084721' : 'TNC-2020-44122',
        joinDate: '15 Mar 2018',
        consultations: 12847,
        avgRating: 4.8,
        notesGenerated: 3206,
        scansProcessed: 842
    };

    const bodyHTML = `
    <div class="profile-page max-w-5xl mx-auto p-6 md:p-10 animate-in fade-in duration-500">
      
      <div class="flex flex-col lg:flex-row gap-8">
        
        <!-- Left Column: Primary Identity -->
        <div class="lg:w-1/3 space-y-6">
          <div class="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center">
            <div class="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-white flex items-center justify-center text-3xl font-bold mx-auto mb-6 shadow-xl shadow-blue-500/20 ring-4 ring-white">
              ${initials}
            </div>
            <h2 class="text-xl font-bold text-slate-900 mb-1">${profileData.name}</h2>
            <p class="text-sm font-medium text-slate-500 mb-4">${profileData.specialization}</p>
            
            <div class="flex justify-center gap-2 mb-6">
              <span class="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-blue-100">${profileData.staffId}</span>
              <span class="px-3 py-1 bg-green-50 text-green-600 rounded-full text-[10px] font-bold uppercase tracking-wider border border-green-100">Active</span>
            </div>

            <div class="pt-6 border-t border-slate-50 flex flex-col gap-3">
              <div class="flex items-center gap-3 text-sm text-slate-600">
                <span class="material-icons-outlined text-slate-400 text-[18px]">email</span>
                <span class="truncate">${profileData.email}</span>
              </div>
              <div class="flex items-center gap-3 text-sm text-slate-600">
                <span class="material-icons-outlined text-slate-400 text-[18px]">phone</span>
                <span>${profileData.phone}</span>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm">
             <h3 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">Clinical Performance</h3>
             <div class="grid grid-cols-2 gap-4">
                <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">${isDoctor ? 'Consults' : 'Scans'}</p>
                  <p class="text-lg font-bold text-slate-900">${isDoctor ? profileData.consultations.toLocaleString() : profileData.scansProcessed.toLocaleString()}</p>
                </div>
                <div class="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Rating</p>
                  <p class="text-lg font-bold text-slate-900">${profileData.avgRating} <span class="text-sm text-amber-500">★</span></p>
                </div>
             </div>
          </div>
        </div>

        <!-- Right Column: Details & Settings -->
        <div class="lg:w-2/3 space-y-6">
          
          <!-- Clinical Credentials -->
          <div class="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
            <div class="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
            
            <h3 class="text-base font-bold text-slate-900 mb-8 flex items-center gap-3">
              <span class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
                <span class="material-icons-outlined">verified</span>
              </span>
              Clinical Credentials
            </h3>

            <div class="grid md:grid-cols-2 gap-8">
              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">License Number</label>
                <div class="flex items-center gap-2">
                   <p class="text-sm font-bold text-slate-800">${profileData.license}</p>
                   <span class="text-green-500 material-icons text-[16px]">verified</span>
                </div>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Department</label>
                <p class="text-sm font-semibold text-slate-700">${profileData.department}</p>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Service Joined</label>
                <p class="text-sm font-semibold text-slate-700">${profileData.joinDate}</p>
              </div>
              <div>
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Account Role</label>
                <p class="text-sm font-bold text-blue-600 capitalize">${role}</p>
              </div>
            </div>
          </div>

          <!-- Account Settings -->
          <div class="bg-white rounded-3xl p-8 border border-slate-200 shadow-sm">
            <h3 class="text-base font-bold text-slate-900 mb-8 flex items-center gap-3">
              <span class="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-100">
                <span class="material-icons-outlined">settings</span>
              </span>
              Account & Security
            </h3>

            <div class="space-y-4">
               <button class="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-all group border border-transparent hover:border-slate-100">
                  <div class="flex items-center gap-4 text-left">
                    <span class="material-icons-outlined text-slate-400 group-hover:text-slate-600">lock</span>
                    <div>
                      <p class="text-sm font-bold text-slate-700">Change Password</p>
                      <p class="text-[11px] text-slate-400 font-medium">Update your account security credentials</p>
                    </div>
                  </div>
                  <span class="material-icons text-slate-300 group-hover:text-slate-500">chevron_right</span>
               </button>

               <button class="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-all group border border-transparent hover:border-slate-100">
                  <div class="flex items-center gap-4 text-left">
                    <span class="material-icons-outlined text-slate-400 group-hover:text-slate-600">notifications</span>
                    <div>
                      <p class="text-sm font-bold text-slate-700">Notification Settings</p>
                      <p class="text-[11px] text-slate-400 font-medium">Manage how you receive clinical alerts</p>
                    </div>
                  </div>
                  <span class="material-icons text-slate-300 group-hover:text-slate-500">chevron_right</span>
               </button>

               <div class="pt-6 mt-4 border-t border-slate-50">
                 <button id="profile-logout" class="w-full flex items-center justify-center gap-3 p-4 bg-red-50 text-red-600 rounded-2xl font-bold transition-all hover:bg-red-100 border border-red-100/50 shadow-sm">
                   <span class="material-icons-outlined">logout</span>
                   <span>Logout from AIRA Workflow</span>
                 </button>
               </div>
            </div>
          </div>

        </div>
      </div>
    </div>
    `;

    renderAppShell('Profile', bodyHTML, isDoctor ? '/doctor/profile' : '/nurse/profile');

    // Attach Event Listeners
    document.getElementById('profile-logout')?.addEventListener('click', () => {
        if (confirm('Are you sure you want to sign out of your AIRA session?')) {
            logout();
            navigate('/login');
        }
    });
}
