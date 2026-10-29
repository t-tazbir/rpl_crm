/**
 * public/js/toast.js
 * Shared toast notification system for the whole app.
 *
 * Include on every page:
 *   <script src="js/toast.js"></script>
 *
 * Then anywhere:
 *   showToast('Lead created successfully!');            // success (default)
 *   showToast('Could not save changes.', 'error');
 *   showToast('Heads up — 2 numbers left to fill in.', 'info');
 *
 * Uses the host page's already-loaded Tailwind CDN for styling, so it
 * automatically matches each page's colors — no extra CSS file needed.
 */
(function () {
  function ensureContainer() {
    let el = document.getElementById('toastContainer');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toastContainer';
      el.className = 'fixed z-[999] top-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 flex flex-col gap-2 pointer-events-none';
      document.body.appendChild(el);
    }
    return el;
  }

  const ICONS = {
    success: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
    error: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/></svg>',
    info: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8h.01M11 12h1v4h1"/></svg>'
  };

  const STYLES = {
    success: { border: 'border-emerald-500', badge: 'text-emerald-600 bg-emerald-50' },
    error:   { border: 'border-rose-500',    badge: 'text-rose-600 bg-rose-50' },
    info:    { border: 'border-indigo-500',  badge: 'text-indigo-600 bg-indigo-50' }
  };

  window.showToast = function (message, type, duration) {
    type = STYLES[type] ? type : 'success';
    duration = typeof duration === 'number' ? duration : 4200;

    const container = ensureContainer();
    const style = STYLES[type];

    const toast = document.createElement('div');
    toast.setAttribute('role', 'status');
    toast.className =
      'pointer-events-auto w-full bg-white rounded-xl shadow-2xl border border-slate-200 border-l-4 ' +
      style.border +
      ' flex items-start gap-3 p-3.5 opacity-0 -translate-y-2 transition-all duration-300 ease-out';

    toast.innerHTML =
      '<div class="w-7 h-7 rounded-full flex items-center justify-center shrink-0 ' + style.badge + '">' + ICONS[type] + '</div>' +
      '<p class="text-sm text-slate-700 flex-1 leading-snug pt-0.5">' + message + '</p>' +
      '<button type="button" aria-label="Dismiss" class="text-slate-300 hover:text-slate-500 shrink-0">' +
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>' +
      '</button>';

    container.appendChild(toast);

    // animate in
    requestAnimationFrame(() => {
      toast.classList.remove('opacity-0', '-translate-y-2');
    });

    let dismissed = false;
    function dismiss() {
      if (dismissed) return;
      dismissed = true;
      toast.classList.add('opacity-0', '-translate-y-2');
      setTimeout(() => toast.remove(), 300);
    }

    toast.querySelector('button').addEventListener('click', dismiss);
    if (duration > 0) setTimeout(dismiss, duration);

    return dismiss;
  };
})();
