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
    photos: Array.isArray(l.photo_urls) && l.photo_urls.length > 0 ? l.photo_urls : (l.photo_url ? [l.photo_url] : []),
    photo: l.photo_url || (Array.isArray(l.photo_urls) && l.photo_urls.length > 0 ? l.photo_urls[0] : null),
    type: l.type,
    housingType: l.housing_type,
    address: l.address,
    school: l.school || '',
    lat: l.lat,
    lng: l.lng,
    rent: l.rent,
    transferFee: l.transfer_fee || 0,
    feeResponsibility: l.fee_responsibility || '',
    utilities: l.utilities || 0,
    internet: l.internet || 0,
    parkingFee: l.parking_fee || 0,
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
    fee_responsibility: formData.feeResponsibility || null,
    utilities: formData.utilities,
    internet: formData.internet,
    parking_fee: formData.parkingFee || 0,
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
    city: formData.city || null,
    state_abbr: formData.state || null,
    zip_code: formData.zip || null,
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
    <div class="card" onclick="openListing('${l.id}')">
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
            <button class="heart-btn" id="heart-${l.id}" onclick="event.stopPropagation();toggleSaved('${l.id}')" title="Save listing">${savedIds.has(l.id) ? '❤️' : '🤍'}</button>
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
async function openListing(id) {
  const l = sampleListings.find(x => x.id === id || x.id === String(id) || String(x.id) === String(id));
  const totalEst = l.rent + l.utilities + l.internet + (l.parkingFee || 0);

  // Fetch seller profile for social links
  let sellerProfile = {};
  if (l.user_id && typeof _sb !== 'undefined') {
    // Use cached currentProfile if it's the same user
    if (currentUser && currentProfile && l.user_id === currentUser.id) {
      sellerProfile = currentProfile;
    } else {
      const { data } = await _sb.from('profiles').select('*').eq('id', l.user_id).single();
      if (data) sellerProfile = data;
    }
  }

  const avatarContent = sellerProfile.avatar_url
    ? `<img src="${sellerProfile.avatar_url}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
    : `<span style="font-size:16px;font-weight:700;color:#fff">${l.poster}</span>`;

  const socialLinks = [
    sellerProfile.instagram ? `<a href="https://instagram.com/${sellerProfile.instagram.replace('@','')}" target="_blank" style="color:var(--accent);text-decoration:none;font-size:12px">📸 ${sellerProfile.instagram}</a>` : '',
    sellerProfile.facebook ? `<a href="${sellerProfile.facebook.startsWith('http') ? sellerProfile.facebook : 'https://' + sellerProfile.facebook}" target="_blank" style="color:var(--accent);text-decoration:none;font-size:12px">🔵 Facebook</a>` : '',
    sellerProfile.linkedin ? `<a href="${sellerProfile.linkedin.startsWith('http') ? sellerProfile.linkedin : 'https://' + sellerProfile.linkedin}" target="_blank" style="color:var(--accent);text-decoration:none;font-size:12px">💼 LinkedIn</a>` : '',
    sellerProfile.phone ? `<a href="tel:${sellerProfile.phone}" style="color:var(--accent);text-decoration:none;font-size:12px">📞 ${sellerProfile.phone}</a>` : '',
  ].filter(Boolean).join('');

  document.getElementById('listing-detail').innerHTML = `
    ${l.photos && l.photos.length > 1 ? `
    <div class="listing-gallery" id="gallery-${l.id}" style="position:relative;height:260px;overflow:hidden;background:#111">
      ${l.photos.map((url, i) => `<img src="${url}" data-idx="${i}" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:${i===0?1:0};transition:opacity 0.3s">`).join('')}
      <button onclick="galleryPrev('${l.id}',${l.photos.length})" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.45);border:none;color:#fff;border-radius:50%;width:32px;height:32px;font-size:16px;cursor:pointer;z-index:2">‹</button>
      <button onclick="galleryNext('${l.id}',${l.photos.length})" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.45);border:none;color:#fff;border-radius:50%;width:32px;height:32px;font-size:16px;cursor:pointer;z-index:2">›</button>
      <div style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;gap:5px;z-index:2">
        ${l.photos.map((_, i) => `<div id="gdot-${l.id}-${i}" style="width:6px;height:6px;border-radius:50%;background:${i===0?'#fff':'rgba(255,255,255,0.5)'}"></div>`).join('')}
      </div>
    </div>` : l.photo
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

      <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--bg);border-radius:14px;margin-bottom:20px;cursor:pointer" onclick="openPublicProfile('${l.user_id}')">
        <div style="width:48px;height:48px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">
          ${sellerProfile.avatar_url
            ? `<img src="${sellerProfile.avatar_url}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span style="display:none;font-size:17px;font-weight:700;color:#fff">${l.poster}</span>`
            : `<span style="font-size:17px;font-weight:700;color:#fff">${l.poster}</span>`}
        </div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px;margin-bottom:2px;color:var(--accent);text-decoration:underline;text-underline-offset:3px">${sellerProfile.name || l.name}</div>
          ${sellerProfile.school ? `<div style="font-size:11px;color:var(--mid)">🎓 ${sellerProfile.school}</div>` : ''}
          ${socialLinks ? `<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:6px">${socialLinks}</div>` : ''}
        </div>
        <button onclick="event.stopPropagation();openChat('${l.id}')" class="btn btn-outline" style="font-size:12px;padding:8px 14px;flex-shrink:0">💬 Message</button>
      </div>

      <div class="listing-grid">
        <div class="info-item"><div class="info-item-label">Listing Type</div><div class="info-item-val">${l.type === 'sublease' ? 'Sublease' : 'Full Transfer'}</div></div>
        <div class="info-item"><div class="info-item-label">Housing Type</div><div class="info-item-val">${l.housingType === 'mens' ? "Men's" : l.housingType === 'womens' ? "Women's" : l.housingType === 'married' ? 'Married' : 'Co-ed'}</div></div>
        <div class="info-item"><div class="info-item-label">Room Type</div><div class="info-item-val">${l.roomType === 'private' ? 'Private Room' : l.roomType === 'shared' ? 'Shared Room' : 'Studio'}</div></div>
        <div class="info-item"><div class="info-item-label">Residents</div><div class="info-item-val">${l.residents >= 6 ? '6+' : l.residents} total</div></div>
        <div class="info-item"><div class="info-item-label">Parking</div><div class="info-item-val">${l.parking.charAt(0).toUpperCase() + l.parking.slice(1)}</div></div>
        <div class="info-item"><div class="info-item-label">Lease Start</div><div class="info-item-val">${l.leaseStart}</div></div>
        <div class="info-item"><div class="info-item-label">Lease End</div><div class="info-item-val">${l.leaseEnd}</div></div>
      </div>

      <div class="fees-section">
        <h4>Monthly Cost Breakdown</h4>
        <div class="fee-row"><span>Base Rent</span><span>$${l.rent}/mo</span></div>
        <div class="fee-row"><span>Est. Utilities</span><span>${l.utilities ? '$' + l.utilities + '/mo' : 'Included'}</span></div>
        <div class="fee-row"><span>Internet</span><span>${l.internet ? '$' + l.internet + '/mo' : 'Included'}</span></div>
        <div class="fee-row"><span>Parking</span><span>${l.parkingFee ? '$' + l.parkingFee + '/mo' : 'Included'}</span></div>
        ${l.extras ? `<div class="fee-row"><span>Other</span><span>${l.extras}</span></div>` : ''}
        ${l.transferFee > 0 ? `<div class="fee-row"><span>Transfer Fee (one-time)</span><span>$${l.transferFee}</span></div>` : ''}
        ${l.feeResponsibility ? `<div class="fee-row"><span>Transfer Fee Paid By</span><span>${l.feeResponsibility === 'seller' ? 'Seller' : 'Buyer'}</span></div>` : ''}
        <div class="fee-row" style="margin-top:4px"><span>Est. Monthly Total</span><span style="color:var(--accent);font-weight:600">~$${totalEst}/mo</span></div>
      </div>
      ${l.desc ? `<p style="font-size:13px;color:var(--mid);margin-bottom:24px;line-height:1.7">${l.desc}</p>` : ''}

      <div class="contact-section">
        <button class="btn btn-primary" style="flex:1;justify-content:center" onclick="openChat('${l.id}')">💬 Message ${sellerProfile.name || l.name}</button>
        <button class="btn btn-outline" style="padding:10px 14px" onclick="shareListing('${l.id}')" title="Share listing">↗ Share</button>
        <button class="btn btn-outline" style="padding:10px 14px" onclick="emailListing('${l.id}')" title="Email listing">✉️</button>
        <button class="heart-btn" style="font-size:22px;padding:6px" onclick="toggleSaved('${l.id}')" id="detail-heart-${l.id}">${savedIds.has(l.id) ? '❤️' : '🤍'}</button>
      </div>
    </div>
  `;
  window.history.replaceState({}, '', '?listing=' + id);
  openModal('listing');
}


// ---- SHARE LISTING ----

async function shareListing(id) {
  const l = sampleListings.find(x => String(x.id) === String(id));
  if (!l) return;
  const url = window.location.origin + window.location.pathname + '?listing=' + id;
  const parts = [
    `Check out this $${l.rent.toLocaleString()}/mo lease at ${l.address}!`,
    l.leaseStart ? `Available ${l.leaseStart} – ${l.leaseEnd}.` : '',
    url,
  ].filter(Boolean);
  const msg = parts.join(' ');
  if (navigator.share) {
    try {
      await navigator.share({ title: `$${l.rent.toLocaleString()}/mo — ${l.address}`, text: msg, url });
    } catch (e) {
      if (e.name !== 'AbortError') copyToClipboard(msg);
    }
  } else {
    copyToClipboard(msg);
  }
}

function emailListing(id) {
  const l = sampleListings.find(x => String(x.id) === String(id));
  if (!l) return;
  const url = window.location.origin + window.location.pathname + '?listing=' + id;
  const subject = `Lease listing: $${l.rent.toLocaleString()}/mo at ${l.address}`;
  const body = [
    'Hey! I found this lease listing you might be interested in:',
    '',
    `Address: ${l.address}`,
    `Rent: $${l.rent.toLocaleString()}/mo`,
    l.school ? `Near: ${l.school}` : '',
    `Type: ${l.type === 'sublease' ? 'Sublease' : 'Full Transfer'}`,
    l.leaseStart ? `Dates: ${l.leaseStart} – ${l.leaseEnd}` : '',
    '',
    `View the full listing here: ${url}`,
  ].filter(Boolean).join('\n');
  window.open('mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body));
}

function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => showToast('Copied! Paste anywhere to share.', true));
  } else {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copied! Paste anywhere to share.', true);
  }
}

// ---- PHOTO UPLOAD ----
function handlePhotoUpload(event) {
  const files = Array.from(event.target.files);
  if (!files.length) return;
  const previewRow = document.getElementById('photo-preview-row');
  previewRow.style.display = 'flex';

  files.forEach((file) => {
    // Store the actual File object for upload later
    uploadedPhotos.push(file);
    const idx = uploadedPhotos.length - 1;

    const reader = new FileReader();
    reader.onload = (e) => {
      const thumb = document.createElement('div');
      thumb.className = 'photo-thumb';
      thumb.dataset.idx = idx;
      thumb.innerHTML = `<img src="${e.target.result}"><button class="photo-thumb-remove" onclick="removePhoto(this.parentNode)">✕</button>`;
      previewRow.appendChild(thumb);
      document.getElementById('upload-label').textContent = uploadedPhotos.length + ' photo(s) selected';
    };
    reader.readAsDataURL(file);
  });
}

function removePhoto(thumbEl) {
  const idx = parseInt(thumbEl.dataset.idx);
  uploadedPhotos.splice(idx, 1);
  // Re-index remaining thumbs
  const previewRow = document.getElementById('photo-preview-row');
  previewRow.removeChild(thumbEl);
  Array.from(previewRow.children).forEach((t, i) => t.dataset.idx = i);
  if (uploadedPhotos.length === 0) {
    previewRow.style.display = 'none';
    document.getElementById('upload-label').textContent = 'Click to upload photos';
  } else {
    document.getElementById('upload-label').textContent = uploadedPhotos.length + ' photo(s) selected';
  }
}

async function uploadListingPhotos(listingId) {
  if (!uploadedPhotos.length) return [];
  const urls = [];
  for (let i = 0; i < uploadedPhotos.length; i++) {
    const file = uploadedPhotos[i];
    const ext = file.name.split('.').pop().toLowerCase();
    const path = currentUser.id + '/' + listingId + '/' + i + '_' + Date.now() + '.' + ext;
    const { error } = await _sb.storage.from('listing-photos').upload(path, file, { upsert: true, contentType: file.type });
    if (error) { console.warn('Photo upload error:', error.message); showToast('Photo upload failed: ' + error.message, false); continue; }
    const { data } = _sb.storage.from('listing-photos').getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

// ---- EDIT LISTING ----
async function editListing(id) {
  const { data: l, error } = await _sb.from('listings').select('*').eq('id', id).single();
  if (error || !l) { showToast('Could not load listing', false); return; }

  // Close any open overlays
  document.getElementById('my-profile-overlay').style.display = 'none';
  closeModal('my-listings');

  // Pre-fill the post form
  document.getElementById('post-edit-id').value = l.id;
  // Split stored address back into parts for editing
  const addrParts = (l.address || '').split(',').map(s => s.trim());
  document.getElementById('post-addr').value = l.city ? (addrParts[0] || '') : (l.address || '');
  document.getElementById('post-city').value = l.city || '';
  document.getElementById('post-state').value = l.state_abbr || 'UT';
  document.getElementById('post-zip').value = l.zip_code || '';
  document.getElementById('post-school').value = l.school || '';
  document.getElementById('post-type').value = l.type || 'sublease';
  document.getElementById('post-housing').value = l.housing_type || 'coed';
  document.getElementById('post-rent').value = l.rent || '';
  document.getElementById('post-fee').value = l.transfer_fee || 0;
  document.getElementById('post-fee-responsibility').value = l.fee_responsibility || '';
  document.getElementById('post-utilities').value = l.utilities || 0;
  document.getElementById('post-internet').value = l.internet || 0;
  document.getElementById('post-parking-fee').value = l.parking_fee || 0;
  document.getElementById('post-extras').value = l.extras || '';
  document.getElementById('post-room').value = l.room_type || 'private';
  document.getElementById('post-residents').value = l.residents || 1;
  document.getElementById('post-parking').value = l.parking || 'none';
  document.getElementById('post-beds').value = l.beds || 'Studio';
  document.getElementById('post-start').value = l.lease_start || '';
  document.getElementById('post-end').value = l.lease_end || '';
  document.getElementById('post-desc').value = l.description || '';

  // Update modal title and button
  document.querySelector('#post-overlay .modal-title').textContent = 'Edit Listing';
  document.getElementById('post-submit-btn').textContent = 'Save Changes';

  openModal('post');
}

// ---- POST LISTING ----
async function postListing() {
  if (!currentUser) { showToast('Please log in to post a listing', false); closeModal('post'); openModal('auth'); return; }
  const street = document.getElementById('post-addr').value.trim();
  const city = document.getElementById('post-city').value.trim();
  const state = document.getElementById('post-state').value.trim();
  const zip = document.getElementById('post-zip').value.trim();
  const rent = document.getElementById('post-rent').value;
  if (!street || !city || !rent) { showToast('Please fill in address, city, and rent', false); return; }
  const addr = [street, city, state, zip].filter(Boolean).join(', ');

  const editId = document.getElementById('post-edit-id').value;

  const listingData = {
    type: document.getElementById('post-type').value,
    housingType: document.getElementById('post-housing').value || 'coed',
    address: addr,
    city,
    state,
    zip,
    school: document.getElementById('post-school').value || 'Other',
    rent: parseInt(rent),
    transferFee: parseInt(document.getElementById('post-fee').value) || 0,
    feeResponsibility: document.getElementById('post-fee-responsibility').value || '',
    utilities: parseInt(document.getElementById('post-utilities')?.value) || 0,
    internet: parseInt(document.getElementById('post-internet')?.value) || 0,
    parkingFee: parseInt(document.getElementById('post-parking-fee')?.value) || 0,
    extras: document.getElementById('post-extras').value,
    roomType: document.getElementById('post-room').value,
    residents: parseInt(document.getElementById('post-residents').value) || 1,
    parking: document.getElementById('post-parking').value,
    beds: document.getElementById('post-beds').value,
    leaseStart: document.getElementById('post-start').value || '',
    leaseEnd: document.getElementById('post-end').value || '',
    desc: document.getElementById('post-desc').value,
    photo: null, // set after upload
  };

  const btn = document.querySelector('#post-overlay .btn-primary');
  btn.textContent = 'Saving…';
  btn.disabled = true;

  // Geocode the address so it shows on the map
  btn.textContent = 'Locating address…';
  const coords = await geocodeAddress(listingData.address);
  listingData.lat = coords.lat;
  listingData.lng = coords.lng;

  if (editId) {
    // UPDATE existing listing
    const { error } = await _sb.from('listings').update({
      type: listingData.type,
      housing_type: listingData.housingType,
      address: listingData.address,
      school: listingData.school,
      rent: listingData.rent,
      transfer_fee: listingData.transferFee,
      fee_responsibility: listingData.feeResponsibility || null,
      utilities: listingData.utilities,
      internet: listingData.internet,
      parking_fee: listingData.parkingFee,
      extras: listingData.extras,
      room_type: listingData.roomType,
      residents: listingData.residents,
      parking: listingData.parking,
      beds: listingData.beds,
      lease_start: listingData.leaseStart,
      lease_end: listingData.leaseEnd,
      description: listingData.desc,
      lat: listingData.lat,
      lng: listingData.lng,
      city: listingData.city,
      state_abbr: listingData.state,
      zip_code: listingData.zip,
    }).eq('id', editId).eq('user_id', currentUser.id);

    if (uploadedPhotos.length > 0) {
      btn.textContent = 'Uploading photos…';
      const photoUrls = await uploadListingPhotos(editId);
      if (photoUrls.length > 0) {
        await _sb.from('listings').update({ photo_url: photoUrls[0], photo_urls: photoUrls }).eq('id', editId);
      }
    }

    btn.textContent = 'Save Changes';
    btn.disabled = false;
    document.getElementById('post-edit-id').value = '';
    document.querySelector('#post-overlay .modal-title').textContent = 'Post a Listing';
    btn.textContent = 'Publish Listing';

    closeModal('post');
    uploadedPhotos = [];
    document.getElementById('photo-preview-row').style.display = 'none';
    document.getElementById('upload-label').textContent = 'Click to upload photos';
    if (error) { showToast('Error saving: ' + error.message, false); return; }
    showToast('✓ Listing updated!', true);
    await refreshListings();
  } else {
    // INSERT new listing (inactive until payment)
    try {
      const result = await postListingToDB({ ...listingData, is_active: false });
      if (!result) { btn.textContent = 'Publish Listing'; btn.disabled = false; return; }

      if (uploadedPhotos.length > 0) {
        btn.textContent = 'Uploading photos…';
        const photoUrls = await uploadListingPhotos(result.id);
        if (photoUrls.length > 0) {
          await _sb.from('listings').update({ photo_url: photoUrls[0], photo_urls: photoUrls }).eq('id', result.id);
        }
      }

      closeModal('post');
      uploadedPhotos = [];
      document.getElementById('photo-preview-row').style.display = 'none';
      document.getElementById('upload-label').textContent = 'Click to upload photos';

      sessionStorage.setItem('paidListingId', result.id);
      showToast('Listing saved! Taking you to payment…', true);
      setTimeout(() => {
        window.location.href = 'https://buy.stripe.com/test_3cI9AV2zKcza1VcekC6kg00?client_reference_id=' + (currentUser.id || '') + '_listing_' + result.id;
      }, 1200);
    } catch (e) {
      console.error('postListing error:', e);
      showToast('Error saving listing: ' + e.message, false);
      btn.textContent = 'Publish Listing';
      btn.disabled = false;
    }
  }
}

// ---- GEOCODE ADDRESS ----
async function geocodeAddress(address) {
  return new Promise((resolve) => {
    if (!window.google || !window.google.maps) { resolve({ lat: null, lng: null }); return; }
    new google.maps.Geocoder().geocode({ address }, (results, status) => {
      if (status === 'OK' && results[0]) {
        resolve({
          lat: results[0].geometry.location.lat(),
          lng: results[0].geometry.location.lng(),
        });
      } else {
        resolve({ lat: null, lng: null });
      }
    });
  });
}

// ---- REFRESH LISTINGS ----
async function refreshListings() {
  const listings = await loadListings();
  sampleListings.length = 0;
  listings.forEach(l => sampleListings.push(l));
  renderListings(sampleListings);
  document.getElementById('stat-listings').textContent = sampleListings.length;
}

// ---- GALLERY ----
const galleryIdx = {};

function galleryNext(id, total) {
  galleryGo(id, total, 1);
}
function galleryPrev(id, total) {
  galleryGo(id, total, -1);
}
function galleryGo(id, total, dir) {
  const current = galleryIdx[id] || 0;
  const next = (current + dir + total) % total;
  galleryIdx[id] = next;
  const container = document.getElementById('gallery-' + id);
  if (!container) return;
  container.querySelectorAll('img').forEach(img => img.style.opacity = 0);
  const nextImg = container.querySelector(`img[data-idx="${next}"]`);
  if (nextImg) nextImg.style.opacity = 1;
  for (let i = 0; i < total; i++) {
    const dot = document.getElementById('gdot-' + id + '-' + i);
    if (dot) dot.style.background = i === next ? '#fff' : 'rgba(255,255,255,0.5)';
  }
}

// ---- HELPERS ----
function openGoogleMaps(addr) {
  window.open('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr), '_blank');
}
