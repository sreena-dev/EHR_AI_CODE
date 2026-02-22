/**
 * Clarification Workflow Page — Doctor-Nurse communication
 * Matches Stitch "Request Clarification Workflow" screen
 */
import { navigate } from '../router.js';
import { showToast } from '../components/toast.js';
import { renderAppShell } from '../components/app-shell.js';

export async function renderClarification() {

    // Mock thread data
    const threads = [
        {
            id: 1,
            patient: 'Rajesh Kumar',
            patientId: 'PAT-2851',
            category: 'Vitals',
            status: 'pending',
            priority: 'high',
            createdAt: '21 Feb 2026, 10:52 AM',
            messages: [
                { from: 'Dr. Anand', role: 'doctor', time: '10:52 AM', text: 'The BP reading seems unusually high for this patient. Can you please re-check and confirm? Was the patient resting before measurement?' },
                { from: 'Nurse Priya', role: 'nurse', time: '11:05 AM', text: 'Rechecked BP after 10 minutes of rest. New reading: 138/86 mmHg. Previous reading was taken immediately after patient walked in.' },
            ],
        },
        {
            id: 2,
            patient: 'Meena S.',
            patientId: 'PAT-3012',
            category: 'Medication',
            status: 'resolved',
            priority: 'medium',
            createdAt: '20 Feb 2026, 3:15 PM',
            messages: [
                { from: 'Dr. Anand', role: 'doctor', time: '3:15 PM', text: 'Please confirm allergy list — patient mentioned penicillin allergy during consultation but it\'s not in the chart.' },
                { from: 'Nurse Kavitha', role: 'nurse', time: '3:30 PM', text: 'Updated allergy list. Patient confirmed penicillin allergy. Added to chart and flagged in medication system.' },
                { from: 'Dr. Anand', role: 'doctor', time: '3:35 PM', text: 'Thank you. Resolving this thread.' },
            ],
        },
    ];

    renderAppShell('Clarification Workflow', `
    <div class="page-content">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px;">
        <div>
          <div class="breadcrumb" style="margin-bottom: 8px;">
            <a href="#/doctor/dashboard">Dashboard</a>
            <span class="sep">›</span>
            <span>Clarification Requests</span>
          </div>
          <h1 style="margin-bottom: 4px;">Clarification Workflow</h1>
          <p class="text-sm text-muted">Communicate with nursing staff about patient encounters and clinical data.</p>
        </div>
        <button class="btn btn-primary" id="new-thread-btn">
          <span class="material-icons-outlined" style="font-size: 18px;">add_comment</span>
          New Request
        </button>
      </div>

      <!-- Filter Bar -->
      <div class="card" style="margin-bottom: 20px;">
        <div class="card-body" style="padding: 12px 20px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;">
          <button class="btn btn-sm btn-primary filter-btn active" data-filter="all">All</button>
          <button class="btn btn-sm btn-ghost filter-btn" data-filter="pending">
            <span class="badge badge-warning" style="padding: 2px 8px;">Pending</span>
          </button>
          <button class="btn btn-sm btn-ghost filter-btn" data-filter="resolved">
            <span class="badge badge-success" style="padding: 2px 8px;">Resolved</span>
          </button>
          <div style="flex: 1;"></div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="material-icons-outlined" style="font-size: 18px; color: var(--gray-400);">search</span>
            <input class="form-input" style="max-width: 240px; padding: 6px 12px; font-size: 0.8125rem;" placeholder="Search threads..." />
          </div>
        </div>
      </div>

      <!-- Threads -->
      <div class="clarification-threads">
        ${threads.map(thread => `
          <div class="card thread-card" style="margin-bottom: 16px;" data-status="${thread.status}">
            <div class="card-header" style="padding: 14px 20px;">
              <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 36px; height: 36px; border-radius: 50%; background: ${thread.priority === 'high' ? 'var(--error-light)' : 'var(--warning-light)'}; display: flex; align-items: center; justify-content: center;">
                  <span class="material-icons-outlined" style="font-size: 18px; color: ${thread.priority === 'high' ? 'var(--error)' : '#b45309'};">${thread.category === 'Vitals' ? 'monitor_heart' : 'medication'}</span>
                </div>
                <div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-weight: 600;">${thread.patient}</span>
                    <span class="badge badge-neutral">${thread.patientId}</span>
                    <span class="badge ${thread.status === 'pending' ? 'badge-warning' : 'badge-success'}">${thread.status}</span>
                    ${thread.priority === 'high' ? '<span class="badge badge-error">High Priority</span>' : ''}
                  </div>
                  <span class="text-xs text-muted">${thread.category} • ${thread.createdAt}</span>
                </div>
              </div>
              <button class="btn btn-sm btn-ghost thread-toggle" data-id="${thread.id}">
                <span class="material-icons-outlined" style="font-size: 18px;">expand_more</span>
              </button>
            </div>
            <div class="thread-body" id="thread-${thread.id}" style="display: none;">
              <div style="padding: 16px 20px; border-top: 1px solid var(--gray-100);">
                ${thread.messages.map(msg => `
                  <div class="thread-message ${msg.role}">
                    <div class="thread-message-avatar" style="background: ${msg.role === 'doctor' ? 'var(--primary-100)' : 'var(--success-light)'};">
                      <span class="material-icons-outlined" style="font-size: 16px; color: ${msg.role === 'doctor' ? 'var(--primary-600)' : 'var(--success)'};">person</span>
                    </div>
                    <div class="thread-message-content">
                      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span style="font-weight: 600; font-size: 0.8125rem;">${msg.from}</span>
                        <span class="text-xs text-muted">${msg.time}</span>
                      </div>
                      <p style="font-size: 0.875rem; color: var(--gray-700); line-height: 1.6;">${msg.text}</p>
                    </div>
                  </div>
                `).join('')}

                ${thread.status === 'pending' ? `
                  <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--gray-100);">
                    <div style="display: flex; gap: 8px;">
                      <input class="form-input reply-input" data-id="${thread.id}" placeholder="Type your reply..." style="font-size: 0.875rem;" />
                      <button class="btn btn-primary btn-sm reply-btn" data-id="${thread.id}">
                        <span class="material-icons-outlined" style="font-size: 16px;">send</span>
                      </button>
                      <button class="btn btn-success btn-sm resolve-btn" data-id="${thread.id}">
                        <span class="material-icons-outlined" style="font-size: 16px;">check</span>
                        Resolve
                      </button>
                    </div>
                  </div>
                ` : ''}
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `, '/doctor/consultation');

    // Toggle thread expansion
    document.querySelectorAll('.thread-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const body = document.getElementById(`thread-${id}`);
            const icon = btn.querySelector('.material-icons-outlined');
            if (body.style.display === 'none') {
                body.style.display = 'block';
                icon.textContent = 'expand_less';
            } else {
                body.style.display = 'none';
                icon.textContent = 'expand_more';
            }
        });
    });

    // Reply
    document.querySelectorAll('.reply-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const input = document.querySelector(`.reply-input[data-id="${id}"]`);
            if (input.value.trim()) {
                showToast('Reply sent', 'success');
                input.value = '';
            }
        });
    });

    // Resolve
    document.querySelectorAll('.resolve-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            showToast('Thread resolved', 'success');
        });
    });

    // New thread
    document.getElementById('new-thread-btn').addEventListener('click', () => {
        showToast('New clarification dialog coming soon', 'info');
    });
}
