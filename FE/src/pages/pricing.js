import { navigate } from '../router.js';
import { getCurrentUser, authFetch } from '../api/auth.js';
import { showToast } from '../components/toast.js';
import { renderAppShell } from '../components/app-shell.js';

window.handleCheckout = async function (planId) {
  try {
    const result = await authFetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: planId,
        success_url: window.location.origin + window.location.pathname,
        cancel_url: window.location.origin + window.location.pathname
      })
    });

    window.location.href = result.url;
  } catch (err) {
    showToast(err.message || 'Failed to start checkout', 'error');
  }
};

export async function renderPricing() {
  const user = getCurrentUser();

  // If redirected back from mock checkout, finalize payment
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');
  const sessionPlanId = urlParams.get('plan_id');

  if (sessionId && sessionPlanId) {
    try {
      showToast('Processing payment...', 'info');
      await authFetch('/api/billing/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staff_id: user.staff_id,
          plan_id: sessionPlanId,
          session_id: sessionId
        })
      });
      showToast('Subscription upgraded successfully!', 'success');
      // Clear URL params
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (err) {
      showToast(err.message || 'Payment processing failed.', 'error');
    }
  }

  // Fetch current status
  let subStatus = null;
  try {
    subStatus = await authFetch('/api/billing/status');
  } catch (err) {
    console.error('Failed to fetch subscription status:', err);
  }

  const isProActive = subStatus?.plan_id === 'plan_pro' && subStatus?.status === 'active';
  const isEliteActive = subStatus?.plan_id === 'plan_elite' && subStatus?.status === 'active';

  const proBtnHtml = isProActive
    ? `<button class="w-full py-3 px-6 rounded-xl font-bold transition-all mt-auto bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-700" disabled>Current Plan</button>`
    : `<button onclick="window.handleCheckout('plan_pro')" class="w-full py-3 px-6 rounded-xl font-bold transition-all mt-auto bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-900/50 dark:text-indigo-300">Subscribe to Pro</button>`;

  const eliteBtnText = isEliteActive ? 'Current Plan' : (isProActive ? 'Upgrade to Elite' : 'Subscribe to Elite');
  const eliteBtnHtml = isEliteActive
    ? `<button class="w-full py-3 px-6 rounded-xl font-bold transition-all shadow-xl mt-auto bg-indigo-800 text-indigo-400 cursor-not-allowed border border-indigo-700" disabled>Current Plan</button>`
    : `<button onclick="window.handleCheckout('plan_elite')" class="w-full py-3 px-6 rounded-xl font-bold transition-all shadow-xl mt-auto bg-white text-indigo-900 hover:bg-indigo-50 hover:scale-[1.02]">${eliteBtnText}</button>`;

  const activeSubHtml = subStatus?.has_subscription ? `
        <div class="bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-xl p-6 mb-12">
            <div class="flex items-center justify-between">
                <div>
                    <h3 class="text-lg font-bold text-indigo-900 dark:text-indigo-100">Current Plan: ${subStatus.plan_name}</h3>
                    <p class="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
                        Status: <span class="uppercase font-semibold tracking-wider">${subStatus.status}</span>
                    </p>
                    <p class="text-sm text-indigo-700 dark:text-indigo-300 mt-1">
                        Renews/Expires on: ${new Date(subStatus.current_period_end).toLocaleDateString()}
                    </p>
                </div>
                ${subStatus.status === 'past_due' ? `<button class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium">Update Payment Method</button>` : ''}
            </div>
        </div>
    ` : `
        <div class="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-xl p-6 mb-12 text-center">
            <h3 class="text-lg font-bold text-amber-900 dark:text-amber-100">No Active Subscription</h3>
            <p class="text-sm text-amber-700 dark:text-amber-300 mt-1">Please select a plan below to activate your clinic workspace.</p>
        </div>
    `;

  const contentHTML = `
        <div class="max-w-6xl mx-auto p-6 animate-fade-in">
            <div class="text-center mb-12">
                <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-4">Clinic Billing & Plans</h1>
                <p class="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                    Scale your clinic with our advanced EMR and clinical intelligence tools. 
                    Transparent pricing designed for healthcare professionals.
                </p>
            </div>

            ${activeSubHtml}

            <!-- Pricing Plans -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                
                <!-- PRO PLAN -->
                <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border ${isProActive ? 'border-indigo-500 ring-2 ring-indigo-500 ring-opacity-50' : 'border-gray-200 dark:border-gray-700'} p-8 relative flex flex-col">
                    ${isProActive ? `<div class="absolute top-0 right-0 bg-indigo-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-xl uppercase tracking-widest">Active</div>` : ''}
                    <div class="mb-8">
                        <h2 class="text-2xl font-bold text-gray-900 dark:text-white mb-2">Pro</h2>
                        <p class="text-gray-500 dark:text-gray-400 text-sm">Essential tools for independent practitioners</p>
                    </div>
                    <div class="mb-8">
                        <span class="text-4xl font-extrabold text-gray-900 dark:text-white">₹12,000</span>
                        <span class="text-gray-500 dark:text-gray-400">/year</span>
                    </div>
                    <ul class="space-y-4 mb-8 flex-1">
                        <li class="flex items-start">
                            <svg class="w-5 h-5 text-green-500 mt-0.5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                            <span class="text-gray-700 dark:text-gray-300">Core EMR & Digital Prescriptions</span>
                        </li>
                        <li class="flex items-start">
                            <svg class="w-5 h-5 text-green-500 mt-0.5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                            <span class="text-gray-700 dark:text-gray-300">Tele-Consultation Built-in</span>
                        </li>
                        <li class="flex items-start">
                            <svg class="w-5 h-5 text-green-500 mt-0.5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                            <span class="text-gray-700 dark:text-gray-300">Basic ABDM Compliance</span>
                        </li>
                    </ul>
                    ${proBtnHtml}
                </div>

                <!-- ELITE PLAN -->
                <div class="bg-gradient-to-b from-indigo-900 to-indigo-800 rounded-2xl shadow-2xl border border-indigo-700 p-8 relative flex flex-col transform scale-105 z-10">
                    <div class="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-pink-500 to-purple-500 text-white text-xs font-bold px-4 py-1 rounded-full uppercase tracking-wider shadow-lg">Recommended</div>
                    ${isEliteActive ? `<div class="absolute top-0 right-0 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-xl uppercase tracking-widest">Active</div>` : ''}
                    
                    <div class="mb-8">
                        <h2 class="text-2xl font-bold text-white mb-2">Elite</h2>
                        <p class="text-indigo-200 text-sm">Everything you need to grow your practice</p>
                    </div>
                    <div class="mb-8">
                        <span class="text-4xl font-extrabold text-white">₹18,000</span>
                        <span class="text-indigo-200">/year</span>
                    </div>
                    <ul class="space-y-4 mb-8 flex-1">
                        <li class="flex items-start">
                            <svg class="w-5 h-5 text-pink-400 mt-0.5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                            <span class="text-indigo-50 font-medium">Everything in Pro</span>
                        </li>
                        <li class="flex items-start">
                            <svg class="w-5 h-5 text-indigo-300 mt-0.5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                            <span class="text-indigo-100">Advanced Analytics (Robin Engine)</span>
                        </li>
                        <li class="flex items-start">
                            <svg class="w-5 h-5 text-indigo-300 mt-0.5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                            <span class="text-indigo-100">Multi-Clinic & Franchise Support</span>
                        </li>
                        <li class="flex items-start">
                            <svg class="w-5 h-5 text-indigo-300 mt-0.5 mr-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                            <span class="text-indigo-100">Priority 24/7 Support</span>
                        </li>
                    </ul>
                    ${eliteBtnHtml}
                </div>

            </div>

            <div class="mt-16 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-8 text-center max-w-4xl mx-auto border border-gray-200 dark:border-gray-700">
                <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Hospital or Corporate Chain?</h3>
                <p class="text-gray-600 dark:text-gray-400 mb-6 max-w-lg mx-auto">We offer custom on-premise deployments, private API access, and tailored features for large healthcare organizations.</p>
                <button class="px-6 py-2 border-2 border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400 font-bold rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors">
                    Contact Sales
                </button>
            </div>

        </div>
    `;

  const userRole = user?.role || 'doctor';
  renderAppShell('Billing & Plans', contentHTML, `/${userRole}/billing`);
}
