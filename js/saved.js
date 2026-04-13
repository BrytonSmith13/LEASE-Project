// ---- SAVED / FAVORITES ----

function toggleSaved(id) {
  toggleSavedDB(id);
}

function updateHeartButtons(id) {
  ['heart-' + id, 'detail-heart-' + id].forEach(btnId => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.textContent = savedIds.has(id) ? '❤️' : '🤍';
      btn.classList.toggle('saved', savedIds.has(id));
    }
  });
}

function renderSavedPage() {
  const grid = document.getElementById('saved-grid');
  const saved = sampleListings.filter(l => savedIds.has(l.id));
  if (saved.length === 0) {
    grid.innerHTML = '<div class="saved-empty" style="grid-column:1/-1"><div class="saved-empty-icon">🤍</div><h3 style="font-family:Syne,sans-serif;font-size:18px;font-weight:700;color:var(--ink);margin-bottom:8px;">No saved listings yet</h3><p>Heart listings to save them here.</p></div>';
    return;
  }
  grid.innerHTML = saved.map(l => `
    <div class="card" onclick="openListing(${l.id})">
      <div class="card-img">
        <span class="card-img-placeholder">${l.emoji}</span>
        <div class="card-badge badge-${l.type}">${l.type === 'sublease' ? 'Sublease' : 'Full Transfer'}</div>
      </div>
      <div class="card-body">
        <div class="card-price">$${l.rent.toLocaleString()}<span>/mo</span></div>
        <div class="card-addr">📍 ${l.address}</div>
        <div class="card-tags">
          <span class="tag tag-accent">${l.school}</span>
          <span class="tag">${l.roomType === 'private' ? '🚪 Private' : l.roomType === 'shared' ? '👥 Shared' : '🏠 Studio'}</span>
          <span class="tag">👤 ${l.residents} residents</span>
        </div>
        <div class="card-footer">
          <div class="card-user"><div class="avatar">${l.poster}</div><span class="card-user-name">${l.name}</span></div>
          <button class="heart-btn saved" id="heart-${l.id}" onclick="event.stopPropagation();toggleSaved(${l.id})">❤️</button>
        </div>
      </div>
    </div>
  `).join('');
}
