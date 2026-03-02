/**
 * Disease Tracking — Matches provided design for "Patient Management" and "Disease Tracking"
 */
import { renderAppShell } from '../components/app-shell.js';
import { getCurrentUser } from '../api/auth.js';

export async function renderDiseaseTracking() {
  const bodyHTML = `
    <div class="disease-tracking-page h-full flex flex-col overflow-hidden bg-[#f8fafc]">
      <div class="flex-1 overflow-y-auto custom-scrollbar p-8">
        <!-- Patient Queue Section -->
        <div class="mb-10 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div class="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
              <span class="material-icons text-[#2563EB]">pending_actions</span>
              Active Patient Queue
            </h2>
            <div class="flex items-center gap-2">
              <span class="text-xs font-medium px-2 py-1 bg-[#2563EB]/10 text-[#2563EB] rounded-full">8 In-Clinic</span>
            </div>
          </div>
          <div class="overflow-x-auto">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                  <th class="px-6 py-4">Patient ID</th>
                  <th class="px-6 py-4">Chief Complaint</th>
                  <th class="px-6 py-4">Language</th>
                  <th class="px-6 py-4">Status</th>
                  <th class="px-6 py-4">Check-in</th>

                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 text-sm">
                <tr class="bg-amber-50/30 hover:bg-amber-100/30 transition-colors group">
                  <td class="px-6 py-4">
                    <a class="font-bold text-[#2563EB] hover:underline" href="#">PID-9822</a>
                  </td>
                  <td class="px-6 py-4">
                    <span class="font-medium text-slate-900">Severe Chest Pain</span>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                      <span class="text-lg">🇮🇳</span>
                      <span class="text-slate-700">Tamil</span>
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse-amber">
                      <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                      OCR Review Needed
                    </span>
                  </td>
                  <td class="px-6 py-4 text-slate-600 font-mono">10:45 AM</td>

                </tr>
                <tr class="hover:bg-slate-50 transition-colors">
                  <td class="px-6 py-4">
                    <a class="font-bold text-[#2563EB] hover:underline" href="#">PID-4431</a>
                  </td>
                  <td class="px-6 py-4">
                    <span class="font-medium text-slate-900">Fever & Chills</span>
                  </td>
                  <td class="px-6 py-4">
                    <div class="flex items-center gap-2">
                      <span class="text-lg">🇮🇳</span>
                      <span class="text-slate-700">Hindi</span>
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-[#2563EB] border border-[#2563EB]/20">
                      <span class="w-1.5 h-1.5 rounded-full bg-[#2563EB]"></span>
                      Ready for Consult
                    </span>
                  </td>
                  <td class="px-6 py-4 text-slate-600 font-mono">10:50 AM</td>

                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Disease Tracking Stats Section -->
        <div class="mb-8">
          <h2 class="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
            <span class="material-icons text-[#2563EB]">analytics</span>
            Disease Tracking • Today’s Encounters
          </h2>
          <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <!-- Top Conditions -->
            <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div class="flex items-center justify-between mb-6">
                <h3 class="text-sm font-semibold text-slate-700">Top Conditions</h3>
                <span class="material-icons text-slate-400 text-sm">more_horiz</span>
              </div>
              <div class="space-y-5">
                <div class="space-y-2">
                  <div class="flex items-center justify-between text-xs font-medium">
                    <div class="flex items-center gap-2">
                      <span class="material-symbols-outlined text-[16px] text-[#2563EB]">pulmonology</span>
                      <span class="text-slate-600">Respiratory</span>
                    </div>
                    <span class="text-slate-900">42%</span>
                  </div>
                  <div class="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div class="h-full bg-[#2563EB] rounded-full" style="width: 42%"></div>
                  </div>
                </div>
                <!-- Add more conditions similarly -->
              </div>
            </div>

            <!-- Language Distribution -->
            <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-sm font-semibold text-slate-700">Language Distribution</h3>
              </div>
              <div class="relative flex justify-center py-2">
                <svg class="w-32 h-32 transform -rotate-90">
                  <circle class="text-[#2563EB]" cx="64" cy="64" fill="transparent" r="50" stroke="currentColor" stroke-dasharray="314.15" stroke-dashoffset="125.6" stroke-width="20"></circle>
                  <circle class="text-orange-400" cx="64" cy="64" fill="transparent" r="50" stroke="currentColor" stroke-dasharray="314.15" stroke-dashoffset="235.6" stroke-width="20"></circle>
                  <circle class="text-slate-300" cx="64" cy="64" fill="transparent" r="50" stroke="currentColor" stroke-dasharray="314.15" stroke-dashoffset="282.7" stroke-width="20"></circle>
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span class="text-lg font-bold text-slate-900">24</span>
                  <span class="text-[10px] text-slate-500">Total</span>
                </div>
              </div>
              <!-- Language Details -->
            </div>

            <!-- Priority Matrix -->
            <div class="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
              <div class="flex items-center justify-between mb-4">
                <h3 class="text-sm font-semibold text-slate-700">Priority Matrix</h3>
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Urgency vs Volume</span>
              </div>
              <div class="flex-1 grid grid-cols-2 grid-rows-2 gap-1 border-l border-b border-slate-300 relative p-1">
                <div class="bg-red-50 rounded-sm flex items-center justify-center p-2 relative">
                  <div class="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm animate-pulse"></div>
                  <span class="absolute top-1 left-1 text-[8px] text-red-700/60 font-bold uppercase">Critical</span>
                </div>
                <!-- Matrix details -->
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <style>
      @keyframes pulse-subtle {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.85; transform: scale(0.98); }
      }
      .animate-pulse-amber {
        animation: pulse-subtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }
    </style>
  `;

  const user = getCurrentUser();
  const activePath = user?.role === 'doctor' ? '/doctor/tracking' : '/nurse/tracking';
  renderAppShell('Disease Tracking', bodyHTML, activePath);
}
