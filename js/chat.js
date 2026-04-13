// ---- CHAT ----

function openChat(listingId) {
  const l = sampleListings.find(x => x.id === listingId);
  if (!l) return;
  document.getElementById('chat-avatar').textContent = l.poster;
  document.getElementById('chat-name').textContent = l.name;
  document.getElementById('chat-listing').textContent = l.address;
  document.getElementById('chat-messages').innerHTML = `
    <div class="chat-msg them">Hi! Is the listing at ${l.address} still available?</div>
    <div class="chat-msg me">Yes it is! Let me know if you have any questions.</div>
  `;
  openModal('chat');
}

function sendChatMsg() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;
  const msgs = document.getElementById('chat-messages');
  msgs.innerHTML += `<div class="chat-msg me">${msg}</div>`;
  input.value = '';
  msgs.scrollTop = msgs.scrollHeight;
  setTimeout(() => {
    msgs.innerHTML += `<div class="chat-msg them">Thanks for your message! I'll get back to you soon.</div>`;
    msgs.scrollTop = msgs.scrollHeight;
  }, 800);
}
