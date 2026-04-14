// ---- INIT ----
// initGoogleMap is defined in map.js and called by the Google Maps API script tag

document.addEventListener('DOMContentLoaded', async () => {
  // Init EmailJS
  if (typeof emailjs !== 'undefined') emailjs.init(EMAILJS_PUBLIC_KEY);

  // Wait for Supabase CDN to be ready
  let attempts = 0;
  while (typeof window.supabase === 'undefined' && attempts < 20) {
    await new Promise(r => setTimeout(r, 100));
    attempts++;
  }
  if (typeof window.supabase === 'undefined') {
    console.error('Supabase CDN failed to load');
    showToast('Connection error - please refresh', false);
    return;
  }

  // Initialize Supabase client
  _sb = window.supabase.createClient(
    'https://tticlvayaqrcblikbzmj.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR0aWNsdmF5YXFyY2JsaWtiem1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTM5ODUsImV4cCI6MjA5MDA2OTk4NX0.QFjJYhV-bNdohAYIOBd-NObMTnCv92V4PmXrmw2lJS4'
  );

  await initAuth();
  await refreshListings();
  if (currentUser) await loadSavedIds();
  if (currentUser) { await loadNotifications(); subscribeToNotifications(); }
  await handlePaymentReturn();

  // Deep link: ?listing=<id>
  const _dlParams = new URLSearchParams(window.location.search);
  const _dlId = _dlParams.get('listing');
  if (_dlId) {
    const _dlListing = sampleListings.find(x => String(x.id) === String(_dlId));
    if (_dlListing) openListing(_dlListing.id);
  }
});
