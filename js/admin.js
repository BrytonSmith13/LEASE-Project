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
  if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--mid)">Loading…</td></tr>';

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
      tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--mid)">No listings yet</td></tr>';
      return;
    }

    tbody.innerHTML = listings.map(l => `
      <tr>
        <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${l.address}">${l.address}</td>
        <td>${l.school || '—'}</td>
        <td>$${(l.rent || 0).toLocaleString()}/mo</td>
        <td>${l.type === 'sublease' ? 'Sublease' : 'Transfer'}</td>
        <td><button onclick="openPublicProfile('${l.user_id}')" style="background:none;border:none;color:var(--accent);font-weight:600;cursor:pointer;font-size:13px;padding:0;font-family:inherit;text-decoration:underline;text-underline-offset:3px">${l.profiles?.name || l.profiles?.email || '—'}</button></td>
        <td>${new Date(l.created_at).toLocaleDateString()}</td>
        <td><span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;${l.payment_paid ? 'background:#d1fae5;color:#065f46' : 'background:#fee2e2;color:#991b1b'}">${l.payment_paid ? '✓ Paid' : '✕ Unpaid'}</span></td>
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
  const reason = prompt('Reason for deactivating (sent to user):', 'Payment not received. Please complete your $35 listing fee to reactivate.');
  if (reason === null) return; // cancelled

  try {
    const { data: listing, error } = await _sb.from('listings').update({ is_active: false }).eq('id', id).select('*, profiles(name, email)').single();
    if (error) throw error;

    // Send in-app notification
    if (listing.user_id) {
      await sendNotification(listing.user_id, `Your listing at ${listing.address} was paused. Reason: ${reason}`, '⚠️');
    }

    // Send email notification to the user
    const userEmail = listing.profiles?.email;
    const userName = listing.profiles?.name || 'there';
    if (userEmail && EMAILJS_DEACTIVATE_TEMPLATE_ID !== 'YOUR_DEACTIVATE_TEMPLATE_ID') {
      try {
        await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_DEACTIVATE_TEMPLATE_ID, {
          to_email: userEmail,
          user_name: userName,
          listing_address: listing.address,
          reason: reason,
        }, EMAILJS_PUBLIC_KEY);
      } catch (emailErr) {
        console.warn('Email send failed:', emailErr);
      }
    }

    showToast('Listing deactivated' + (userEmail ? ' — user notified' : ''), false);
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
