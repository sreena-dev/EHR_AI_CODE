/**
 * Billing & Plans Page
 * Displays subscription tiers and handles checkout flow.
 * Supports both mock mode (default) and real Razorpay payments.
 *
 * MEDICAL SAFETY: No payment card data is handled by this app.
 * All card processing is done by Razorpay (PCI-DSS Level 1 compliant).
 */
import { navigate } from '../router.js';
import { getCurrentUser, authFetch } from '../api/auth.js';
import { showToast } from '../components/toast.js';
import { renderAppShell, clearSubscriptionCache } from '../components/app-shell.js';

/* ── Helper: authFetch returns raw Response; we need parsed JSON ── */
async function billingFetch(url, options = {}) {
  const res = await authFetch(url, options);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${res.status})`);
  }
  return res.json();
}

/* ── Load Razorpay SDK (lazy, only when needed) ── */
function loadRazorpayScript() {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) { resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Razorpay SDK'));
    document.head.appendChild(script);
  });
}

/* ── Razorpay Checkout Flow ── */
async function handleRazorpayCheckout(orderData, planId, user) {
  await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    const options = {
      key: orderData.key_id,
      amount: orderData.amount,
      currency: orderData.currency,
      name: 'AIRA Healthcare',
      description: `${orderData.plan_name} Subscription`,
      order_id: orderData.id,
      prefill: {
        name: user.full_name || user.staff_id,
        email: '', // Could be fetched from profile
      },
      theme: {
        color: '#4338ca',
      },
      handler: async function (response) {
        // Payment successful → verify on backend
        try {
          showToast('Verifying payment…', 'info');
          await billingFetch('/api/billing/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan_id: planId,
            }),
          });
          showToast('Subscription activated successfully!', 'success');
          clearSubscriptionCache();
          renderPricing();
          resolve();
        } catch (err) {
          showToast(err.message || 'Verification failed', 'error');
          reject(err);
        }
      },
      modal: {
        ondismiss: function () {
          showToast('Payment cancelled.', 'info');
          reject(new Error('Payment cancelled'));
        },
      },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  });
}

/* ── Mock Checkout Flow (dev mode) ── */
async function handleMockCheckout(orderData, planId, user) {
  showToast('Redirecting to payment gateway…', 'info');

  // Simulate payment processing delay
  await new Promise(r => setTimeout(r, 1200));
  showToast('Processing payment…', 'info');

  await billingFetch('/api/billing/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      staff_id: user.staff_id,
      plan_id: planId,
      session_id: orderData.id,
    }),
  });

  showToast('Subscription activated successfully!', 'success');
  clearSubscriptionCache();
  renderPricing();
}

/* ── Global handler ── */
window.handleCheckout = async function (planId) {
  const user = getCurrentUser();
  if (!user) { showToast('Please log in first.', 'error'); return; }

  try {
    const orderData = await billingFetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id: planId,
        success_url: window.location.origin,
        cancel_url: window.location.origin,
      }),
    });

    if (orderData.mode === 'razorpay') {
      await handleRazorpayCheckout(orderData, planId, user);
    } else {
      await handleMockCheckout(orderData, planId, user);
    }
  } catch (err) {
    if (err.message !== 'Payment cancelled') {
      showToast(err.message || 'Failed to start checkout', 'error');
    }
  }
};

/* ── Main render function ── */
export async function renderPricing() {
  const user = getCurrentUser();

  // Fetch current subscription status
  let sub = null;
  try {
    sub = await billingFetch('/api/billing/status');
  } catch (err) {
    console.warn('Billing status fetch failed:', err.message);
  }

  const isProActive = sub?.plan_id === 'plan_pro' && sub?.status === 'active';
  const isEliteActive = sub?.plan_id === 'plan_elite' && sub?.status === 'active';

  /* ── Subscription banner ── */
  let bannerHTML = '';
  if (sub?.has_subscription) {
    const renewDate = sub.current_period_end
      ? new Date(sub.current_period_end).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })
      : '—';
    bannerHTML = `
      <div style="background:var(--primary-50,#eef2ff); border:1px solid var(--primary-200,#c7d2fe); border-radius:12px; padding:20px 24px; margin-bottom:32px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
          <div>
            <h3 style="margin:0 0 4px; font-size:1.1rem; font-weight:700; color:var(--primary-900,#312e81);">Current Plan: ${sub.plan_name}</h3>
            <p style="margin:0; font-size:0.85rem; color:var(--primary-700,#4338ca);">
              Status: <strong style="text-transform:uppercase; letter-spacing:0.05em;">${sub.status}</strong>
              &nbsp;·&nbsp; Renews: ${renewDate}
            </p>
          </div>
          ${sub.status === 'past_due' ? `<button class="btn btn-sm" style="background:var(--error); color:#fff;">Update Payment</button>` : ''}
        </div>
      </div>`;
  } else {
    bannerHTML = `
      <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:12px; padding:20px 24px; margin-bottom:32px; text-align:center;">
        <h3 style="margin:0 0 4px; font-size:1.1rem; font-weight:700; color:#92400e;">No Active Subscription</h3>
        <p style="margin:0; font-size:0.85rem; color:#b45309;">Choose a plan below to unlock your clinic workspace.</p>
      </div>`;
  }

  /* ── Pro button ── */
  const proBtnHTML = isProActive
    ? `<button class="btn" disabled style="width:100%;padding:12px;border-radius:10px;font-weight:700;background:var(--gray-100);color:var(--gray-400);cursor:not-allowed;">Current Plan</button>`
    : `<button onclick="window.handleCheckout('plan_pro')" class="btn btn-secondary" style="width:100%;padding:12px;border-radius:10px;font-weight:700;">Subscribe to Pro</button>`;

  /* ── Elite button ── */
  const eliteBtnLabel = isEliteActive ? 'Current Plan' : (isProActive ? 'Upgrade to Elite' : 'Subscribe to Elite');
  const eliteBtnHTML = isEliteActive
    ? `<button class="btn" disabled style="width:100%;padding:12px;border-radius:10px;font-weight:700;background:rgba(255,255,255,0.15);color:rgba(255,255,255,0.5);cursor:not-allowed;border:1px solid rgba(255,255,255,0.2);">Current Plan</button>`
    : `<button onclick="window.handleCheckout('plan_elite')" class="btn" style="width:100%;padding:12px;border-radius:10px;font-weight:700;background:#fff;color:#312e81;">${eliteBtnLabel}</button>`;

  /* ── Feature check SVG ── */
  const checkSVG = `<svg style="width:18px;height:18px;color:#22c55e;flex-shrink:0;margin-right:10px;margin-top:2px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
  const crossSVG = `<svg style="width:18px;height:18px;color:var(--gray-300);flex-shrink:0;margin-right:10px;margin-top:2px;opacity:0.5;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
  const eliteCheckSVG = `<svg style="width:18px;height:18px;color:#c084fc;flex-shrink:0;margin-right:10px;margin-top:2px;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;

  const contentHTML = `
    <div style="max-width:960px; margin:0 auto; padding:24px;">
      <!-- Header -->
      <div style="text-align:center; margin-bottom:32px;">
        <h1 style="font-size:1.75rem; font-weight:800; margin:0 0 8px;">Clinic Billing &amp; Plans</h1>
        <p class="text-muted" style="max-width:540px; margin:0 auto; font-size:0.95rem;">
          Scale your clinic with advanced EMR &amp; clinical intelligence tools. Transparent pricing for healthcare professionals.
        </p>
      </div>

      ${bannerHTML}

      <!-- Plans Grid -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:24px; max-width:800px; margin:0 auto;">

        <!-- PRO PLAN -->
        <div class="card" style="position:relative; display:flex; flex-direction:column; padding:28px; border-radius:16px; ${isProActive ? 'border:2px solid var(--primary);box-shadow:0 0 0 3px rgba(99,102,241,0.15);' : ''}">
          ${isProActive ? `<div style="position:absolute;top:0;right:0;background:var(--primary);color:#fff;font-size:0.65rem;font-weight:700;padding:4px 10px;border-radius:0 14px 0 10px;text-transform:uppercase;letter-spacing:0.08em;">Active</div>` : ''}
          <div style="margin-bottom:20px;">
            <h2 style="font-size:1.35rem;font-weight:800;margin:0 0 4px;">Pro</h2>
            <p class="text-muted" style="font-size:0.8rem;margin:0;">Essential tools for independent practitioners</p>
          </div>
          <div style="margin-bottom:24px;">
            <span style="font-size:2.4rem;font-weight:900;">₹12,000</span>
            <span class="text-muted">/year</span>
          </div>
          <ul style="list-style:none;padding:0;margin:0 0 24px;flex:1;">
            <li style="display:flex;align-items:flex-start;margin-bottom:12px;">${checkSVG}<span>Core EMR &amp; Digital Prescriptions</span></li>
            <li style="display:flex;align-items:flex-start;margin-bottom:12px;">${checkSVG}<span>Tele-Consultation Built-in</span></li>
            <li style="display:flex;align-items:flex-start;margin-bottom:12px;">${checkSVG}<span>Basic ABDM Compliance</span></li>
            <li style="display:flex;align-items:flex-start;margin-bottom:12px;opacity:0.45;">${crossSVG}<span>Advanced Analytics (Robin)</span></li>
            <li style="display:flex;align-items:flex-start;margin-bottom:12px;opacity:0.45;">${crossSVG}<span>Multi-Clinic &amp; Patient Portal</span></li>
          </ul>
          ${proBtnHTML}
        </div>

        <!-- ELITE PLAN -->
        <div style="position:relative; display:flex; flex-direction:column; padding:28px; border-radius:16px; background:linear-gradient(135deg,#312e81,#4338ca); color:#fff; box-shadow:0 8px 32px rgba(67,56,202,0.35); transform:scale(1.03); z-index:1;">
          <div style="position:absolute;top:-14px;left:50%;transform:translateX(-50%);background:linear-gradient(90deg,#ec4899,#8b5cf6);color:#fff;font-size:0.65rem;font-weight:800;padding:5px 14px;border-radius:20px;text-transform:uppercase;letter-spacing:0.1em;white-space:nowrap;">Recommended</div>
          ${isEliteActive ? `<div style="position:absolute;top:0;right:0;background:#22c55e;color:#fff;font-size:0.65rem;font-weight:700;padding:4px 10px;border-radius:0 14px 0 10px;text-transform:uppercase;letter-spacing:0.08em;">Active</div>` : ''}
          <div style="margin-bottom:20px;">
            <h2 style="font-size:1.35rem;font-weight:800;margin:0 0 4px;">Elite</h2>
            <p style="font-size:0.8rem;margin:0;color:rgba(255,255,255,0.65);">Everything you need to grow your practice</p>
          </div>
          <div style="margin-bottom:24px;">
            <span style="font-size:2.4rem;font-weight:900;">₹18,000</span>
            <span style="color:rgba(255,255,255,0.6);">/year</span>
          </div>
          <ul style="list-style:none;padding:0;margin:0 0 24px;flex:1;">
            <li style="display:flex;align-items:flex-start;margin-bottom:12px;">${eliteCheckSVG}<span style="font-weight:600;">Everything in Pro</span></li>
            <li style="display:flex;align-items:flex-start;margin-bottom:12px;">${eliteCheckSVG}<span>Advanced Analytics (Robin Engine)</span></li>
            <li style="display:flex;align-items:flex-start;margin-bottom:12px;">${eliteCheckSVG}<span>Multi-Clinic &amp; Franchise Support</span></li>
            <li style="display:flex;align-items:flex-start;margin-bottom:12px;">${eliteCheckSVG}<span>White-label Patient Portal</span></li>
            <li style="display:flex;align-items:flex-start;margin-bottom:12px;">${eliteCheckSVG}<span>Priority 24/7 Support</span></li>
          </ul>
          ${eliteBtnHTML}
        </div>

      </div>

      <!-- Enterprise CTA -->
      <div class="card" style="margin-top:40px;max-width:800px;margin-left:auto;margin-right:auto;text-align:center;padding:28px;border-radius:14px;">
        <h3 style="font-size:1.15rem;font-weight:700;margin:0 0 6px;">Hospital or Corporate Chain?</h3>
        <p class="text-muted" style="margin:0 0 16px;max-width:480px;display:inline-block;">We offer custom on-premise deployments, private API access, and tailored features for large healthcare organizations.</p>
        <br>
        <button class="btn btn-secondary" style="padding:8px 24px;border-radius:8px;font-weight:700;">Contact Sales</button>
      </div>

      <!-- Payment Mode Badge -->
      <div style="text-align:center;margin-top:16px;">
        <span style="font-size:0.7rem;color:var(--gray-400);display:inline-flex;align-items:center;gap:4px;">
          <span class="material-icons-outlined" style="font-size:14px;">security</span>
          Payments secured by Razorpay · PCI-DSS Level 1
        </span>
      </div>
    </div>
  `;

  const userRole = user?.role || 'doctor';
  renderAppShell('Billing & Plans', contentHTML, `/${userRole}/billing`);
}
