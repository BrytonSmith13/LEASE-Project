// ---- NOTIFICATIONS ----

let notifPanelOpen = false;
let notifSubscription = null;

function subscribeToNotifications() {
  if (!currentUser || typeof _sb === 'undefined') return;
  if (notifSubscription) return; // already subscribed

  notifSubscription = _sb
    .channel('notifications-' + currentUser.id)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: 'user_id=eq.' + currentUser.id,
    }, () => {
      loadNotifications();
    })
    .subscribe();
}

async function loadNotifications() {
  if (!currentUser || typeof _sb === 'undefined') return;
  const { data } = await _sb
    .from('notifications')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(20);

  const notifs = data || [];
  const unread = notifs.filter(n => !n.is_read).length;

  const badge = document.getElementById('notif-badge');
  if (badge) {
    badge.style.display = unread > 0 ? 'block' : 'none';
    badge.textContent = unread > 9 ? '9+' : unread;
  }

  const list = document.getElementById('notif-list');
  if (!list) return;

  if (notifs.length === 0) {
    list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--mid);font-size:13px">No notifications yet</div>';
    return;
  }

  list.innerHTML = notifs.map(n => {
    const listingId = n.metadata?.listing_id || '';
    return `
    <div onclick="handleNotifClick('${n.id}','${listingId}')" style="padding:14px 16px;border-bottom:1px solid var(--rule);cursor:pointer;background:${n.is_read ? 'transparent' : 'rgba(42,122,82,0.06)'};display:flex;gap:12px;align-items:flex-start;transition:background 0.15s">
      <div style="font-size:20px;flex-shrink:0">${n.icon || '🔔'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:${n.is_read ? '400' : '600'};margin-bottom:3px;line-height:1.4">${n.message}</div>
        <div style="font-size:11px;color:var(--mid)">${timeAgo(n.created_at)}</div>
      </div>
      ${!n.is_read ? '<div style="width:7px;height:7px;border-radius:50%;background:var(--accent);flex-shrink:0;margin-top:4px"></div>' : ''}
    </div>
  `}).join('');
}

async function handleNotifClick(notifId, listingId) {
  await _sb.from('notifications').update({ is_read: true }).eq('id', notifId);
  await loadNotifications();

  if (listingId) {
    document.getElementById('notif-panel').style.display = 'none';
    notifPanelOpen = false;
    document.removeEventListener('click', closeNotifOutside);
    await openChatForListing(listingId);
  }
}

async function markAllNotifsRead() {
  if (!currentUser) return;
  await _sb.from('notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false);
  await loadNotifications();
}

function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  notifPanelOpen = !notifPanelOpen;
  panel.style.display = notifPanelOpen ? 'block' : 'none';
  if (notifPanelOpen) {
    loadNotifications();
    setTimeout(() => document.addEventListener('click', closeNotifOutside), 0);
  }
}

function closeNotifOutside(e) {
  const wrap = document.getElementById('nav-notif-wrap');
  if (wrap && !wrap.contains(e.target)) {
    document.getElementById('notif-panel').style.display = 'none';
    notifPanelOpen = false;
    document.removeEventListener('click', closeNotifOutside);
  }
}

// Send a notification to a user (called from admin when deactivating)
async function sendNotification(userId, message, icon, metadata) {
  if (!userId || typeof _sb === 'undefined') return;
  await _sb.from('notifications').insert([{ user_id: userId, message, icon: icon || '🔔', is_read: false, metadata: metadata || {} }]);
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs + 'h ago';
  return Math.floor(hrs / 24) + 'd ago';
}
