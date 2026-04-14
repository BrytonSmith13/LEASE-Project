// ---- STRIPE PAYMENTS ----

function getStripe() {
  if (!stripeInstance) stripeInstance = Stripe(STRIPE_PK);
  return stripeInstance;
}

// Handle redirect back from Stripe payment
async function handlePaymentReturn() {
  const params = new URLSearchParams(window.location.search);
  const payment = params.get('payment');

  if (payment === 'success') {
    const listingId = sessionStorage.getItem('paidListingId');
    if (listingId && typeof _sb !== 'undefined' && _sb) {
      await _sb.from('listings').update({ payment_paid: true }).eq('id', listingId);
    }
    sessionStorage.removeItem('paidListingId');
    showToast('🎉 Payment received! Your listing is live.', true);
    await refreshListings();
    window.history.replaceState({}, '', window.location.pathname);
  } else if (payment === 'cancelled') {
    showToast('Payment cancelled — your listing is still live but unpaid.', false);
    window.history.replaceState({}, '', window.location.pathname);
  }
}
