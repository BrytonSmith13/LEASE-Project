// ---- STRIPE PAYMENTS ----

function getStripe() {
  if (!stripeInstance) stripeInstance = Stripe(STRIPE_PK);
  return stripeInstance;
}

// Called when user clicks Publish — intercepts and shows payment modal
function showListingPayment(listingData) {
  pendingListingData = listingData;
  document.getElementById('listing-fee-success').classList.remove('show');
  const btn = document.getElementById('pay-listing-btn');
  btn.textContent = '💳 Pay $10 & Publish';
  btn.disabled = false;
  openModal('payment-listing');
}

async function payListingFee() {
  if (!currentUser) { closeModal('payment-listing'); openModal('auth'); return; }

  // Insert listing into DB first (inactive until payment confirmed)
  const btn = document.getElementById('pay-listing-btn');
  btn.textContent = 'Saving…';
  btn.disabled = true;

  const result = await postListingToDB({ ...pendingListingData, is_active: false });
  if (!result) {
    btn.textContent = '💳 Pay $10 & Publish';
    btn.disabled = false;
    return;
  }

  // Store the listing ID so we can activate it on return from Stripe
  sessionStorage.setItem('paidListingId', result.id);
  window.location.href = 'https://buy.stripe.com/test_3cI9AV2zKcza1VcekC6kg00?client_reference_id=' + (currentUser.id || '');
}

// Show the 5% success fee modal for a transferred listing
function showSuccessFeeModal(listingId) {
  const l = sampleListings.find(x => String(x.id) === String(listingId));
  if (!l) return;
  pendingSuccessListingId = listingId;

  const rent = l.rent || 0;
  const utilities = l.utilities || 0;
  const internet = l.internet || 0;
  const other = 0;
  const total = rent + utilities + internet + other;
  const fee = (total * 0.05).toFixed(2);

  document.getElementById('sf-rent').textContent = '$' + rent.toLocaleString();
  document.getElementById('sf-utilities').textContent = utilities ? '$' + utilities : 'N/A';
  document.getElementById('sf-internet').textContent = internet ? '$' + internet : 'N/A';
  document.getElementById('sf-other').textContent = other ? '$' + other : 'N/A';
  document.getElementById('sf-total-monthly').textContent = '$' + total.toLocaleString();
  document.getElementById('sf-fee-amount').textContent = '$' + fee;
  document.getElementById('success-fee-success').classList.remove('show');

  const btn = document.getElementById('pay-success-btn');
  btn.textContent = '💳 Pay $' + fee + ' Success Fee';
  btn.disabled = false;

  openModal('payment-success');
}

async function paySuccessFee() {
  if (!currentUser) { closeModal('payment-success'); openModal('auth'); return; }
  const l = sampleListings.find(x => String(x.id) === String(pendingSuccessListingId));
  if (!l) return;
  const total = (l.rent || 0) + (l.utilities || 0) + (l.internet || 0);
  const fee = (total * 0.05).toFixed(2);
  sessionStorage.setItem('transferredListing', String(l.id));
  showToast('Redirecting to payment for $' + fee + '...', true);
  setTimeout(() => {
    window.location.href = 'https://buy.stripe.com/test_3cI9AV2zKcza1VcekC6kg00?client_reference_id=' + (currentUser.id || '') + '_transfer_' + l.id;
  }, 1000);
}

// Handle redirect back from Stripe payment
async function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get('payment');

  if (payment === 'success') {
    const listingId = sessionStorage.getItem('paidListingId');
    if (listingId && typeof _sb !== 'undefined' && _sb) {
      await _sb.from('listings').update({ is_active: true }).eq('id', listingId);
    }
    sessionStorage.removeItem('paidListingId');
    sessionStorage.removeItem('pendingListing');
    showToast('🎉 Payment complete! Your listing is live.', true);
    await refreshListings();
    window.history.replaceState({}, '', window.location.pathname);
  } else if (payment === 'transferred') {
    const listingId = params.get('listing');
    if (listingId && typeof _sb !== 'undefined' && _sb) {
      await _sb.from('listings').update({ is_active: false }).eq('id', listingId);
      await refreshListings();
      showToast('🎉 Lease marked as transferred!', true);
    }
    window.history.replaceState({}, '', '/');
  } else if (payment === 'cancelled') {
    showToast('Payment cancelled', false);
    window.history.replaceState({}, '', '/');
  }
}
