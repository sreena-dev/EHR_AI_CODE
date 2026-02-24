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
    <div class="profile-page w-full min-h-full p-4 lg:p-6 animate-in fade-in duration-500">
      
      <div class="flex flex-col lg:flex-row gap-6 items-stretch">
        
        <!-- Left Column: Primary Identity -->
        <div class="lg:w-1/4 space-y-6 flex flex-col">
          <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm text-center flex-1">
            <div class="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center text-2xl font-bold mx-auto mb-4 shadow-lg shadow-blue-500/10 ring-4 ring-blue-50">
              ${initials}
            </div>
            <h2 class="text-base font-bold text-slate-900 mb-0.5">${profileData.name}</h2>
            <p class="text-xs font-medium text-slate-500 mb-4">${profileData.specialization}</p>
            
            <div class="flex justify-center gap-2 mb-6">
              <span class="px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md text-[9px] font-bold uppercase tracking-wider border border-slate-200">${profileData.staffId}</span>
              <span class="px-2 py-0.5 bg-green-50 text-green-600 rounded-md text-[9px] font-bold uppercase tracking-wider border border-green-100">Status: Active</span>
            </div>

            <div class="pt-6 border-t border-slate-50 flex flex-col gap-3">
              <div class="flex items-center gap-3 text-xs text-slate-600">
                <div class="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                  <span class="material-icons-outlined text-[16px]">email</span>
                </div>
                <span class="truncate font-medium">${profileData.email}</span>
              </div>
              <div class="flex items-center gap-3 text-xs text-slate-600">
                <div class="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400">
                  <span class="material-icons-outlined text-[16px]">phone</span>
                </div>
                <span class="font-medium">${profileData.phone}</span>
              </div>
            </div>
          </div>

          <div class="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
             <h3 class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Clinical Overview</h3>
             <div class="grid grid-cols-1 gap-3">
                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span class="text-[10px] font-bold text-slate-400 uppercase">${isDoctor ? 'Total Consults' : 'Total Scans'}</span>
                  <span class="text-sm font-bold text-slate-900">${isDoctor ? profileData.consultations.toLocaleString() : profileData.scansProcessed.toLocaleString()}</span>
                </div>
                <div class="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <span class="text-[10px] font-bold text-slate-400 uppercase">Patient Rating</span>
                  <span class="text-sm font-bold text-amber-600">${profileData.avgRating} <span class="text-[10px]">★</span></span>
                </div>
             </div>
          </div>
        </div>

        <!-- Right Column: Details & Settings -->
        <div class="lg:w-3/4 space-y-6">
          
          <!-- Clinical Credentials -->
          <div class="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm relative overflow-hidden">
            <div class="absolute top-0 right-0 w-32 h-32 bg-blue-50/20 rounded-full -mr-16 -mt-16 pointer-events-none"></div>
            
            <h3 class="text-sm font-bold text-slate-900 mb-8 flex items-center gap-3">
              <span class="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 shadow-sm">
                <span class="material-icons-outlined text-lg">verified</span>
              </span>
              Clinical Professional Credentials
            </h3>

            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">State License ID</label>
                <div class="flex items-center gap-2">
                   <p class="text-sm font-bold text-slate-800">${profileData.license}</p>
                   <span class="text-green-500 material-icons text-[14px]">verified</span>
                </div>
              </div>
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Medical Department</label>
                <p class="text-sm font-bold text-slate-800">${profileData.department}</p>
              </div>
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clinical Designation</label>
                <p class="text-sm font-bold text-blue-600 capitalize">${role}</p>
              </div>
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registration Date</label>
                <p class="text-sm font-bold text-slate-800">${profileData.joinDate}</p>
              </div>
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Primary Facility</label>
                <p class="text-sm font-bold text-slate-800">AIRA General Hospital</p>
              </div>
              <div class="space-y-1">
                <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-widest">Shift Schedule</label>
                <div class="flex items-center gap-1.5">
                   <span class="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                   <p class="text-sm font-bold text-slate-800">Day Shift (Active)</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Account Settings -->
          <div class="bg-white rounded-2xl p-8 border border-slate-200 shadow-sm grow">
            <h3 class="text-sm font-bold text-slate-900 mb-8 flex items-center gap-3">
              <span class="w-8 h-8 rounded-lg bg-slate-50 text-slate-600 flex items-center justify-center border border-slate-100 shadow-sm">
                <span class="material-icons-outlined text-lg">settings</span>
              </span>
              Security & Global Controls
            </h3>

            <div class="grid md:grid-cols-2 gap-4">
               <button class="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 hover:bg-white transition-all group border border-transparent hover:border-slate-200 hover:shadow-md hover:shadow-slate-200/40">
                  <div class="flex items-center gap-4 text-left">
                    <div class="w-8 h-8 rounded-lg bg-white text-slate-400 group-hover:text-blue-600 flex items-center justify-center border border-slate-100 transition-colors">
                       <span class="material-icons-outlined text-lg">lock</span>
                    </div>
                    <div>
                      <p class="text-sm font-bold text-slate-800">Security Access</p>
                      <p class="text-[10px] text-slate-500 font-medium">Password & 2FA</p>
                    </div>
                  </div>
                  <span class="material-icons text-slate-300 group-hover:text-blue-600 transition-all">chevron_right</span>
               </button>

               <button class="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 hover:bg-white transition-all group border border-transparent hover:border-slate-200 hover:shadow-md hover:shadow-slate-200/40">
                  <div class="flex items-center gap-4 text-left">
                    <div class="w-8 h-8 rounded-lg bg-white text-slate-400 group-hover:text-blue-600 flex items-center justify-center border border-slate-100 transition-colors">
                       <span class="material-icons-outlined text-lg">notifications</span>
                    </div>
                    <div>
                      <p class="text-sm font-bold text-slate-800">Alert Center</p>
                      <p class="text-[10px] text-slate-500 font-medium">Notification rules</p>
                    </div>
                  </div>
                  <span class="material-icons text-slate-300 group-hover:text-blue-600 transition-all">chevron_right</span>
               </button>
            </div>

            <div class="pt-8 mt-6 border-t border-slate-100">
              <button id="profile-logout" class="group relative w-full overflow-hidden rounded-xl bg-red-50 p-4 text-red-600 transition-all hover:bg-red-600 hover:text-white border border-red-100/50 shadow-sm flex items-center justify-center gap-2">
                 <div class="absolute inset-0 bg-gradient-to-r from-red-600 to-red-700 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                 <span class="material-icons-outlined relative z-10 text-lg">logout</span>
                 <span class="text-sm font-bold relative z-10 uppercase tracking-widest">End Session & Logout</span>
              </button>
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
