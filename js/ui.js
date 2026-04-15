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
  if (name === 'listing') {
    window.history.replaceState({}, '', window.location.pathname);
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
function updateNotifWrap(show) {
  const wrap = document.getElementById('nav-notif-wrap');
  if (wrap) wrap.style.display = show ? '' : 'none';
}

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
  updateNotifWrap(true);
  const gh = document.getElementById('guest-hero');
  if (gh) gh.style.display = 'none';
  if (nameEl) nameEl.textContent = name;
  if (circle) {
    const avatarUrl = typeof currentProfile !== 'undefined' && currentProfile?.avatar_url;
    if (avatarUrl) {
      circle.innerHTML = `<img src="${avatarUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
    } else {
      circle.textContent = initials;
    }
  }
  if (ddName) ddName.textContent = name;
  if (ddEmail && typeof currentUser !== 'undefined') ddEmail.textContent = currentUser?.email || '';
}

function resetNavForGuest() {
  const loginBtn = document.getElementById('nav-login-btn');
  const profileWrap = document.getElementById('nav-profile-wrap');
  if (loginBtn) loginBtn.style.display = '';
  if (profileWrap) profileWrap.style.display = 'none';
  updateNotifWrap(false);
  // Show landing hero and populate count
  const gh = document.getElementById('guest-hero');
  if (gh) {
    gh.style.display = '';
    if (typeof _sb !== 'undefined' && _sb) {
      _sb.from('listings').select('id', { count: 'exact', head: true }).eq('is_active', true).then(({ count }) => {
        const el = document.getElementById('guest-stat-count');
        if (el && count != null) el.textContent = count;
      });
    }
  }
}

// ---- SCHOOL AUTOCOMPLETE ----
const SCHOOL_LIST = [
  'BYU','BYU-Idaho','BYU-Hawaii','UVU','Utah State University','University of Utah','Weber State University',
  'Southern Utah University','Utah Tech University','Westminster University','Ensign College',
  'Arizona State University','University of Arizona','Northern Arizona University',
  'UCLA','UC Berkeley','UC San Diego','UC Davis','UC Santa Barbara','USC','Stanford University','Cal Poly',
  'University of Nevada Las Vegas','University of Nevada Reno',
  'Colorado State University','University of Colorado Boulder','University of Denver',
  'Boise State University','University of Idaho',
  'University of Wyoming','Montana State University','University of Montana',
  'New Mexico State University','University of New Mexico',
  'University of Washington','Washington State University','Seattle University',
  'Oregon State University','University of Oregon','Portland State University',
  'Harvard University','MIT','Yale University','Princeton University','Columbia University',
  'University of Michigan','Michigan State University',
  'Ohio State University','University of Cincinnati',
  'University of Texas Austin','Texas A&M University','Texas Tech University',
  'Florida State University','University of Florida','University of Miami',
  'Georgia Tech','University of Georgia','Emory University',
  'University of North Carolina','Duke University','NC State University',
  'Penn State University','Temple University','Drexel University',
  'New York University','Fordham University','Hofstra University',
  'DePaul University','University of Chicago','Northwestern University','Loyola University Chicago',
  'Purdue University','Indiana University','Notre Dame',
  'Vanderbilt University','University of Tennessee','Tennessee Tech',
  'University of Alabama','Auburn University',
  'Louisiana State University','Tulane University',
  'University of Missouri','Washington University in St. Louis',
  'Kansas State University','University of Kansas',
  'University of Nebraska','Creighton University',
  'Iowa State University','University of Iowa',
  'University of Minnesota','Minnesota State University',
  'University of Wisconsin Madison','Marquette University',
  'Brigham Young University','Other',
];

function schoolAutocomplete(input, listId) {
  listId = listId || 'school-ac-list';
  const list = document.getElementById(listId);
  if (!list) return;
  const val = input.value.trim().toLowerCase();
  if (!val) { list.style.display = 'none'; return; }
  const matches = SCHOOL_LIST.filter(s => s.toLowerCase().includes(val)).slice(0, 8);
  if (matches.length === 0) { list.style.display = 'none'; return; }
  list.style.display = '';
  list.innerHTML = matches.map(s => `
    <div onmousedown="selectSchool('${s.replace(/'/g,"\\'")}','${input.id}','${listId}')"
      style="padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--rule)"
      onmouseover="this.style.background='var(--tag-bg)'" onmouseout="this.style.background=''">
      ${s}
    </div>
  `).join('');
}

function selectSchool(name, inputId, listId) {
  const input = document.getElementById(inputId);
  if (input) input.value = name;
  closeSchoolAC(listId);
}

function closeSchoolAC(listId) {
  const list = document.getElementById(listId || 'school-ac-list');
  if (list) list.style.display = 'none';
}

function updateSavedBadge() {
  const badge = document.getElementById('saved-badge');
  if (badge) { badge.textContent = savedIds.size; badge.classList.toggle('show', savedIds.size > 0); }
}
