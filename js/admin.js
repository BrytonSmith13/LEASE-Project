// ---- ADMIN ----

function isAdmin() {
  return currentUser && ADMIN_USER_EMAILS.includes(currentUser.email);
}

function showAdminNav() {
  const btn = document.getElementById('nav-admin');
  if (btn) btn.style.display = isAdmin() ? '' : 'none';
}

async function loadAdminListings() {
  if (!isAdmin()) { showToast('Access denied', false); return; }
  const tbody = document.getElementById('admin-table-body');
  if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--mid)">Loading…</td></tr>';

  try {
    const { data, error } = await _sb
      .from('listings')
      .select('*, profiles(name, email)')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const listings = data || [];
    const pending = listings.filter(l => !l.is_active);
    const active = listings.filter(l => l.is_active);

    document.getElementById('admin-total').textContent = listings.length;
    document.getElementById('admin-pending-count').textContent = pending.length;
    document.getElementById('admin-active-count').textContent = active.length;
    document.getElementById('admin-pending-badge').textContent = pending.length + ' pending';

    if (!tbody) return;
    if (listings.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--mid)">No listings yet</td></tr>';
      return;
    }

    tbody.innerHTML = listings.map(l => `
      <tr>
        <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${l.address}">${l.address}</td>
        <td>${l.school || '—'}</td>
        <td>$${(l.rent || 0).toLocaleString()}/mo</td>
        <td>${l.type === 'sublease' ? 'Sublease' : 'Transfer'}</td>
        <td>${l.profiles?.name || l.profiles?.email || '—'}</td>
        <td>${new Date(l.created_at).toLocaleDateString()}</td>
        <td><span class="status-badge ${l.is_active ? 'status-active' : 'status-pending'}">${l.is_active ? '✓ Active' : '⏳ Pending'}</span></td>
        <td>
          <div class="admin-actions">
            ${!l.is_active ? `<button class="btn-approve" onclick="approveListing('${l.id}')">✓ Approve</button>` : '<span style="font-size:11px;color:var(--mid)">Live</span>'}
            <button class="btn-reject" onclick="rejectListing('${l.id}')">${l.is_active ? 'Deactivate' : '✕ Reject'}</button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (e) {
    console.error('Admin load error:', e);
    showToast('Error loading listings: ' + e.message, false);
  }
}

async function approveListing(id) {
  try {
    const { error } = await _sb.from('listings').update({ is_active: true }).eq('id', id);
    if (error) throw error;
    showToast('✓ Listing approved and live!', true);
    await loadAdminListings();
    await refreshListings();
  } catch (e) {
    showToast('Error: ' + e.message, false);
  }
}

async function rejectListing(id) {
  if (!confirm('Are you sure you want to remove this listing?')) return;
  try {
    const { error } = await _sb.from('listings').update({ is_active: false }).eq('id', id);
    if (error) throw error;
    showToast('Listing deactivated', false);
    await loadAdminListings();
    await refreshListings();
  } catch (e) {
    showToast('Error: ' + e.message, false);
  }
}

// ---- EMAIL NOTIFICATIONS ----

async function sendListingNotification(listingData) {
  if (EMAILJS_SERVICE_ID === 'YOUR_SERVICE_ID') {
    console.log('EmailJS not configured yet - skipping notification');
    return;
  }
  try {
    await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      to_email: ADMIN_EMAIL,
      from_name: currentProfile?.name || currentUser?.email || 'A user',
      listing_address: listingData.address,
      listing_rent: '$' + listingData.rent + '/mo',
      listing_school: listingData.school,
      listing_type: listingData.type,
      user_email: currentUser?.email || '',
      approve_url: 'https://brytonsmith13.github.io/LEASE-Project',
    }, EMAILJS_PUBLIC_KEY);
    console.log('Notification sent to admin');
  } catch (e) {
    console.warn('Email notification failed:', e);
  }
}
