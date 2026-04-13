// ---- LOAD LISTINGS FROM DB ----
async function loadListings() {
  const { data, error } = await _sb
    .from('listings')
    .select('*, profiles(id, name, school, avatar_url)')
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return []; }

  return (data || []).map(l => ({
    id: l.id,
    user_id: l.user_id,
    emoji: '🏠',
    photo: l.photo_url || null,
    type: l.type,
    housingType: l.housing_type,
    address: l.address,
    school: l.school || '',
    lat: l.lat,
    lng: l.lng,
    rent: l.rent,
    transferFee: l.transfer_fee || 0,
    utilities: l.utilities || 0,
    internet: l.internet || 0,
    extras: l.extras || '',
    roomType: l.room_type,
    residents: l.residents,
    parking: l.parking || 'none',
    beds: l.beds || '',
    leaseStart: l.lease_start || '',
    leaseEnd: l.lease_end || '',
    desc: l.description || '',
    poster: (l.profiles?.name || 'User').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(),
    name: l.profiles?.name || 'User',
    phone: '',
    tags: [],
    posted: new Date(l.created_at).toLocaleDateString()
  }));
}

// ---- POST LISTING TO DB ----
async function postListingToDB(formData) {
  if (!currentUser) { showToast('Please log in to post a listing', false); openModal('auth'); return; }

  const isActive = formData.is_active !== undefined ? formData.is_active : false;

  const { data, error } = await _sb.from('listings').insert([{
    user_id: currentUser.id,
    type: formData.type,
    housing_type: formData.housingType,
    address: formData.address,
    school: formData.school,
    rent: formData.rent,
    transfer_fee: formData.transferFee,
    utilities: formData.utilities,
    internet: formData.internet,
    extras: formData.extras,
    room_type: formData.roomType,
    residents: formData.residents,
    parking: formData.parking,
    beds: formData.beds,
    lease_start: formData.leaseStart,
    lease_end: formData.leaseEnd,
    description: formData.desc,
    photo_url: formData.photo || null,
    lat: formData.lat || null,
    lng: formData.lng || null,
    is_active: isActive,
  }]).select();

  if (error) { showToast('Error posting listing: ' + error.message, false); return; }
  return data?.[0];
}

// ---- SAVE/UNSAVE LISTING (DB) ----
async function toggleSavedDB(listingId) {
  if (!currentUser) { showToast('Log in to save listings', false); openModal('auth'); return; }
  if (savedIds.has(listingId)) {
    await _sb.from('saved_listings').delete().eq('user_id', currentUser.id).eq('listing_id', listingId);
    savedIds.delete(listingId);
    showToast('Removed from saved', false);
  } else {
    await _sb.from('saved_listings').insert([{ user_id: currentUser.id, listing_id: listingId }]);
    savedIds.add(listingId);
    showToast('❤️ Saved!', true);
  }
  updateHeartButtons(listingId);
  updateSavedBadge();
  if (document.getElementById('page-saved').style.display !== 'none') renderSavedPage();
}

async function loadSavedIds() {
  if (!currentUser) return;
  const { data } = await _sb.from('saved_listings').select('listing_id').eq('user_id', currentUser.id);
  savedIds = new Set((data || []).map(r => r.listing_id));
  updateSavedBadge();
}

// ---- REVIEWS ----
async function submitReviewToDB(revieweeId, listingId, stars, text) {
  if (!currentUser) { showToast('Log in to leave a review', false); return; }
  const { error } = await _sb.from('reviews').insert([{
    reviewer_id: currentUser.id,
    reviewee_id: revieweeId,
    listing_id: listingId,
    stars, text
  }]);
  if (error) { showToast('Error: ' + error.message, false); return; }
  showToast('✓ Review submitted!', true);
}

async function loadReviews(userId) {
  const { data } = await _sb
    .from('reviews')
    .select('*, profiles!reviewer_id(name)')
    .eq('reviewee_id', userId)
    .order('created_at', { ascending: false });
  return data || [];
}

// ---- LOCATION FILTER ----
function switchLocTab(tab) {
  const isZip = tab === 'zip';
  document.getElementById('loc-tab-zip').classList.toggle('active', isZip);
  document.getElementById('loc-tab-school').classList.toggle('active', !isZip);
  document.getElementById('loc-panel-zip').style.display = isZip ? '' : 'none';
  document.getElementById('loc-panel-school').style.display = isZip ? 'none' : '';
  if (isZip) {
    document.getElementById('distance-school').value = '';
    document.getElementById('school-distance-wrap').style.visibility = 'hidden';
    document.getElementById('school-distance-wrap').style.opacity = '0';
    distMilesSchool = 5;
    filterListings();
  } else {
    document.getElementById('zip-input').value = '';
    document.getElementById('zip-distance-wrap').style.visibility = 'hidden';
    document.getElementById('zip-distance-wrap').style.opacity = '0';
    userZipCoords = null;
    document.getElementById('stat-zip-count').textContent = '—';
    document.getElementById('stat-zip-label').textContent = 'Near your zip';
    filterListings();
  }
}

function onZipInput(el) {
  const zip = el.value.trim();
  const wrap = document.getElementById('zip-distance-wrap');
  if (zip.length === 5 && /^\d{5}$/.test(zip)) {
    userZipCoords = zipCoords[zip] || null;
    wrap.style.visibility = 'visible'; wrap.style.opacity = '1';
    updateZipStats();
    filterListings();
  } else {
    userZipCoords = null;
    wrap.style.visibility = 'hidden'; wrap.style.opacity = '0';
    document.getElementById('stat-zip-count').textContent = '—';
    document.getElementById('stat-zip-label').textContent = 'Near your zip';
    filterListings();
  }
}

function onZipDistSlide(el) {
  userZipMiles = parseFloat(el.value);
  const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
  el.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--rule) ${pct}%, var(--rule) 100%)`;
  document.getElementById('zip-dist-display').textContent = userZipMiles.toFixed(1) + ' mi';
  updateZipStats();
  filterListings();
}

function updateZipStats() {
  if (!userZipCoords) return;
  const nearby = sampleListings.filter(l => {
    if (!l.lat || !l.lng) return false;
    return haversineDistance(l.lat, l.lng, userZipCoords.lat, userZipCoords.lng) <= userZipMiles;
  });
  document.getElementById('stat-zip-count').textContent = nearby.length;
  document.getElementById('stat-zip-label').textContent = `Within ${userZipMiles.toFixed(0)} mi of ${userZipCoords.city || 'your zip'}`;
}

function updateDistanceSlider() {
  const school = document.getElementById('distance-school').value;
  const wrap = document.getElementById('school-distance-wrap');
  wrap.style.visibility = school ? 'visible' : 'hidden';
  wrap.style.opacity = school ? '1' : '0';
  filterListings();
}

function onDistanceSlide(el) {
  distMilesSchool = parseFloat(el.value);
  const pct = ((el.value - el.min) / (el.max - el.min)) * 100;
  el.style.background = `linear-gradient(to right, var(--accent) 0%, var(--accent) ${pct}%, var(--rule) ${pct}%, var(--rule) 100%)`;
  document.getElementById('distance-display').textContent = distMilesSchool.toFixed(1) + ' mi';
  filterListings();
}

// ---- DISTANCE MATH ----
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 3958.8; // miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ---- RENDER LISTINGS ----
function renderListings(list) {
  const grid = document.getElementById('listings-grid');
  document.getElementById('count').textContent = list.length;
  document.getElementById('stat-listings').textContent = sampleListings.length;
  if (list.length === 0) {
    const noListings = sampleListings.length === 0;
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1">
      <div class="empty-icon">${noListings ? '🏠' : '🔍'}</div>
      <h3>${noListings ? 'No listings yet' : 'No listings found'}</h3>
      <p>${noListings ? 'Be the first to post a listing!' : 'Try adjusting your filters or search.'}</p>
      ${noListings ? '<button class="btn btn-primary" style="margin-top:16px" onclick="openModal(&quot;post&quot;)">+ Post a Listing</button>' : ''}
    </div>`;
    return;
  }
  grid.innerHTML = list.map(l => `
    <div class="card" onclick="openListing(${l.id})">
      <div class="card-img">
        ${l.photo
          ? `<img src="${l.photo}" alt="${l.address}" loading="lazy" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">`
          : ''}
        <span class="card-img-placeholder" style="${l.photo ? 'display:none' : ''}">${l.emoji}</span>
        <div class="card-badge badge-${l.type}">${l.type === 'sublease' ? 'Sublease' : 'Full Transfer'}</div>
      </div>
      <div class="card-body">
        <div class="card-price">$${l.rent.toLocaleString()}<span>/mo</span></div>
        <div class="card-addr">📍 ${l.address}</div>
        <div class="card-tags">
          <span class="tag tag-accent">${l.school}</span>
          <span class="tag">${l.roomType === 'private' ? '🚪 Private' : l.roomType === 'shared' ? '👥 Shared' : '🏠 Studio'}</span>
          <span class="tag">👤 ${l.residents} resident${l.residents > 1 ? 's' : ''}</span>
          ${l.housingType && l.housingType !== 'coed' ? `<span class="tag tag-housing">${l.housingType === 'mens' ? '🧑 Men&#39;s' : l.housingType === 'womens' ? '👩 Women&#39;s' : '💍 Married'}</span>` : ''}
          ${l.parking !== 'none' ? `<span class="tag">🚗 Parking</span>` : ''}
          ${l.transferFee > 0 ? `<span class="tag">💸 $${l.transferFee} fee</span>` : `<span class="tag tag-green">✓ No fee</span>`}
        </div>
        <div class="card-footer">
          <div class="card-user" style="cursor:pointer">
            <div class="avatar">${l.poster}</div>
            <span class="card-user-name">${l.name}</span>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            <button class="heart-btn" id="heart-${l.id}" onclick="event.stopPropagation();toggleSaved(${l.id})" title="Save listing">${savedIds.has(l.id) ? '❤️' : '🤍'}</button>
            <span class="card-date">${l.posted}</span>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// ---- HOUSING FILTER PILL ----
function setHousingPill(btn, val) {
  document.querySelectorAll('#housing-pills .pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  activeHousingType = val;
  filterListings();
}

// ---- FILTER LISTINGS ----
function filterListings() {
  const q = document.getElementById('search-input').value.toLowerCase();
  const school = document.getElementById('school-filter').value;
  const type = document.getElementById('type-filter').value;
  const minP = parseFloat(document.getElementById('price-min').value) || 0;
  const maxP = parseFloat(document.getElementById('price-max').value) || Infinity;
  const sort = document.getElementById('sort-select').value;
  const distSchool = document.getElementById('distance-school').value;

  let result = sampleListings.filter(l => {
    if (q && !l.address.toLowerCase().includes(q) && !l.school.toLowerCase().includes(q) && !l.desc.toLowerCase().includes(q)) return false;
    if (school && l.school !== school) return false;
    if (type && l.type !== type) return false;
    if (l.rent < minP || l.rent > maxP) return false;
    if (activeHousingType && l.housingType !== activeHousingType) return false;
    if (distSchool && schoolCoords[distSchool] && l.lat && l.lng) {
      const sc = schoolCoords[distSchool];
      if (haversineDistance(l.lat, l.lng, sc.lat, sc.lng) > distMilesSchool) return false;
    }
    if (userZipCoords && l.lat && l.lng) {
      if (haversineDistance(l.lat, l.lng, userZipCoords.lat, userZipCoords.lng) > userZipMiles) return false;
    }
    return true;
  });

  if (sort === 'price-asc') result.sort((a, b) => a.rent - b.rent);
  else if (sort === 'price-desc') result.sort((a, b) => b.rent - a.rent);

  renderListings(result);
}

function getFilteredListings() {
  const q = document.getElementById('search-input').value.toLowerCase();
  const school = document.getElementById('school-filter').value;
  const type = document.getElementById('type-filter').value;
  const minP = parseFloat(document.getElementById('price-min').value) || 0;
  const maxP = parseFloat(document.getElementById('price-max').value) || Infinity;
  const distSchool = document.getElementById('distance-school').value;

  return sampleListings.filter(l => {
    if (q && !l.address.toLowerCase().includes(q) && !l.school.toLowerCase().includes(q)) return false;
    if (school && l.school !== school) return false;
    if (type && l.type !== type) return false;
    if (l.rent < minP || l.rent > maxP) return false;
    if (activeHousingType && l.housingType !== activeHousingType) return false;
    if (distSchool && schoolCoords[distSchool] && l.lat && l.lng) {
      const sc = schoolCoords[distSchool];
      if (haversineDistance(l.lat, l.lng, sc.lat, sc.lng) > distMilesSchool) return false;
    }
    if (userZipCoords && l.lat && l.lng) {
      if (haversineDistance(l.lat, l.lng, userZipCoords.lat, userZipCoords.lng) > userZipMiles) return false;
    }
    return true;
  });
}

function resetFilters() {
  document.getElementById('search-input').value = '';
  document.getElementById('school-filter').value = '';
  document.getElementById('type-filter').value = '';
  document.getElementById('price-min').value = '';
  document.getElementById('price-max').value = '';
  document.getElementById('distance-school').value = '';
  document.querySelectorAll('.filters input[type=checkbox]').forEach(c => c.checked = false);
  activeHousingType = '';
  document.querySelectorAll('#housing-pills .pill').forEach(p => p.classList.remove('active'));
  document.querySelector('#housing-pills .pill[data-val=""]').classList.add('active');
  document.getElementById('zip-input').value = '';
  document.getElementById('zip-distance-wrap').style.visibility = 'hidden';
  document.getElementById('zip-distance-wrap').style.opacity = '0';
  document.getElementById('distance-school').value = '';
  document.getElementById('school-distance-wrap').style.visibility = 'hidden';
  document.getElementById('school-distance-wrap').style.opacity = '0';
  userZipCoords = null;
  userZipMiles = 5;
  distMilesSchool = 5;
  document.getElementById('stat-zip-count').textContent = '—';
  document.getElementById('stat-zip-label').textContent = 'Near your zip';
  switchLocTab('zip');
}

// ---- OPEN LISTING DETAIL ----
function openListing(id) {
  const l = sampleListings.find(x => x.id === id || x.id === String(id) || String(x.id) === String(id));
  const totalEst = l.rent + l.utilities + l.internet;
  document.getElementById('listing-detail').innerHTML = `
    ${l.photo
      ? `<div class="listing-hero" style="padding:0;overflow:hidden"><img src="${l.photo}" style="width:100%;height:100%;object-fit:cover;display:block" alt="${l.address}"></div>`
      : `<div class="listing-hero">${l.emoji}</div>`}
    <div class="listing-body">
      <div class="listing-top">
        <div>
          <div class="listing-price">$${l.rent.toLocaleString()}<span>/mo</span></div>
          <div class="listing-addr" style="cursor:pointer" onclick="openGoogleMaps(this.dataset.addr)" data-addr="${l.address}">📍 ${l.address} ↗</div>
          <div class="listing-school">${l.school}</div>
        </div>
        <button class="modal-close" onclick="closeModal('listing')" style="margin-top:4px">✕</button>
      </div>

      <div class="listing-grid">
        <div class="info-item"><div class="info-item-label">Listing Type</div><div class="info-item-val">${l.type === 'sublease' ? '🔄 Sublease' : '📋 Full Transfer'}</div></div>
        <div class="info-item"><div class="info-item-label">Housing Type</div><div class="info-item-val">${l.housingType === 'mens' ? '🧑 Men&#39;s' : l.housingType === 'womens' ? '👩 Women&#39;s' : l.housingType === 'married' ? '💍 Married' : '🏠 Co-ed'}</div></div>
        <div class="info-item"><div class="info-item-label">Room Type</div><div class="info-item-val">${l.roomType === 'private' ? '🚪 Private Room' : l.roomType === 'shared' ? '👥 Shared Room' : '🏠 Studio'}</div></div>
        <div class="info-item"><div class="info-item-label">Residents</div><div class="info-item-val">👤 ${l.residents} total</div></div>
        <div class="info-item"><div class="info-item-label">Parking</div><div class="info-item-val">🚗 ${l.parking.charAt(0).toUpperCase() + l.parking.slice(1)}</div></div>
        <div class="info-item"><div class="info-item-label">Lease Start</div><div class="info-item-val">📅 ${l.leaseStart}</div></div>
        <div class="info-item"><div class="info-item-label">Lease End</div><div class="info-item-val">📅 ${l.leaseEnd}</div></div>
      </div>

      <div class="fees-section">
        <h4>Monthly Cost Breakdown</h4>
        <div class="fee-row"><span>Base Rent</span><span>$${l.rent}/mo</span></div>
        <div class="fee-row"><span>Est. Utilities</span><span>${l.utilities ? '$' + l.utilities + '/mo' : 'Included'}</span></div>
        <div class="fee-row"><span>Internet</span><span>${l.internet ? '$' + l.internet + '/mo' : 'Included'}</span></div>
        ${l.extras ? `<div class="fee-row"><span>Other</span><span>${l.extras}</span></div>` : ''}
        ${l.transferFee > 0 ? `<div class="fee-row"><span>Transfer Fee (one-time)</span><span>$${l.transferFee}</span></div>` : ''}
        <div class="fee-row" style="margin-top:4px"><span>Est. Monthly Total</span><span style="color:var(--accent);font-weight:600">~$${totalEst}/mo</span></div>
      </div>
      <div class="lease-fee-row">
        <span class="lease-fee-label">🏷️ Lease Platform Fee (1.5%)</span>
        <span class="lease-fee-amount">$${((l.rent + (l.transferFee || 0)) * 0.015).toFixed(2)} <span style="font-size:11px;font-weight:400;opacity:0.8">one-time</span></span>
      </div>
      <p style="font-size:11px;color:var(--mid);margin-bottom:20px;margin-top:6px">Calculated on first month's rent${l.transferFee > 0 ? ' + $' + l.transferFee + ' transfer fee' : ''}. Collected upon successful transfer.</p>

      ${l.desc ? `<p style="font-size:13px;color:var(--mid);margin-bottom:24px;line-height:1.7">${l.desc}</p>` : ''}

      <div class="contact-section">
        <button class="btn btn-primary" style="flex:1;justify-content:center" onclick="openChat('${l.id}')">💬 Message ${l.name}</button>
        <button class="btn btn-outline" onclick="showToast('Copied: ${l.phone}', false)">📞 ${l.phone}</button>
        <button class="heart-btn" style="font-size:22px;padding:6px" onclick="toggleSaved(${l.id})" id="detail-heart-${l.id}">${savedIds.has(l.id) ? '❤️' : '🤍'}</button>
      </div>
      ${currentUser && l.user_id === currentUser.id ? `
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--rule)">
        <button class="btn btn-outline" style="width:100%;justify-content:center;color:var(--green);border-color:var(--green)" onclick="closeModal('listing');showSuccessFeeModal('${l.id}')">🎉 Mark as Transferred — Pay 5% Success Fee</button>
      </div>` : ''}
    </div>
  `;
  openModal('listing');
}

// ---- FEE SUMMARY ----
function updateFeeSummary() {
  const rent = parseFloat(document.getElementById('post-rent').value);
  const display = document.getElementById('fee-amount-display');
  const note = document.getElementById('fee-calc-note');
  if (rent && rent > 0) {
    const fee = (rent * 0.015).toFixed(2);
    display.innerHTML = `$${fee}<span> platform fee</span>`;
    note.textContent = `1.5% × $${rent.toLocaleString()} base rent = $${fee} paid to Lease upon successful transfer.`;
  } else {
    display.innerHTML = `—<span> platform fee</span>`;
    note.textContent = 'Enter your base rent above to see your exact fee.';
  }
}

function updateFeePreview() {
  const rent = parseFloat(document.getElementById('post-rent').value) || 0;
  const fee = parseFloat(document.getElementById('post-fee').value) || 0;
  const base = rent + fee;
  const leaseFee = (base * 0.015).toFixed(2);
  const preview = document.getElementById('post-fee-preview');
  if (preview) {
    preview.textContent = base > 0
      ? `Your estimated Lease fee: $${leaseFee} (based on $${rent.toLocaleString()} rent${fee > 0 ? ` + $${fee} transfer fee` : ''})`
      : '';
  }
}

// ---- PHOTO UPLOAD ----
function handlePhotoUpload(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  const previewRow = document.getElementById('photo-preview-row');
  previewRow.style.display = 'flex';
  document.getElementById('upload-label').textContent = files.length + ' photo(s) selected';

  files.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      if (idx === 0) uploadedPhotos[0] = dataUrl;
      else uploadedPhotos.push(dataUrl);

      const thumb = document.createElement('div');
      thumb.className = 'photo-thumb';
      thumb.innerHTML = `<img src="${dataUrl}"><button class="photo-thumb-remove" onclick="removePhoto(${uploadedPhotos.length - 1},this.parentNode)">✕</button>`;
      previewRow.appendChild(thumb);
    };
    reader.readAsDataURL(file);
  });
}

function removePhoto(idx, thumbEl) {
  uploadedPhotos.splice(idx, 1);
  thumbEl.remove();
  if (uploadedPhotos.length === 0) {
    document.getElementById('photo-preview-row').style.display = 'none';
    document.getElementById('upload-label').textContent = 'Click to upload photos';
  }
}

// ---- POST LISTING ----
async function postListing() {
  if (!currentUser) { showToast('Please log in to post a listing', false); closeModal('post'); openModal('auth'); return; }
  const addr = document.getElementById('post-addr').value;
  const rent = document.getElementById('post-rent').value;
  if (!addr || !rent) { showToast('Please fill in address and rent', false); return; }

  const listingData = {
    type: document.getElementById('post-type').value,
    housingType: document.getElementById('post-housing').value || 'coed',
    address: addr,
    school: document.getElementById('post-school').value || 'Other',
    rent: parseInt(rent),
    transferFee: parseInt(document.getElementById('post-fee').value) || 0,
    utilities: parseInt(document.getElementById('post-utilities')?.value) || 0,
    internet: parseInt(document.getElementById('post-internet')?.value) || 0,
    extras: document.getElementById('post-extras').value,
    roomType: document.getElementById('post-room').value,
    residents: parseInt(document.getElementById('post-residents').value) || 1,
    parking: document.getElementById('post-parking').value,
    beds: document.getElementById('post-beds').value,
    leaseStart: document.getElementById('post-start').value || '',
    leaseEnd: document.getElementById('post-end').value || '',
    desc: document.getElementById('post-desc').value,
    photo: uploadedPhotos[0] || null,
  };

  const btn = document.querySelector('#post-overlay .btn-primary');
  btn.textContent = 'Publishing…';
  btn.disabled = true;

  const result = await postListingToDB({ ...listingData, is_active: true });

  btn.textContent = 'Publish Listing';
  btn.disabled = false;

  if (!result) return;

  closeModal('post');
  uploadedPhotos = [];
  document.getElementById('photo-preview-row').style.display = 'none';
  document.getElementById('upload-label').textContent = 'Click to upload photos';
  showToast('✓ Listing posted!', true);
  await refreshListings();
}

// ---- REFRESH LISTINGS ----
async function refreshListings() {
  const listings = await loadListings();
  sampleListings.length = 0;
  listings.forEach(l => sampleListings.push(l));
  renderListings(sampleListings);
  document.getElementById('stat-listings').textContent = sampleListings.length;
}

// ---- HELPERS ----
function openGoogleMaps(addr) {
  window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr), '_blank');
}
