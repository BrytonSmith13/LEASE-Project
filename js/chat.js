// ---- CHAT ----

let currentChatListingId = null;
let currentChatReceiverId = null;
let currentChatReceiverName = null;
let chatSubscription = null;

async function openChat(listingId) {
  if (!currentUser) { openModal('auth'); return; }

  const l = sampleListings.find(x => String(x.id) === String(listingId));
  if (!l) return;

  currentChatListingId = listingId;

  // If viewing your own listing, receiver is whoever messaged you (loaded dynamically)
  // If viewing someone else's listing, receiver is the listing owner
  const isOwner = l.user_id === currentUser.id;
  currentChatReceiverId = isOwner ? null : l.user_id;
  currentChatReceiverName = isOwner ? 'Buyer' : l.name;

  document.getElementById('chat-avatar').textContent = l.poster;
  document.getElementById('chat-name').textContent = l.name;
  document.getElementById('chat-listing').textContent = l.address;

  const msgs = document.getElementById('chat-messages');
  msgs.innerHTML = '<div style="text-align:center;padding:20px;color:var(--mid);font-size:13px">Loading…</div>';

  openModal('chat');
  await loadChatMessages();
  subscribeToChatMessages();
}

async function loadChatMessages() {
  if (!currentChatListingId || !currentUser) return;

  const { data, error } = await _sb
    .from('chat_messages')
    .select('*')
    .eq('listing_id', currentChatListingId)
    .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
    .order('created_at', { ascending: true });

  if (error) { console.error(error); return; }

  const msgs = document.getElementById('chat-messages');
  if (!data || data.length === 0) {
    msgs.innerHTML = '<div style="text-align:center;padding:20px;color:var(--mid);font-size:13px">No messages yet — say hello!</div>';
  } else {
    msgs.innerHTML = data.map(m => {
      const isMe = m.sender_id === currentUser.id;
      const time = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return `<div class="chat-msg ${isMe ? 'me' : 'them'}" title="${time}">${m.content}</div>`;
    }).join('');
    msgs.scrollTop = msgs.scrollHeight;
  }

  // Mark messages as read (non-critical, ignore errors)
  try {
    await _sb.from('chat_messages')
      .update({ is_read: true })
      .eq('listing_id', currentChatListingId)
      .eq('receiver_id', currentUser.id);
  } catch (_) {}
}

function subscribeToChatMessages() {
  // Unsubscribe from previous chat
  if (chatSubscription) { _sb.removeChannel(chatSubscription); chatSubscription = null; }

  chatSubscription = _sb
    .channel('chat-' + currentChatListingId + '-' + currentUser.id)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'messages',
      filter: 'listing_id=eq.' + currentChatListingId,
    }, (payload) => {
      const m = payload.new;
      if (m.sender_id !== currentUser.id && m.receiver_id !== currentUser.id) return;
      const isMe = m.sender_id === currentUser.id;
      const msgs = document.getElementById('chat-messages');
      // Remove "no messages" placeholder if present
      const placeholder = msgs.querySelector('div[style]');
      if (placeholder) placeholder.remove();
      msgs.innerHTML += `<div class="chat-msg ${isMe ? 'me' : 'them'}">${m.content}</div>`;
      msgs.scrollTop = msgs.scrollHeight;
    })
    .subscribe();
}

async function sendChatMsg() {
  if (!currentUser) { openModal('auth'); return; }
  const input = document.getElementById('chat-input');
  const content = input.value.trim();
  if (!content) return;

  input.value = '';

  const { error } = await _sb.from('chat_messages').insert([{
    listing_id: currentChatListingId,
    sender_id: currentUser.id,
    receiver_id: currentChatReceiverId,
    content,
  }]);

  if (error) {
    console.error('Message send error:', error);
    showToast('Failed to send: ' + error.message, false);
    input.value = content;
    return;
  }

  // Send in-app notification to receiver
  await sendNotification(
    currentChatReceiverId,
    `New message from ${currentProfile?.name || 'someone'}: "${content.slice(0, 60)}${content.length > 60 ? '…' : ''}"`,
    '💬',
    { listing_id: String(currentChatListingId) }
  );
}

// ---- INBOX ----

async function openInbox() {
  if (!currentUser) { openModal('auth'); return; }
  openModal('inbox');
  const list = document.getElementById('inbox-list');
  list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--mid)">Loading…</div>';

  // Get all messages involving this user, grouped by listing
  const { data, error } = await _sb
    .from('chat_messages')
    .select('*, listings(id, address, photo_url)')
    .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
    .order('created_at', { ascending: false });

  if (error || !data || data.length === 0) {
    list.innerHTML = '<div style="padding:32px;text-align:center;color:var(--mid)">No conversations yet</div>';
    return;
  }

  // Group by listing_id, keep only the latest message per listing
  const seen = new Set();
  const threads = [];
  for (const m of data) {
    if (!seen.has(m.listing_id)) {
      seen.add(m.listing_id);
      threads.push(m);
    }
  }

  list.innerHTML = threads.map(m => {
    const isMe = m.sender_id === currentUser.id;
    const addr = m.listings?.address || 'Unknown listing';
    const preview = (isMe ? 'You: ' : '') + m.content.slice(0, 60) + (m.content.length > 60 ? '…' : '');
    const time = new Date(m.created_at).toLocaleDateString();
    return `
      <div onclick="closeModal('inbox');openChatForListing('${m.listing_id}')" style="display:flex;gap:14px;align-items:center;padding:16px 20px;border-bottom:1px solid var(--rule);cursor:pointer;transition:background 0.15s" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background=''">
        <div style="width:44px;height:44px;border-radius:12px;background:var(--tag-bg);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:20px">
          ${m.listings?.photo_url ? `<img src="${m.listings.photo_url}" style="width:100%;height:100%;object-fit:cover">` : '🏠'}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">📍 ${addr}</div>
          <div style="font-size:12px;color:var(--mid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${preview}</div>
        </div>
        <div style="font-size:11px;color:var(--mid);flex-shrink:0">${time}</div>
      </div>
    `;
  }).join('');
}

async function openChatForListing(listingId) {
  // Load the listing from DB if not in sampleListings (e.g. inactive listings)
  let l = sampleListings.find(x => String(x.id) === String(listingId));
  if (!l) {
    const { data } = await _sb.from('listings').select('*, profiles(name)').eq('id', listingId).single();
    if (data) {
      l = {
        id: data.id,
        user_id: data.user_id,
        address: data.address,
        poster: (data.profiles?.name || 'User').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
        name: data.profiles?.name || 'User',
      };
    }
  }
  if (!l) return;

  currentChatListingId = listingId;
  const isOwner = l.user_id === currentUser.id;
  currentChatReceiverId = isOwner ? null : l.user_id;
  currentChatReceiverName = isOwner ? 'Buyer' : l.name;

  document.getElementById('chat-avatar').textContent = l.poster;
  document.getElementById('chat-name').textContent = l.name;
  document.getElementById('chat-listing').textContent = l.address;

  const msgs = document.getElementById('chat-messages');
  msgs.innerHTML = '<div style="text-align:center;padding:20px;color:var(--mid);font-size:13px">Loading…</div>';

  openModal('chat');
  await loadChatMessages();
  subscribeToChatMessages();
}

// Close chat and clean up subscription
function closeChat() {
  if (chatSubscription) { _sb.removeChannel(chatSubscription); chatSubscription = null; }
  closeModal('chat');
}
