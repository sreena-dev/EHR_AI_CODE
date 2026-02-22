/**
 * Doctor Schedule Page — Monthly View
 * Matches the provided Stitch design for "Doctor Schedule - Monthly View".
 */
import { navigate } from '../router.js';
import { getCurrentUser } from '../api/auth.js';

export async function renderDoctorSchedule() {
    const user = getCurrentUser();
    const name = user?.full_name || 'Dr. Anand Kumar';

    // Determine the active class for sidebar links
    const getActiveClass = (path) => location.hash === `#${path}` ? 'bg-primary/10 text-primary font-medium' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900';

    const bodyHTML = `
    <!-- External Resources -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap" rel="stylesheet"/>
    
    <style>
        :root {
            --primary: #2563EB;
        }
        .calendar-month-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            grid-template-rows: repeat(5, 1fr);
            height: 100%;
        }
        .calendar-cell {
            border-right: 1px solid #e2e8f0;
            border-bottom: 1px solid #e2e8f0;
            transition: all 0.2s;
        }
        .calendar-cell:hover {
            background-color: #f1f5f9;
        }
        .calendar-cell.active {
            background-color: #eff6ff;
            border-left: 2px solid var(--primary);
        }
        .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 10px;
        }
        .material-symbols-outlined {
            font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        }
    </style>

    <div class="bg-background-light text-slate-800 h-screen overflow-hidden flex font-display transition-colors duration-200" style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; z-index: 1000;">
        <aside class="w-64 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col justify-between z-20">
            <div>
                <div class="h-16 flex items-center px-6 border-b border-slate-100">
                    <div class="flex items-center gap-2 text-primary font-bold text-xl">
                        <span class="material-icons">local_hospital</span>
                        <span>MediCare<span class="font-light text-slate-500">Pro</span></span>
                    </div>
                </div>
                <nav class="p-4 space-y-1">
                    <p class="px-2 text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Main</p>
                    <a class="flex items-center gap-3 px-3 py-2.5 rounded-lg ${getActiveClass('/doctor/dashboard')}" href="#/doctor/dashboard">
                        <span class="material-icons text-[20px]">dashboard</span>
                        Overview
                    </a>
                    <a class="flex items-center gap-3 px-3 py-2.5 rounded-lg ${getActiveClass('/doctor/schedule')}" href="#/doctor/schedule">
                        <span class="material-icons text-[20px]">calendar_today</span>
                        Schedule
                    </a>
                    <a class="flex items-center gap-3 px-3 py-2.5 rounded-lg ${getActiveClass('/doctor/queue')}" href="#/doctor/queue">
                        <span class="material-icons text-[20px]">people</span>
                        Patients
                    </a>
                    <a class="flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors" href="#">
                        <span class="material-icons text-[20px]">chat_bubble_outline</span>
                        Messages
                        <span class="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">3</span>
                    </a>
                </nav>
            </div>
            <div class="p-4 border-t border-slate-100">
                <div class="flex items-center gap-3 cursor-pointer" id="schedule-user-profile">
                    <img alt="${name}" class="w-10 h-10 rounded-full object-cover border-2 border-white shadow-sm" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBovmBnlrLrMiYQln-6gkkw3fM6pDqSoaX7paIi8oweuL1d8Lpy4YZ1LhEV80nwJyIWaP2dLxEX-MPc6-KqNHFgBewlDpjSkV_-gHkWfiY80f3kqQQ2MqiBkRgsy9oC-Lei67HWN4KsdQYst3ojs0GT78ruAhiZhgedAJ9G9qdYAvdj4mTsYvydZZH0p354bl8an0cuQ9zfvVHBiWgWMGTXclDEhx_zilMGUEKzDnRIkvj3X0PZ3T2CNcNK-OKQJZNzFef4fY3p0iY"/>
                    <div class="flex-1 min-w-0">
                        <p class="text-sm font-semibold text-slate-900 truncate">${name}</p>
                        <p class="text-xs text-slate-500 truncate">Internal Medicine</p>
                    </div>
                </div>
            </div>
        </aside>

        <div class="flex-1 flex flex-col min-w-0 relative">
            <header class="h-16 flex items-center justify-between px-6 bg-white border-b border-slate-200 shrink-0">
                <div class="flex items-center gap-6">
                    <h1 class="text-lg font-bold text-slate-900 whitespace-nowrap">Schedule • ${name}</h1>
                    <div class="flex items-center bg-slate-100 rounded-lg p-1">
                        <button class="p-1 hover:bg-white rounded transition-all"><span class="material-icons text-sm">chevron_left</span></button>
                        <button class="px-3 py-1 text-sm font-medium hover:bg-white rounded transition-all">Today</button>
                        <button class="p-1 hover:bg-white rounded transition-all"><span class="material-icons text-sm">chevron_right</span></button>
                    </div>
                    <span class="text-lg font-semibold text-slate-700">February 2024</span>
                </div>
                <div class="flex items-center gap-4">
                    <div class="flex bg-slate-100 rounded-lg p-1">
                        <button class="px-4 py-1 text-xs font-medium text-slate-500 hover:text-slate-900">Day</button>
                        <button class="px-4 py-1 text-xs font-medium text-slate-500 hover:text-slate-900">Week</button>
                        <button class="px-4 py-1 text-xs font-bold text-primary bg-white rounded shadow-sm">Month</button>
                        <button class="px-4 py-1 text-xs font-medium text-slate-500 hover:text-slate-900">Agenda</button>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold flex items-center gap-1 border border-blue-100">
                            Today <span class="bg-blue-600 text-white px-1.5 rounded-full">8</span>
                        </div>
                        <div class="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold flex items-center gap-1 border border-amber-100">
                            Review <span class="bg-amber-600 text-white px-1.5 rounded-full">3</span>
                        </div>
                        <div class="px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold flex items-center gap-1 border border-green-100">
                            EMR <span class="bg-green-600 text-white px-1.5 rounded-full">2</span>
                        </div>
                        <div class="px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold flex items-center gap-1 border border-red-100">
                            Overdue <span class="bg-red-600 text-white px-1.5 rounded-full">1</span>
                        </div>
                    </div>
                </div>
            </header>

            <div class="bg-white px-6 py-3 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
                <div class="flex-1 flex items-center gap-3">
                    <div class="relative w-64">
                        <span class="material-icons text-slate-400 absolute left-3 top-2.5 text-lg">search</span>
                        <input class="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-full" placeholder="Search appointments..." type="text"/>
                    </div>
                    <div class="flex items-center gap-2">
                        <button class="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1">Status <span class="material-icons text-xs">expand_more</span></button>
                        <button class="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1">Visit Type <span class="material-icons text-xs">expand_more</span></button>
                        <button class="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1">Department <span class="material-icons text-xs">expand_more</span></button>
                        <button class="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-2">
                            Language
                            <div class="flex items-center">
                                <div class="w-4 h-2.5 rounded shadow-sm bg-gradient-to-b from-orange-400 via-white to-green-600 relative overflow-hidden border border-slate-200" title="Hindi/Tamil"></div>
                            </div>
                            <span class="material-icons text-xs">expand_more</span>
                        </button>
                    </div>
                </div>
            </div>

            <main class="flex-1 overflow-hidden flex">
                <div class="flex-1 bg-white overflow-hidden flex flex-col">
                    <div class="grid grid-cols-7 border-b border-slate-200 text-center py-2 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                    </div>
                    <div class="flex-1 calendar-month-grid">
                        <div class="calendar-cell p-2 text-slate-400 bg-slate-50/50">28</div>
                        <div class="calendar-cell p-2 text-slate-400 bg-slate-50/50">29</div>
                        <div class="calendar-cell p-2 text-slate-400 bg-slate-50/50">30</div>
                        <div class="calendar-cell p-2 text-slate-400 bg-slate-50/50">31</div>
                        <div class="calendar-cell p-2">
                            <span class="text-sm font-semibold">1</span>
                            <div class="mt-1 space-y-1">
                                <div class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-[9px] font-bold text-blue-700">
                                    <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 5 Booked
                                </div>
                            </div>
                        </div>
                        <div class="calendar-cell p-2">
                            <span class="text-sm font-semibold">2</span>
                            <div class="mt-1 space-y-1">
                                <div class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-[9px] font-bold text-amber-700">
                                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> 2 Review
                                </div>
                            </div>
                        </div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold">3</span></div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold">4</span></div>
                        <div class="calendar-cell p-2">
                            <span class="text-sm font-semibold text-primary">5</span>
                            <div class="mt-1 flex flex-wrap gap-1">
                                <div class="w-2 h-2 rounded-full bg-blue-500"></div>
                                <div class="w-2 h-2 rounded-full bg-blue-500"></div>
                                <div class="w-2 h-2 rounded-full bg-amber-500"></div>
                            </div>
                        </div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold">6</span></div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold">7</span></div>
                        <div class="calendar-cell p-2">
                            <span class="text-sm font-semibold">8</span>
                            <div class="mt-1">
                                <div class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-[9px] font-bold text-red-700">
                                    <span class="w-1.5 h-1.5 rounded-full bg-red-500"></span> 1 Overdue
                                </div>
                            </div>
                        </div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold">9</span></div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold">10</span></div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold">11</span></div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold">12</span></div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold">13</span></div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold">14</span></div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold">15</span></div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold">16</span></div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold">17</span></div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold text-slate-400">18</span></div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold">19</span></div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold">20</span></div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold">21</span></div>
                        <div class="calendar-cell p-2 active">
                            <div class="flex justify-between items-start">
                                <span class="text-sm font-bold text-primary">22</span>
                                <span class="text-[9px] bg-primary text-white px-1 rounded">Today</span>
                            </div>
                            <div class="mt-2 space-y-1">
                                <div class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-[9px] font-bold text-blue-700">
                                    <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span> 8 Booked
                                </div>
                                <div class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-[9px] font-bold text-amber-700">
                                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> 3 Review
                                </div>
                            </div>
                        </div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold">23</span></div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold text-slate-400">24</span></div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold text-slate-400">25</span></div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold">26</span></div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold">27</span></div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold">28</span></div>
                        <div class="calendar-cell p-2"><span class="text-sm font-semibold">29</span></div>
                        <div class="calendar-cell p-2 text-slate-400 bg-slate-50/50">1</div>
                        <div class="calendar-cell p-2 text-slate-400 bg-slate-50/50 border-r-0">2</div>
                    </div>
                </div>
                <aside class="w-80 border-l border-slate-200 bg-white flex flex-col shrink-0">
                    <div class="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <span class="material-icons text-primary text-[20px]">list_alt</span>
                            Feb 22 Agenda
                        </h2>
                        <span class="text-[10px] text-slate-500 font-medium">11 Appts</span>
                    </div>
                    <div class="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4">
                        <div class="p-4 rounded-xl border border-primary/20 bg-blue-50/50">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <h4 class="font-bold text-slate-900">Sarah Johnson</h4>
                                    <p class="text-xs text-slate-500">PT-101 • 11:30 AM</p>
                                </div>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 uppercase">In Queue</span>
                            </div>
                            <p class="text-xs text-slate-600 mb-4">Routine Physical Examination</p>
                            <button class="w-full py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm">
                                Start Consultation
                            </button>
                        </div>
                        <div class="p-4 rounded-xl border border-slate-100 bg-white shadow-sm">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <h4 class="font-bold text-slate-900">Rahul Sharma</h4>
                                    <p class="text-xs text-slate-500">PT-204 • 12:15 PM</p>
                                </div>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 uppercase">Review</span>
                            </div>
                            <p class="text-xs text-slate-600 mb-4">Follow-up: Lab Results</p>
                            <button class="w-full py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors">
                                Open Chart
                            </button>
                        </div>
                        <div class="p-4 rounded-xl border border-slate-100 bg-white shadow-sm opacity-60">
                            <div class="flex justify-between items-start mb-2">
                                <div>
                                    <h4 class="font-bold text-slate-900">Michael Ross</h4>
                                    <p class="text-xs text-slate-500">PT-102 • 10:15 AM</p>
                                </div>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 uppercase">Completed</span>
                            </div>
                            <button class="w-full py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors">
                                View Summary
                            </button>
                        </div>
                    </div>
                </aside>
            </main>
            <footer class="h-16 bg-white border-t border-slate-200 px-6 flex items-center shrink-0 z-20">
                <div class="flex items-center justify-between w-full max-w-7xl mx-auto">
                    <div class="flex items-center gap-4">
                        <button class="flex items-center gap-2 text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                            <span class="material-icons text-[18px]">layers</span>
                            Bulk Actions
                        </button>
                    </div>
                    <div class="flex items-center gap-3">
                        <button class="flex items-center gap-2 text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                            <span class="material-icons text-[18px]">print</span>
                            Print Schedule
                        </button>
                        <button class="flex items-center gap-2 text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                            <span class="material-icons text-[18px]">ios_share</span>
                            Export
                        </button>
                    </div>
                </div>
            </footer>
        </div>
    </div>
    `;

    document.getElementById('app').innerHTML = bodyHTML;

    // Wire up events
    document.getElementById('schedule-user-profile')?.addEventListener('click', () => {
        navigate('/doctor/profile');
    });
}
