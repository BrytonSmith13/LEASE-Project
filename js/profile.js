// ---- PROFILE DROPDOWN ----

function toggleProfileDropdown() {
  const dd = document.getElementById('profile-dropdown');
  dd.classList.toggle('open');
  if (dd.classList.contains('open')) {
    setTimeout(() => document.addEventListener('click', closeDropdownOutside), 0);
  }
}

function closeDropdownOutside(e) {
  const wrap = document.getElementById('nav-profile-wrap');
  if (wrap && !wrap.contains(e.target)) closeDropdown();
}

function closeDropdown() {
  const dd = document.getElementById('profile-dropdown');
  if (dd) dd.classList.remove('open');
  document.removeEventListener('click', closeDropdownOutside);
}

// ---- MY PROFILE MODAL ----

async function openMyProfileModal() {
  try {
    if (!currentUser) { openModal('auth'); return; }
    closeDropdown();

    const overlay = document.getElementById('my-profile-overlay');
    const body = document.getElementById('my-profile-body');

    if (!overlay || !body) {
      alert('Profile modal not found! Please refresh the page.');
      return;
    }

    overlay.style.display = 'block';
    overlay.style.pointerEvents = 'auto';

    const email = currentUser?.email || '';
    const name = (currentProfile && currentProfile.name) ? currentProfile.name : email.split('@')[0] || 'User';
    const initials = name.split(' ').filter(Boolean).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase() || '?';
    const school = (currentProfile && currentProfile.school) ? currentProfile.school : '';
    const bio = (currentProfile && currentProfile.bio) ? currentProfile.bio : '';
    const phone = (currentProfile && currentProfile.phone) ? currentProfile.phone : '';
    const instagram = (currentProfile && currentProfile.instagram) ? currentProfile.instagram : '';
    const snapchat = (currentProfile && currentProfile.snapchat) ? currentProfile.snapchat : '';

    let html = '';
    html += '<div style="background:linear-gradient(135deg,#2A7A52,#0d3d28);height:120px"></div>';
    html += '<div style="padding:0 28px 40px">';
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:-40px;margin-bottom:20px">';
    html += '<div style="width:80px;height:80px;border-radius:50%;background:#2A7A52;display:flex;align-items:center;justify-content:center;border:4px solid var(--surface);font-size:26px;font-weight:700;color:#fff;font-family:Syne,sans-serif">' + initials + '</div>';
    html += '<div style="display:flex;gap:8px">';
    html += '<button class="btn btn-outline" onclick="openModal(&quot;account-settings&quot;)">✏️ Edit Profile</button>';
    html += '<button class="btn btn-ghost" onclick="logOut()" style="color:#C44A3A;font-size:12px">Log out</button>';
    html += '</div></div>';
    html += '<div style="font-family:Syne,sans-serif;font-size:22px;font-weight:700;margin-bottom:6px">' + name + '</div>';
    if (school) html += '<div style="font-size:13px;color:var(--mid);margin-bottom:10px">🎓 ' + school + '</div>';
    html += '<div style="font-size:13px;color:var(--mid);line-height:1.7;margin-bottom:20px">' + (bio || '<em style="opacity:0.6">No bio yet — add one in Edit Profile</em>') + '</div>';
    html += '<div style="background:var(--bg);border-radius:14px;padding:18px 20px;margin-bottom:24px">';
    html += '<div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.07em;color:var(--mid);margin-bottom:14px">Contact Info</div>';
    html += '<div style="display:flex;flex-direction:column;gap:12px">';
    html += '<div style="display:flex;gap:12px;font-size:13px"><span>✉️</span><a href="mailto:' + email + '" style="color:var(--accent);text-decoration:none">' + (email || 'No email') + '</a></div>';
    html += '<div style="display:flex;gap:12px;font-size:13px"><span>📞</span>' + (phone ? '<a href="tel:' + phone + '" style="color:var(--accent);text-decoration:none">' + phone + '</a>' : '<span style="color:var(--mid);font-style:italic">No phone added</span>') + '</div>';
    html += '<div style="display:flex;gap:12px;font-size:13px"><span>📸</span>' + (instagram ? '<a href="https://instagram.com/' + instagram.replace('@', '') + '" target="_blank" style="color:var(--accent);text-decoration:none">' + instagram + '</a>' : '<span style="color:var(--mid);font-style:italic">No Instagram added</span>') + '</div>';
    html += '<div style="display:flex;gap:12px;font-size:13px"><span>👻</span>' + (snapchat ? '<span>' + snapchat + '</span>' : '<span style="color:var(--mid);font-style:italic">No Snapchat added</span>') + '</div>';
    html += '</div></div>';
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">';
    html += '<div style="background:var(--bg);border-radius:12px;padding:16px;text-align:center"><div id="pf-stat-active" style="font-size:22px;font-weight:700;font-family:Syne,sans-serif">—</div><div style="font-size:11px;color:var(--mid)">Active</div></div>';
    html += '<div style="background:var(--bg);border-radius:12px;padding:16px;text-align:center"><div id="pf-stat-done" style="font-size:22px;font-weight:700;font-family:Syne,sans-serif">—</div><div style="font-size:11px;color:var(--mid)">Completed</div></div>';
    html += '<div style="background:var(--bg);border-radius:12px;padding:16px;text-align:center"><div id="pf-stat-rev" style="font-size:22px;font-weight:700;font-family:Syne,sans-serif">—</div><div style="font-size:11px;color:var(--mid)">Reviews</div></div>';
    html += '</div>';
    html += '<div style="font-family:Syne,sans-serif;font-size:15px;font-weight:600;margin-bottom:14px">My Listings</div>';
    html += '<div id="pf-listings" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px"><div style="padding:20px;color:var(--mid)">Loading…</div></div>';
    html += '</div>';

    body.innerHTML = html;

    if (typeof _sb !== 'undefined' && _sb && currentUser) {
      const res = await _sb.from('listings').select('*').eq('user_id', currentUser.id).order('created_at', { ascending: false });
      const listings = res.data || [];
      const active = listings.filter(l => l.is_active);
      const past = listings.filter(l => !l.is_active);

      const ea = document.getElementById('pf-stat-active');
      const ep = document.getElementById('pf-stat-done');
      if (ea) ea.textContent = active.length;
      if (ep) ep.textContent = past.length;

      const grid = document.getElementById('pf-listings');
      if (grid) {
        if (active.length === 0) {
          grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--mid)"><div style="font-size:36px;margin-bottom:10px">&#127968;</div><div style="font-weight:600;margin-bottom:12px">No active listings yet</div></div>';
          const btn = document.createElement('button');
          btn.className = 'btn btn-primary';
          btn.textContent = '+ Post a Listing';
          btn.onclick = function () { overlay.style.display = 'none'; openModal('post'); };
          grid.querySelector('div').appendChild(btn);
        } else {
          grid.innerHTML = '';
          active.forEach(l => { grid.appendChild(buildListingCard(l)); });
        }
      }

      const revRes = await _sb.from('reviews').select('id', { count: 'exact' }).eq('reviewee_id', currentUser.id);
      const er = document.getElementById('pf-stat-rev');
      if (er) er.textContent = revRes.count || 0;
    }
  } catch (err) {
    console.error('openMyProfileModal error:', err);
    alert('Profile error: ' + err.message);
  }
}

function buildListingCard(l) {
  const div = document.createElement('div');
  div.className = 'card';
  div.style.cursor = 'pointer';
  div.onclick = () => { document.getElementById('my-profile-overlay').style.display = 'none'; openListing(l.id); };
  div.innerHTML = `
    <div class="card-img">
      ${l.photo_url ? `<img src="${l.photo_url}" style="width:100%;height:100%;object-fit:cover">` : `<span class="card-img-placeholder">🏠</span>`}
      <div class="card-badge badge-${l.type}">${l.type === 'sublease' ? 'Sublease' : 'Full Transfer'}</div>
    </div>
    <div class="card-body">
      <div class="card-price">$${l.rent.toLocaleString()}<span>/mo</span></div>
      <div class="card-addr">📍 ${l.address}</div>
      <div class="card-tags">
        <span class="tag tag-accent">${l.school || ''}</span>
        <span class="tag">${l.room_type === 'private' ? '🚪 Private' : l.room_type === 'shared' ? '👥 Shared' : '🏠 Studio'}</span>
      </div>
      <div style="margin-top:10px">
        <button class="btn btn-outline" style="width:100%;font-size:11px;padding:6px;color:var(--green);border-color:var(--green)" onclick="event.stopPropagation();showSuccessFeeModal('${l.id}')">🎉 Mark as Transferred</button>
      </div>
    </div>
  `;
  return div;
}

// ---- MY LISTINGS MODAL ----

async function openMyListings() {
  if (!currentUser) { openModal('auth'); return; }
  openModal('my-listings');
  const grid = document.getElementById('my-listings-grid');
  grid.innerHTML = '<div style="text-align:center;padding:40px;color:var(--mid)">Loading…</div>';

  let myListings = sampleListings.filter(l => l.user_id === currentUser.id);

  if (typeof _sb !== 'undefined' && _sb) {
    const { data } = await _sb.from('listings').select('*').eq('user_id', currentUser.id).eq('is_active', true);
    if (data && data.length > 0) {
      myListings = data.map(l => ({
        id: l.id, emoji: '🏠', photo: l.photo_url,
        type: l.type, school: l.school, address: l.address,
        rent: l.rent, roomType: l.room_type, residents: l.residents,
        user_id: l.user_id,
      }));
    }
  }

  if (myListings.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--mid)">
      <div style="font-size:40px;margin-bottom:12px">🏠</div>
      <div style="font-weight:600;margin-bottom:8px">No listings yet</div>
      <button class="btn btn-primary" onclick="closeModal('my-listings');openModal('post')">+ Post a Listing</button>
    </div>`;
    return;
  }

  grid.innerHTML = myListings.map(l => `
    <div class="card" style="cursor:pointer" onclick="closeModal('my-listings');openListing('${l.id}')">
      <div class="card-img">
        ${l.photo ? `<img src="${l.photo}" style="width:100%;height:100%;object-fit:cover">` : `<span class="card-img-placeholder">${l.emoji || '🏠'}</span>`}
        <div class="card-badge badge-${l.type}">${l.type === 'sublease' ? 'Sublease' : 'Full Transfer'}</div>
      </div>
      <div class="card-body">
        <div class="card-price">$${l.rent.toLocaleString()}<span>/mo</span></div>
        <div class="card-addr">📍 ${l.address}</div>
        <div class="card-tags">
          <span class="tag tag-accent">${l.school || ''}</span>
          <span class="tag">${l.roomType === 'private' ? '🚪 Private' : l.roomType === 'shared' ? '👥 Shared' : '🏠 Studio'}</span>
        </div>
        <div style="margin-top:10px;display:flex;gap:6px">
          <button class="btn btn-outline" style="flex:1;font-size:11px;padding:6px" onclick="event.stopPropagation();showSuccessFeeModal('${l.id}')">🎉 Mark Transferred</button>
          <button class="btn btn-ghost" style="font-size:11px;padding:6px;color:#C44A3A" onclick="event.stopPropagation();deleteListing('${l.id}')">🗑</button>
        </div>
      </div>
    </div>
  `).join('');
}

async function deleteListing(id) {
  if (!confirm('Are you sure you want to delete this listing?')) return;
  if (typeof _sb !== 'undefined' && _sb) {
    await _sb.from('listings').update({ is_active: false }).eq('id', id).eq('user_id', currentUser.id);
  }
  const idx = sampleListings.findIndex(l => String(l.id) === String(id));
  if (idx > -1) sampleListings.splice(idx, 1);
  showToast('Listing removed', false);
  closeModal('my-listings');
  await refreshListings();
}

// ---- ACCOUNT SETTINGS ----

function openAccountSettings() {
  const p = currentProfile || {};
  const nameParts = (p.name || '').split(' ');
  document.getElementById('settings-first-name').value = nameParts[0] || '';
  document.getElementById('settings-last-name').value = nameParts.slice(1).join(' ') || '';
  document.getElementById('settings-school').value = p.school || '';
  document.getElementById('settings-bio').value = p.bio || '';
  document.getElementById('settings-phone').value = p.phone || '';
  document.getElementById('settings-instagram').value = p.instagram || '';
  document.getElementById('settings-snapchat').value = p.snapchat || '';
  document.getElementById('settings-password').value = '';
  document.getElementById('settings-password-confirm').value = '';
}

async function saveAccountSettings() {
  if (!currentUser) return;
  const firstName = document.getElementById('settings-first-name').value.trim();
  const lastName = document.getElementById('settings-last-name').value.trim();
  const name = [firstName, lastName].filter(Boolean).join(' ');
  const password = document.getElementById('settings-password').value;
  const confirm = document.getElementById('settings-password-confirm').value;

  if (password && password !== confirm) { showToast('Passwords do not match', false); return; }

  const updates = {
    name: name || currentProfile?.name,
    school: document.getElementById('settings-school').value,
    bio: document.getElementById('settings-bio').value,
    phone: document.getElementById('settings-phone').value,
    instagram: document.getElementById('settings-instagram').value,
    snapchat: document.getElementById('settings-snapchat').value,
  };

  if (typeof _sb !== 'undefined' && _sb) {
    await _sb.from('profiles').upsert({ id: currentUser.id, ...updates });
    if (password) {
      const { error } = await _sb.auth.updateUser({ password });
      if (error) { showToast('Password error: ' + error.message, false); return; }
    }
    currentProfile = { ...currentProfile, ...updates };
  }

  const navName = document.getElementById('nav-profile-name');
  if (navName) navName.textContent = updates.name || 'Profile';
  const ddName = document.getElementById('dd-name');
  if (ddName) ddName.textContent = updates.name || 'User';
  const navCircle = document.getElementById('nav-avatar-circle');
  if (navCircle) navCircle.textContent = (updates.name || 'U').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  closeModal('account-settings');
  showToast('✓ Settings saved!', true);
}

// ---- PROFILE TAB SWITCHER (used inside rendered profile HTML) ----
function showProfileTab(tab) {
  document.querySelectorAll('.profile-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.profile-tab-content').forEach(p => p.classList.remove('active'));
  const activeBtn = document.querySelector(`.profile-tab-btn[onclick*="${tab}"]`);
  const activePanel = document.getElementById('ptab-' + tab);
  if (activeBtn) activeBtn.classList.add('active');
  if (activePanel) activePanel.classList.add('active');
}
