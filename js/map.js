// ---- MAP ----

let _gmap = null; // global reference for panning

// Called by Google Maps API when it loads (set as callback in script URL)
function initGoogleMap() {
  if (document.getElementById('page-map') && document.getElementById('page-map').style.display !== 'none') {
    buildGoogleMap(getFilteredListings());
  }
}

function buildGoogleMap(listings) {
  const mapEl = document.getElementById('google-map');
  if (!mapEl || !window.google || !window.google.maps) return;

  if (leafletMap) { leafletMap.remove(); leafletMap = null; leafletMarkers = []; }
  mapEl.innerHTML = '';

  const gmap = new google.maps.Map(mapEl, {
    zoom: 11,
    center: { lat: 40.35, lng: -111.75 },
    mapTypeControl: false,
    streetViewControl: false,
    fullscreenControl: true,
  });

  const bounds = new google.maps.LatLngBounds();
  listings.forEach(l => {
    if (!l.lat || !l.lng) return;
    const marker = new google.maps.Marker({
      position: { lat: l.lat, lng: l.lng },
      map: gmap,
      title: l.address,
      label: { text: '$' + l.rent.toLocaleString(), color: '#fff', fontSize: '11px', fontWeight: 'bold' },
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 22,
        fillColor: '#2A7A52',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      }
    });
    marker.addListener('click', () => selectMapListing(l.id));
    bounds.extend({ lat: l.lat, lng: l.lng });
  });

  if (!bounds.isEmpty()) {
    gmap.fitBounds(bounds);
    google.maps.event.addListenerOnce(gmap, 'idle', () => {
      if (gmap.getZoom() > 14) gmap.setZoom(14);
    });
  }
  _gmap = gmap;
}

function renderMap() {
  const listings = getFilteredListings();
  document.getElementById('map-count').textContent = listings.length + ' shown';

  const list = document.getElementById('map-listing-list');
  list.innerHTML = listings.map(l => `
    <div class="map-card" id="mc-${l.id}" onclick="selectMapListing('${l.id}')">
      <div class="map-card-price">$${l.rent.toLocaleString()}<span>/mo</span></div>
      <div class="map-card-addr">📍 ${l.address}</div>
      <div class="map-card-tags">
        <span class="tag tag-accent">${l.school}</span>
        <span class="tag">${l.roomType === 'private' ? '🚪 Private' : l.roomType === 'shared' ? '👥 Shared' : '🏠 Studio'}</span>
        <span class="tag">👤 ${l.residents} residents</span>
        ${l.parking !== 'none' ? '<span class="tag">🚗 Parking</span>' : ''}
      </div>
    </div>
  `).join('');

  if (window.google && window.google.maps) {
    buildGoogleMap(listings);
  } else {
    buildLeafletMap(listings);
  }
}

function buildLeafletMap(listings) {
  if (typeof L === 'undefined') {
    setTimeout(() => buildLeafletMap(listings), 150);
    return;
  }
  const mapEl = document.getElementById('google-map');
  if (!mapEl) return;

  if (leafletMap) { leafletMap.remove(); leafletMap = null; }
  leafletMarkers = [];
  mapEl.innerHTML = '';

  leafletMap = L.map('google-map', { center: [40.35, -111.75], zoom: 11, zoomControl: true });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(leafletMap);

  const bounds = [];
  listings.forEach(l => {
    if (!l.lat || !l.lng) return;
    const icon = L.divIcon({
      className: '',
      html: `<div style="background:#2A7A52;color:#fff;padding:5px 12px;border-radius:20px;font-family:Syne,sans-serif;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 3px 10px rgba(0,0,0,0.25);border:2px solid #fff;cursor:pointer;display:inline-block;">$${l.rent.toLocaleString()}/mo</div>`,
      iconSize: [100, 30],
      iconAnchor: [50, 15]
    });
    const m = L.marker([l.lat, l.lng], { icon }).addTo(leafletMap);
    m.on('click', () => selectMapListing(l.id));
    leafletMarkers.push(m);
    bounds.push([l.lat, l.lng]);
  });

  if (bounds.length > 0) leafletMap.fitBounds(bounds, { padding: [50, 50] });

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      leafletMap && leafletMap.invalidateSize(true);
    });
  });
}

function selectMapListing(id) {
  document.querySelectorAll('.map-card').forEach(c => c.classList.remove('active'));
  const card = document.getElementById('mc-' + id);
  if (card) { card.classList.add('active'); card.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }

  mapPopupId = id;
  const l = sampleListings.find(x => String(x.id) === String(id));
  const popup = document.getElementById('map-popup');
  if (!popup || !l) return;

  // Center and zoom map to listing, offset left so pin isn't behind popup
  if (l.lat && l.lng) {
    if (_gmap) {
      _gmap.setCenter({ lat: l.lat, lng: l.lng });
      _gmap.setZoom(16);
      // Nudge pin right so it sits clear of the left-side popup
      setTimeout(() => _gmap && _gmap.panBy(160, 0), 50);
    } else if (leafletMap) {
      leafletMap.setView([l.lat, l.lng], 16);
      setTimeout(() => leafletMap && leafletMap.panBy([160, 0]), 50);
    }
  }

  const totalEst = l.rent + (l.utilities || 0) + (l.internet || 0);
  popup.className = 'map-popup open';
  popup.innerHTML = `
    <button class="map-popup-close" onclick="closeMapPopup()">✕</button>
    ${l.photo ? `<div style="height:130px;border-radius:10px;overflow:hidden;margin-bottom:12px"><img src="${l.photo}" style="width:100%;height:100%;object-fit:cover"></div>` : ''}
    <div class="map-popup-price">$${l.rent.toLocaleString()}<span>/mo</span></div>
    <div class="map-popup-addr" style="cursor:pointer" onclick="openGoogleMaps(this.dataset.addr)" data-addr="${l.address}">📍 ${l.address} ↗</div>
    <div class="map-popup-grid">
      <div class="map-popup-item"><div class="map-popup-item-label">School</div><div class="map-popup-item-val">${l.school}</div></div>
      <div class="map-popup-item"><div class="map-popup-item-label">Residents</div><div class="map-popup-item-val">👤 ${l.residents >= 6 ? '6+' : l.residents} total</div></div>
      <div class="map-popup-item"><div class="map-popup-item-label">Room Type</div><div class="map-popup-item-val">${l.roomType === 'private' ? '🚪 Private' : l.roomType === 'shared' ? '👥 Shared' : '🏠 Studio'}</div></div>
      <div class="map-popup-item"><div class="map-popup-item-label">Est. Total/mo</div><div class="map-popup-item-val">~$${totalEst}</div></div>
    </div>
    <div style="display:flex;gap:8px;">
      <button class="btn btn-primary" style="flex:1;justify-content:center;font-size:13px" onclick="closeMapPopup();openListing('${l.id}')">View Full Listing</button>
      <button class="btn btn-outline" style="font-size:13px" onclick="event.stopPropagation();openChat('${l.id}')">💬</button>
    </div>
  `;
}

function closeMapPopup() {
  mapPopupId = null;
  const popup = document.getElementById('map-popup');
  if (popup) popup.className = 'map-popup';
  document.querySelectorAll('.map-card').forEach(c => c.classList.remove('active'));
}
