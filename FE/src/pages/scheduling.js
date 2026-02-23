/**
 * Doctor Schedule — Full Monthly Calendar & Agenda View
 * Restored to the original high-fidelity premium design.
 */
import { navigate } from '../router.js';
import { getCurrentUser } from '../api/auth.js';
import { showToast as notify } from '../components/toast.js';
import { renderAppShell } from '../components/app-shell.js';

export async function renderScheduling() {
    const user = getCurrentUser();
    const name = user?.full_name || 'Dr. Anand Kumar';

    // --- Mock Data ---
    const APPOINTMENTS = [
        { id: 1, patient: 'Sarah Johnson', time: '11:30 AM', idNum: 'PT-101', status: 'booked', type: 'Routine Physical Examination', day: 22, visitType: 'physical', department: 'cardiology' },
        { id: 2, patient: 'Rahul Sharma', time: '12:15 PM', idNum: 'PT-204', status: 'review', type: 'Follow-up: Lab Results', day: 22, visitType: 'consult', department: 'neurology' },
        { id: 3, patient: 'Michael Ross', time: '10:15 AM', idNum: 'PT-102', status: 'completed', type: 'General Checkup', day: 22, visitType: 'physical', department: 'cardiology' },
        { id: 4, patient: 'Emma Watson', time: '09:45 AM', idNum: 'PT-305', status: 'overdue', type: 'Thyroid Review', day: 8, visitType: 'emergency', department: 'endocrinology' },
        { id: 5, patient: 'James Bond', time: '02:00 PM', idNum: 'PT-007', status: 'booked', type: 'Physical Trauma', day: 5, visitType: 'emergency', department: 'trauma' },
        { id: 6, patient: 'Peter Parker', time: '10:00 AM', idNum: 'PT-088', status: 'emr', type: 'Radiation Exposure', day: 22, visitType: 'consult', department: 'radiology' },
    ];

    let selectedDate = new Date(2024, 1, 22);
    let viewDate = new Date(2024, 1, 1);
    let statusFilter = 'all';
    let visitTypeFilter = 'all';
    let departmentFilter = 'all';
    let searchQuery = '';

    const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    // --- Rendering Helpers ---
    function getAgendaHTML() {
        const filtered = APPOINTMENTS.filter(app => {
            // For mock consistency, we only match 'day' if it's Feb 2024 as per current data
            // In a real app, we would match full date
            const isSelectedMonthYear = selectedDate.getMonth() === 1 && selectedDate.getFullYear() === 2024;
            const dayMatch = isSelectedMonthYear && app.day === selectedDate.getDate();

            const statusMatch = statusFilter === 'all' || app.status === statusFilter;
            const visitMatch = visitTypeFilter === 'all' || app.visitType === visitTypeFilter;
            const deptMatch = departmentFilter === 'all' || app.department === departmentFilter;

            const query = searchQuery.toLowerCase();
            const searchMatch = !query ||
                app.patient.toLowerCase().includes(query) ||
                app.type.toLowerCase().includes(query) ||
                app.idNum.toLowerCase().includes(query);

            return dayMatch && statusMatch && visitMatch && deptMatch && searchMatch;
        });

        if (filtered.length === 0) {
            return `
            <div class="flex flex-col items-center justify-center h-64 text-slate-400">
                <span class="material-icons mb-2 text-4xl">event_busy</span>
                <p class="text-sm">No appointments found</p>
            </div>
        `;
        }

        return filtered.map(app => {
            const statusColor = app.status === 'booked' ? 'blue' : app.status === 'review' ? 'amber' : app.status === 'emr' ? 'green' : app.status === 'overdue' ? 'red' : 'slate';
            const isCompleted = app.status === 'completed';

            return `
            <div class="p-4 rounded-xl border ${app.status === 'booked' ? 'border-primary/20 bg-blue-50/50' : 'border-slate-100 bg-white shadow-sm'} ${isCompleted ? 'opacity-60' : ''}">
                <div class="flex justify-between items-start mb-2">
                    <div>
                        <h4 class="font-bold text-slate-900">${app.patient}</h4>
                        <p class="text-xs text-slate-500">${app.idNum} • ${app.time}</p>
                    </div>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-${statusColor}-100 text-${statusColor}-700 uppercase">${app.status}</span>
                </div>
                <p class="text-xs text-slate-600 mb-4">${app.type}</p>
                ${isCompleted ? `
                    <button class="w-full py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors view-summary-btn">
                        View Summary
                    </button>
                ` : `
                    <button class="w-full py-2 ${app.status === 'booked' ? 'bg-primary text-white' : 'border border-slate-200 text-slate-600'} rounded-lg text-xs font-bold hover:bg-opacity-90 transition-colors shadow-sm start-cons-btn">
                        ${app.status === 'booked' ? 'Start Consultation' : 'Open Chart'}
                    </button>
                `}
            </div>
        `;
        }).join('');
    }

    function updateAgendaUI() {
        const container = document.getElementById('agenda-container');
        const headerTitle = document.getElementById('agenda-header-title');
        const badgeCount = document.getElementById('agenda-badge-count');

        // 1. Calculate current filtered state for the sidebar
        const filteredForAgenda = APPOINTMENTS.filter(app => {
            // For mock consistency, we only match 'day' if it's Feb 2024 as per current data
            // In a real app, we would match full date
            const isSelectedMonthYear = selectedDate.getMonth() === 1 && selectedDate.getFullYear() === 2024;
            const dayMatch = isSelectedMonthYear && app.day === selectedDate.getDate();
            const statusMatch = statusFilter === 'all' || app.status === statusFilter;
            const visitMatch = visitTypeFilter === 'all' || app.visitType === visitTypeFilter;
            const deptMatch = departmentFilter === 'all' || app.department === departmentFilter;

            const query = searchQuery.toLowerCase();
            const searchMatch = !query ||
                app.patient.toLowerCase().includes(query) ||
                app.type.toLowerCase().includes(query) ||
                app.idNum.toLowerCase().includes(query);

            return dayMatch && statusMatch && visitMatch && deptMatch && searchMatch;
        });

        // 2. Update Agenda Sidebar
        if (container) container.innerHTML = getAgendaHTML();
        if (headerTitle) headerTitle.innerHTML = `<span class="material-icons text-primary text-[20px]">list_alt</span> ${MONTHS[selectedDate.getMonth()].substring(0, 3)} ${selectedDate.getDate()} Agenda`;
        if (badgeCount) badgeCount.textContent = `${filteredForAgenda.length} Appts`;

        // 3. Update Header Summary Badges (Counts for selected day + filters, per status)
        const baseDayFiltered = APPOINTMENTS.filter(app => {
            const isSelectedMonthYear = selectedDate.getMonth() === 1 && selectedDate.getFullYear() === 2024;
            const dayMatch = isSelectedMonthYear && app.day === selectedDate.getDate();
            const visitMatch = visitTypeFilter === 'all' || app.visitType === visitTypeFilter;
            const deptMatch = departmentFilter === 'all' || app.department === departmentFilter;

            const query = searchQuery.toLowerCase();
            const searchMatch = !query ||
                app.patient.toLowerCase().includes(query) ||
                app.type.toLowerCase().includes(query) ||
                app.idNum.toLowerCase().includes(query);

            return dayMatch && visitMatch && deptMatch && searchMatch;
        });

        const getStatusCount = (s) => baseDayFiltered.filter(app => app.status === s).length;

        const bookedEl = document.getElementById('header-count-booked');
        const reviewEl = document.getElementById('header-count-review');
        const emrEl = document.getElementById('header-count-emr');
        const overdueEl = document.getElementById('header-count-overdue');

        if (bookedEl) bookedEl.textContent = getStatusCount('booked');
        if (reviewEl) reviewEl.textContent = getStatusCount('review');
        if (emrEl) emrEl.textContent = getStatusCount('emr');
        if (overdueEl) overdueEl.textContent = getStatusCount('overdue');

        // 4. Update Header Month Label
        const monthLabel = document.getElementById('current-month-year');
        if (monthLabel) monthLabel.textContent = `${MONTHS[viewDate.getMonth()]} ${viewDate.getFullYear()}`;

        // 5. Re-wire dynamically rendered buttons
        document.querySelectorAll('.start-cons-btn').forEach(btn => {
            btn.addEventListener('click', () => navigate('/doctor/consultation'));
        });
        document.querySelectorAll('.view-summary-btn').forEach(btn => {
            btn.addEventListener('click', () => notify('Viewing appointment summary...', 'info'));
        });
    }

    // Helper for navigation highlighting

    const bodyHTML = `
    <style>
        .calendar-month-grid {
            display: grid;
            grid-template-columns: repeat(7, 1fr);
            grid-template-rows: repeat(6, minmax(1,1fr)); 
            flex: 1;
            min-height: 0;
        }
        .calendar-cell {
            border-right: 1px solid #e2e8f0;
            border-bottom: 1px solid #e2e8f0;
            transition: all 0.2s;
            min-height: 0; /* Allow cells to shrink to fit viewport */
        }
        .calendar-cell:hover {
            background-color: #f1f5f9;
        }
        .calendar-cell.active {
            background-color: #eff6ff;
            border-left: 2px solid #2563EB;
        }
        .custom-scrollbar::-webkit-scrollbar {
            width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
            background: #cbd5e1;
            border-radius: 10px;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .animate-dropdown {
            animation: fadeIn 0.2s ease-out forwards;
        }
        .status-opt.selected, .visit-opt.selected, .dept-opt.selected {
            background-color: #f8fafc;
            font-weight: 600;
        }
        .schedule-container {
            height: 100%;
    max-height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
        }
    </style>
    
    <div class="schedule-container bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="flex-1 flex flex-col min-w-0 relative">
            <header class="h-16 flex items-center justify-between px-6 bg-white border-b border-slate-200 shrink-0">
                <div class="flex items-center gap-6">
                    <h1 class="text-lg font-bold text-slate-900 whitespace-nowrap">Schedule • ${name}</h1>
                    <div class="flex items-center bg-slate-100 rounded-lg p-1">
                        <button id="prev-month-btn" class="p-1 hover:bg-white rounded transition-all"><span class="material-icons text-sm">chevron_left</span></button>
                        <button id="today-btn" class="px-3 py-1 text-sm font-medium hover:bg-white rounded transition-all">Today</button>
                        <button id="next-month-btn" class="p-1 hover:bg-white rounded transition-all"><span class="material-icons text-sm">chevron_right</span></button>
                    </div>
                    <span id="current-month-year" class="text-lg font-semibold text-slate-700">February 2024</span>
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
                            Booked <span id="header-count-booked" class="bg-blue-600 text-white px-1.5 rounded-full">0</span>
                        </div>
                        <div class="px-3 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-semibold flex items-center gap-1 border border-amber-100">
                            Review <span id="header-count-review" class="bg-amber-600 text-white px-1.5 rounded-full">0</span>
                        </div>
                        <div class="px-3 py-1 rounded-full bg-green-50 text-green-700 text-xs font-semibold flex items-center gap-1 border border-green-100">
                            EMR <span id="header-count-emr" class="bg-green-600 text-white px-1.5 rounded-full">0</span>
                        </div>
                        <div class="px-3 py-1 rounded-full bg-red-50 text-red-700 text-xs font-semibold flex items-center gap-1 border border-red-100">
                            Overdue <span id="header-count-overdue" class="bg-red-600 text-white px-1.5 rounded-full">0</span>
                        </div>
                    </div>
                </div>
            </header>

            <div class="bg-white px-6 py-3 border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
                <div class="flex-1 flex items-center gap-3">
                    <div class="relative w-64">
                        <span class="material-icons text-slate-400 absolute left-3 top-2.5 text-lg">search</span>
                        <input id="appointment-search" class="pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 w-full" placeholder="Search by patient or keyword..." type="text"/>
                    </div>
                    <div class="flex items-center gap-2">
                        <div class="relative">
                            <button id="status-filter-btn" class="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1 transition-all">
                                <span>Status</span>
                                <span class="material-icons text-xs">expand_more</span>
                            </button>
                            <!-- Custom Dropdown Menu -->
                            <div id="status-dropdown-menu" class="hidden absolute top-full left-0 mt-2 w-48 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden animate-dropdown">
                                <div class="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] border-b border-slate-50 mb-1">Select Status</div>
                                <button class="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-primary/5 transition-all flex items-center justify-between status-opt group" data-value="all">
                                    <span>All Statuses</span>
                                    <span class="material-icons text-primary text-[16px] opacity-0 group-[.selected]:opacity-100">check</span>
                                </button>
                                <button class="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-primary/5 transition-all flex items-center justify-between status-opt group" data-value="booked">
                                    <span class="flex items-center"><span class="w-2 h-2 rounded-full bg-blue-500 mr-3"></span>Booked</span>
                                    <span class="material-icons text-primary text-[16px] opacity-0 group-[.selected]:opacity-100">check</span>
                                </button>
                                <button class="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-primary/5 transition-all flex items-center justify-between status-opt group" data-value="review">
                                    <span class="flex items-center"><span class="w-2 h-2 rounded-full bg-amber-500 mr-3"></span>Review</span>
                                    <span class="material-icons text-primary text-[16px] opacity-0 group-[.selected]:opacity-100">check</span>
                                </button>
                                <button class="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-primary/5 transition-all flex items-center justify-between status-opt group" data-value="emr">
                                    <span class="flex items-center"><span class="w-2 h-2 rounded-full bg-green-500 mr-3"></span>EMR</span>
                                    <span class="material-icons text-primary text-[16px] opacity-0 group-[.selected]:opacity-100">check</span>
                                </button>
                                <button class="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-primary/5 transition-all flex items-center justify-between status-opt group" data-value="overdue">
                                    <span class="flex items-center"><span class="w-2 h-2 rounded-full bg-red-500 mr-3"></span>Overdue</span>
                                    <span class="material-icons text-primary text-[16px] opacity-0 group-[.selected]:opacity-100">check</span>
                                </button>
                            </div>
                        </div>

                        <!-- Visit Type Dropdown -->
                        <div class="relative">
                            <button id="visit-type-filter-btn" class="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1 transition-all">
                                <span>Visit Type</span>
                                <span class="material-icons text-xs">expand_more</span>
                            </button>
                            <div id="visit-type-dropdown-menu" class="hidden absolute top-full left-0 mt-2 w-52 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden animate-dropdown">
                                <div class="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] border-b border-slate-50 mb-1">Select Visit Type</div>
                                <button class="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-primary/5 transition-all flex items-center justify-between visit-opt group" data-value="all">
                                    <span>All Types</span>
                                    <span class="material-icons text-primary text-[16px] opacity-0 group-[.selected]:opacity-100">check</span>
                                </button>
                                <button class="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-primary/5 transition-all flex items-center justify-between visit-opt group" data-value="physical">
                                    <span>Routine Physical</span>
                                    <span class="material-icons text-primary text-[16px] opacity-0 group-[.selected]:opacity-100">check</span>
                                </button>
                                <button class="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-primary/5 transition-all flex items-center justify-between visit-opt group" data-value="consult">
                                    <span>Specialist Consult</span>
                                    <span class="material-icons text-primary text-[16px] opacity-0 group-[.selected]:opacity-100">check</span>
                                </button>
                                <button class="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-primary/5 transition-all flex items-center justify-between visit-opt group" data-value="emergency">
                                    <span>Emergency Appointment</span>
                                    <span class="material-icons text-primary text-[16px] opacity-0 group-[.selected]:opacity-100">check</span>
                                </button>
                            </div>
                        </div>

                        <!-- Department Dropdown -->
                        <div class="relative">
                            <button id="dept-filter-btn" class="px-3 py-1.5 rounded-md border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 flex items-center gap-1 transition-all">
                                <span>Department</span>
                                <span class="material-icons text-xs">expand_more</span>
                            </button>
                            <div id="dept-dropdown-menu" class="hidden absolute top-full left-0 mt-2 w-52 bg-white/95 backdrop-blur-sm border border-slate-200 rounded-xl shadow-2xl z-50 py-1.5 overflow-hidden animate-dropdown">
                                <div class="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em] border-b border-slate-50 mb-1">Select Department</div>
                                <button class="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-primary/5 transition-all flex items-center justify-between dept-opt group" data-value="all">
                                    <span>All Departments</span>
                                    <span class="material-icons text-primary text-[16px] opacity-0 group-[.selected]:opacity-100">check</span>
                                </button>
                                <button class="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-primary/5 transition-all flex items-center justify-between dept-opt group" data-value="cardiology">
                                    <span>Cardiology Unit</span>
                                    <span class="material-icons text-primary text-[16px] opacity-0 group-[.selected]:opacity-100">check</span>
                                </button>
                                <button class="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-primary/5 transition-all flex items-center justify-between dept-opt group" data-value="neurology">
                                    <span>Neurology Center</span>
                                    <span class="material-icons text-primary text-[16px] opacity-0 group-[.selected]:opacity-100">check</span>
                                </button>
                                <button class="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-primary/5 transition-all flex items-center justify-between dept-opt group" data-value="trauma">
                                    <span>Trauma Services</span>
                                    <span class="material-icons text-primary text-[16px] opacity-0 group-[.selected]:opacity-100">check</span>
                                </button>
                                <button class="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-primary/5 transition-all flex items-center justify-between dept-opt group" data-value="radiology">
                                    <span>Radiology Dept</span>
                                    <span class="material-icons text-primary text-[16px] opacity-0 group-[.selected]:opacity-100">check</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <main class="flex-1 overflow-hidden flex min-h-0">
                <div class="flex-1 bg-white overflow-hidden flex flex-col min-h-0">
                    <div class="grid grid-cols-7 border-b border-slate-200 text-center py-2 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <div>Sun</div><div>Mon</div><div>Tue</div><div>Wed</div><div>Thu</div><div>Fri</div><div>Sat</div>
                    </div>
                    <div id="calendar-grid" class="flex-1 calendar-month-grid">
                        <!-- Dynamic Calendar Grid will be injected here -->
                    </div>
                </div>
                <aside class="w-80 border-l border-slate-200 bg-white flex flex-col shrink-0">
                    <div class="p-6 border-b border-slate-100 flex items-center justify-between">
                        <h2 class="text-sm font-bold text-slate-900 flex items-center gap-2" id="agenda-header-title">
                            <span class="material-icons text-primary text-[20px]">list_alt</span>
                            Feb 22 Agenda
                        </h2>
                        <span class="text-[10px] text-slate-500 font-medium" id="agenda-badge-count">11 Appts</span>
                    </div>
                    <div class="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-4" id="agenda-container">
                        <!-- Agenda items will be injected here -->
                    </div>
                </aside>
            </main>
            <footer class="h-16 bg-white border-t border-slate-200 px-6 flex items-center shrink-0 z-20">
                <div class="flex items-center justify-between w-full max-w-7xl mx-auto">
                    <div class="flex items-center gap-4">
                        <button class="flex items-center gap-2 text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg text-sm font-medium transition-colors bulk-actions-btn">
                            <span class="material-icons text-[18px]">layers</span>
                            Bulk Actions
                        </button>
                    </div>
                    <div class="flex items-center gap-3">
                        <button class="flex items-center gap-2 text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg text-sm font-medium transition-colors print-btn">
                            <span class="material-icons text-[18px]">print</span>
                            Print Schedule
                        </button>
                        <button class="flex items-center gap-2 text-slate-600 hover:text-slate-900 px-4 py-2 rounded-lg text-sm font-medium transition-colors export-btn">
                            <span class="material-icons text-[18px]">ios_share</span>
                            Export
                        </button>
                    </div>
                </div>
            </footer>
        </div>
    `;

    renderAppShell('Schedule', bodyHTML, '/doctor/schedule');

    // === Event Wiring ===
    // Navigation
    document.getElementById('schedule-user-profile')?.addEventListener('click', () => navigate('/doctor/profile'));

    // Custom Dropdown Logic Helper
    const setupDropdown = (btnId, menuId, optClass, stateVarSetter, defaultValue = 'all') => {
        const btn = document.getElementById(btnId);
        const menu = document.getElementById(menuId);

        // Set initial selected state
        menu?.querySelectorAll(`.${optClass}`).forEach(opt => {
            if (opt.getAttribute('data-value') === defaultValue) opt.classList.add('selected');
        });

        btn?.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close other menus first
            document.querySelectorAll('[id$="-dropdown-menu"]').forEach(m => {
                if (m.id !== menuId) m.classList.add('hidden');
            });
            menu?.classList.toggle('hidden');

            // Toggle active style on button
            if (!menu?.classList.contains('hidden')) {
                btn.classList.add('border-primary', 'bg-primary/5', 'ring-2', 'ring-primary/20');
            } else {
                btn.classList.remove('border-primary', 'bg-primary/5', 'ring-2', 'ring-primary/20');
            }
        });

        document.querySelectorAll(`.${optClass}`).forEach(opt => {
            opt.addEventListener('click', () => {
                stateVarSetter(opt.getAttribute('data-value'));

                // Use only the first word/icon for button display if it's too long
                const selectedText = opt.querySelector('span:not(.material-icons)')?.textContent.trim() || opt.textContent.trim();
                btn.querySelector('span:not(.material-icons)').textContent = selectedText;

                // Update selected UI
                menu.querySelectorAll(`.${optClass}`).forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');

                btn.classList.add('border-primary', 'text-primary');
                menu.classList.add('hidden');
                btn.classList.remove('ring-2', 'ring-primary/20');
                updateAgendaUI();
            });
        });
    };

    setupDropdown('status-filter-btn', 'status-dropdown-menu', 'status-opt', (val) => statusFilter = val);
    setupDropdown('visit-type-filter-btn', 'visit-type-dropdown-menu', 'visit-opt', (val) => visitTypeFilter = val);
    setupDropdown('dept-filter-btn', 'dept-dropdown-menu', 'dept-opt', (val) => departmentFilter = val);

    // Search Logic
    const searchInput = document.getElementById('appointment-search');
    searchInput?.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        updateAgendaUI();
    });

    // Calendar Dynamic Grid Generation
    function renderCalendarGrid() {
        const grid = document.getElementById('calendar-grid');
        if (!grid) return;

        const year = viewDate.getFullYear();
        const month = viewDate.getMonth();

        // First day of current month
        const firstDay = new Date(year, month, 1).getDay();
        // Days in current month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        // Days in previous month
        const prevMonthDays = new Date(year, month, 0).getDate();

        let html = '';

        // Buffer days from previous month
        for (let i = firstDay - 1; i >= 0; i--) {
            html += `<div class="calendar-cell p-2 text-slate-400 bg-slate-50/50">${prevMonthDays - i}</div>`;
        }

        // Days of current month
        for (let d = 1; d <= daysInMonth; d++) {
            const isSelected = selectedDate.getDate() === d && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
            const isToday = new Date().getDate() === d && new Date().getMonth() === month && new Date().getFullYear() === year;

            // Mock data counts for Feb 2024 only
            let badgeHtml = '';
            if (year === 2024 && month === 1) {
                if (d === 1) badgeHtml = `<div class="mt-1"><div class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-[9px] font-bold text-blue-700">5 Booked</div></div>`;
                if (d === 2) badgeHtml = `<div class="mt-1"><div class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-[9px] font-bold text-amber-700">2 Review</div></div>`;
                if (d === 8) badgeHtml = `<div class="mt-1"><div class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-[9px] font-bold text-red-700">1 Overdue</div></div>`;
                if (d === 22) {
                    badgeHtml = `
                    <div class="mt-1.5 space-y-1">
                        <div class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-600/5 text-[9px] font-bold text-blue-700">8 Booked</div>
                        <div class="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-600/5 text-[9px] font-bold text-amber-700">3 Review</div>
                    </div>
                `;
                }
            }

            html += `
            <div class="calendar-cell p-2 ${isSelected ? 'active bg-blue-50 shadow-inner' : ''} cursor-pointer hover:bg-slate-50 transition-colors" data-day="${d}">
                <div class="flex justify-between items-start">
                    <span class="text-sm ${isSelected ? 'font-bold text-primary' : 'font-semibold text-slate-700'}">${d}</span>
                    ${isToday ? '<span class="text-[9px] bg-primary text-white px-1.5 rounded-full">Today</span>' : ''}
                </div>
                ${badgeHtml}
            </div>
        `;
        }

        // Buffer days for next month to fill grid
        const totalCells = firstDay + daysInMonth;
        const remaining = 35 - totalCells > 0 ? 35 - totalCells : (42 - totalCells);
        for (let i = 1; i <= remaining; i++) {
            html += `<div class="calendar-cell p-2 text-slate-400 bg-slate-50/50">${i}</div>`;
        }

        grid.innerHTML = html;

        // Attach click listeners to new cells
        grid.querySelectorAll('.calendar-cell[data-day]').forEach(cell => {
            cell.addEventListener('click', () => {
                selectedDate = new Date(year, month, parseInt(cell.dataset.day));
                renderCalendarGrid();
                updateAgendaUI();
            });
        });
    }

    // Navigation Logic
    document.getElementById('prev-month-btn')?.addEventListener('click', () => {
        viewDate.setMonth(viewDate.getMonth() - 1);
        renderCalendarGrid();
        updateAgendaUI();
    });

    document.getElementById('next-month-btn')?.addEventListener('click', () => {
        viewDate.setMonth(viewDate.getMonth() + 1);
        renderCalendarGrid();
        updateAgendaUI();
    });

    document.getElementById('today-btn')?.addEventListener('click', () => {
        const today = new Date();
        viewDate = new Date(today.getFullYear(), today.getMonth(), 1);
        selectedDate = today;
        renderCalendarGrid();
        updateAgendaUI();
    });

    // Global UI Interactions
    window.addEventListener('click', () => {
        document.querySelectorAll('[id$="-dropdown-menu"]').forEach(m => m.classList.add('hidden'));
        document.querySelectorAll('[id$="-filter-btn"]').forEach(b => b.classList.remove('border-primary', 'bg-primary/5', 'ring-2', 'ring-primary/20'));
    });

    // Initial UI Render
    renderCalendarGrid();
    updateAgendaUI();

    // Notifications for additional UI elements
    document.querySelectorAll('.open-chart-btn').forEach(btn => {
        btn.addEventListener('click', () => notify('Patient record access coming soon.', 'info'));
    });

    document.querySelectorAll('.bulk-actions-btn, .print-btn, .export-btn').forEach(btn => {
        btn.addEventListener('click', () => notify('Action initiated successfully.', 'success'));
    });

    // View Toggles
    document.querySelectorAll('header .flex.bg-slate-100 button').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('header .flex.bg-slate-100 button').forEach(b => {
                b.classList.remove('font-bold', 'text-primary', 'bg-white', 'shadow-sm');
                b.classList.add('font-medium', 'text-slate-500');
            });
            btn.classList.add('font-bold', 'text-primary', 'bg-white', 'shadow-sm');
            btn.classList.remove('font-medium', 'text-slate-500');
            notify(`View switched to ${btn.textContent.trim()}`);
        });
    });

    return bodyHTML;
}