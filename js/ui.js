// ---- THEME ----
function toggleTheme() {
  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  document.documentElement.setAttribute('data-theme', isDark ? '' : 'dark');
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = isDark ? '🌙' : '☀️';
}

// ---- PAGE SWITCHING ----
function switchPage(page) {
  const pages = ['listings', 'map', 'saved', 'profile', 'admin'];
  pages.forEach(p => {
    const el = document.getElementById('page-' + p);
    if (el) el.style.display = p === page ? '' : 'none';
  });
  ['listings', 'map', 'saved', 'admin'].forEach(p => {
    const nav = document.getElementById('nav-' + p);
    if (nav) nav.classList.toggle('active', p === page);
  });
  if (page === 'map') { if (typeof renderMap === 'function') renderMap(); }
  if (page === 'saved') { if (typeof renderSavedPage === 'function') renderSavedPage(); }
  if (page === 'admin') { if (typeof loadAdminListings === 'function') loadAdminListings(); }
}

// ---- MODALS ----
function openModal(name) {
  const el = document.getElementById(name + '-overlay');
  if (!el) return;
  if (name === 'my-profile') {
    el.style.display = 'flex';
  } else {
    el.classList.add('open');
  }
  if (name === 'account-settings') openAccountSettings();
}

function closeModal(name) {
  const el = document.getElementById(name + '-overlay');
  if (!el) return;
  if (name === 'my-profile') {
    el.style.display = 'none';
    el.style.pointerEvents = 'none';
  } else {
    el.classList.remove('open');
  }
}

function closeIfOverlay(e, name) {
  if (e.target === document.getElementById(name + '-overlay')) closeModal(name);
}

// ---- AUTH MODAL TABS ----
function switchTab(tab) {
  document.getElementById('login-form').style.display = tab === 'login' ? '' : 'none';
  document.getElementById('signup-form').style.display = tab === 'signup' ? '' : 'none';
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab === 'signup');
}

// ---- TOAST ----
function showToast(msg, success) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show' + (success ? ' success' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = 'toast', 3000);
}

// ---- NAV ----
function updateNavForUser() {
  const name = (typeof currentProfile !== 'undefined' && currentProfile?.name) ||
               (typeof currentUser !== 'undefined' && currentUser?.email?.split('@')[0]) || 'Me';
  const initials = name.split(' ').filter(Boolean).map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
  const loginBtn = document.getElementById('nav-login-btn');
  const profileWrap = document.getElementById('nav-profile-wrap');
  const nameEl = document.getElementById('nav-profile-name');
  const circle = document.getElementById('nav-avatar-circle');
  const ddName = document.getElementById('dd-name');
  const ddEmail = document.getElementById('dd-email');
  if (loginBtn) loginBtn.style.display = 'none';
  if (profileWrap) profileWrap.style.display = '';
  if (nameEl) nameEl.textContent = name;
  if (circle) circle.textContent = initials;
  if (ddName) ddName.textContent = name;
  if (ddEmail && typeof currentUser !== 'undefined') ddEmail.textContent = currentUser?.email || '';
}

function resetNavForGuest() {
  const loginBtn = document.getElementById('nav-login-btn');
  const profileWrap = document.getElementById('nav-profile-wrap');
  if (loginBtn) loginBtn.style.display = '';
  if (profileWrap) profileWrap.style.display = 'none';
}

function updateSavedBadge() {
  const badge = document.getElementById('saved-badge');
  if (badge) { badge.textContent = savedIds.size; badge.classList.toggle('show', savedIds.size > 0); }
}
