// ---- SUPABASE AUTH & DATA ----

async function initAuth() {
  const { data: { session } } = await _sb.auth.getSession();
  if (session) {
    currentUser = session.user;
    await loadProfile(currentUser.id);
    updateNavForUser();
    showAdminNav();
  } else {
    resetNavForGuest();
  }

  // Listen for auth changes — only respond to SIGNED_OUT
  // logIn() and signUp() handle their own nav updates directly
  _sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      currentProfile = null;
      savedIds = new Set();
      updateSavedBadge();
      resetNavForGuest();
    }
  });
}

async function loadProfile(userId) {
  const { data } = await _sb.from('profiles').select('*').eq('id', userId).single();
  if (data) currentProfile = data;
}

// ---- SIGN UP ----
async function signUp() {
  const name = document.getElementById('signup-name-first').value.trim() + ' ' +
               document.getElementById('signup-name-last').value.trim();
  const email = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const school = document.getElementById('signup-school').value;

  if (!email || !password || !name.trim()) { showToast('Please fill in all fields', false); return; }

  const { data, error } = await _sb.auth.signUp({
    email, password,
    options: { data: { name: name.trim() } }
  });

  if (error) { showToast(error.message, false); return; }

  if (data.user) {
    await _sb.from('profiles').upsert({ id: data.user.id, name: name.trim(), school, email });
  }

  if (data.user && !data.user.identities?.length === 0) {
    currentUser = data.user;
    await loadProfile(currentUser.id);
    updateNavForUser();
  }

  closeModal('auth');
  showToast('✓ Account created! Check your email to confirm.', true);
}

// ---- LOG IN ----
async function logIn() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;

  if (!email || !password) { showToast('Please enter email and password', false); return; }

  const { data, error } = await _sb.auth.signInWithPassword({ email, password });
  if (error) { showToast(error.message, false); return; }

  currentUser = data.user;
  await loadProfile(currentUser.id);
  await loadSavedIds();
  // Keep email in sync in profiles table
  await _sb.from('profiles').upsert({ id: currentUser.id, email: currentUser.email });
  updateNavForUser();

  closeModal('auth');
  showToast('✓ Logged in!', true);
  showAdminNav();
  await refreshListings();
}

// ---- LOG OUT ----
async function logOut() {
  try {
    if (typeof _sb !== 'undefined' && _sb) await _sb.auth.signOut();
  } catch (e) { console.warn('signOut error:', e); }
  currentUser = null;
  currentProfile = null;
  savedIds = new Set();
  updateSavedBadge();
  resetNavForGuest();
  closeModal('my-profile');
  closeModal('account-settings');
  closeDropdown();
  switchPage('listings');
  showToast('Logged out', false);
}

// ---- FORGOT PASSWORD ----
async function forgotPassword() {
  const email = document.getElementById('login-email').value.trim();
  if (!email) { showToast('Enter your email first', false); return; }
  await _sb.auth.resetPasswordForEmail(email, { redirectTo: 'https://leaseproject.netlify.app/' });
  showToast('Password reset email sent!', true);
}
