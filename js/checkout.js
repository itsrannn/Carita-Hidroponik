// js/checkout.js
// This script will handle the checkout process.
// It assumes 'supabase' is a global variable.

/**
 * Shows or hides the 'Profile Incomplete' modal.
 * @param {boolean} show True to show, false to hide.
 */
window.toggleProfileModal = (show) => {
  const modal = document.getElementById('profile-incomplete-modal');
  if (modal) {
    if (show) {
      modal.style.display = 'flex';
      setTimeout(() => modal.classList.add('show'), 10); // Delay for transition
    } else {
      modal.classList.remove('show');
      setTimeout(() => (modal.style.display = 'none'), 300); // Wait for transition to end
    }
  }
};

/**
 * Generates a unique order code.
 * Example: CH-20231115-A1B2
 * @returns {string} The unique order code.
 */
function generateOrderCode() {
  const date = new Date();
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CH-${year}${month}${day}-${randomPart}`;
}

/**
 * Checks if the user's profile is complete enough for checkout.
 * @returns {Promise<{complete: boolean, reason: string, profile: object|null}>}
 */
async function isProfileComplete() {
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session) {
    // If not logged in, we treat the profile as incomplete.
    return { complete: false, reason: 'Not logged in', profile: null };
  }

  const user = session.user;
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, phone_number, address, postal_code, province, regency, district, village, latitude, longitude')
    .eq('id', user.id)
    .single();

  if (error) {
    // This can happen if the profile hasn't been created yet.
    console.warn('Could not fetch profile:', error.message);
    return { complete: false, reason: 'Profile does not exist', profile: null };
  }

  // Check all required text fields.
  const requiredTextFields = ['full_name', 'phone_number', 'address', 'postal_code', 'province', 'regency', 'district', 'village'];
  for (const field of requiredTextFields) {
    if (!data[field] || String(data[field]).trim() === '') {
      console.log(`Profile incomplete. Missing field: ${field}`);
      return { complete: false, reason: `Missing field: ${field}`, profile: data };
    }
  }

  // Specifically check for valid coordinates.
  if (data.latitude == null || data.longitude == null || (data.latitude === 0 && data.longitude === 0)) {
    console.log('Profile incomplete. Missing map coordinates.');
    return { complete: false, reason: 'Missing map coordinates', profile: data };
  }

  return { complete: true, reason: 'Profile is complete', profile: data };
}

/**
 * Processes the checkout: creates an order in Supabase and clears the cart.
 * @param {object} profile The user's complete profile data.
 */
async function processCheckout(profile) {
  const cartStore = Alpine.store('cart');

  if (!cartStore || cartStore.items.length === 0) {
    window.showNotification('Keranjang belanja Anda kosong.', true);
    return;
  }

  // Use the reactive cart data from the Alpine store
  const cartDetails = cartStore.details;
  const cartTotal = cartStore.total;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert('Sesi tidak ditemukan. Silakan login kembali.');
    window.location.href = 'login page.html';
    return;
  }

  const orderCode = generateOrderCode();
  // Map the details from the cart store to the format needed for the database
  const orderDetails = cartDetails.map(item => ({
    product_id: item.id, // Use product_id for clarity
    name: item.name,
    quantity: item.quantity,
    price: item.price,
    subtotal: item.subtotal
  }));

  const shippingAddress = {
    full_name: profile.full_name,
    phone_number: profile.phone_number,
    address: profile.address,
    village: profile.village,
    district: profile.district,
    regency: profile.regency,
    province: profile.province,
    postal_code: profile.postal_code,
    latitude: profile.latitude,
    longitude: profile.longitude
  };

  const { error } = await supabase.from('orders').insert({
    user_id: user.id,
    order_code: orderCode,
    order_details: orderDetails,
    shipping_address: shippingAddress,
    total_amount: cartTotal,
    status: 'Menunggu Konfirmasi'
  });

  if (error) {
    console.error('Error creating order:', error);
    window.showNotification(`Terjadi kesalahan saat membuat pesanan: ${error.message}`, true);
    return;
  }

  // Clear the cart from localStorage and Alpine store
  localStorage.removeItem('cartItems');
  // Use the globally accessible Alpine object
  if (window.Alpine && Alpine.store('cart')) {
      Alpine.store('cart').clear(); // Use the clear method
  }


  window.showNotification(`Pesanan Anda dengan kode ${orderCode} berhasil dibuat!`);

  // Redirect after a short delay to allow the user to see the notification
  setTimeout(() => {
    window.location.href = 'order-history.html';
  }, 1500);
}


// --- Main Checkout Logic ---
document.addEventListener('DOMContentLoaded', () => {
  const checkoutBtn = document.getElementById('checkout-btn');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const modalOverlay = document.getElementById('profile-incomplete-modal');

  if (checkoutBtn) {
    checkoutBtn.addEventListener('click', async () => {
      // 1. Check if user is logged in
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        window.showNotification('Anda harus login untuk checkout.', true);
        // Redirect to login page after a delay
        setTimeout(() => {
          window.location.href = 'login page.html';
        }, 1500);
        return;
      }

      // 2. Check if profile is complete
      const { complete, profile } = await isProfileComplete();
      if (!complete) {
        // Show the modal if the profile is incomplete
        window.toggleProfileModal(true);
      } else {
        // Proceed to checkout if the profile is complete
        await processCheckout(profile);
      }
    });
  }

  // Logic to close the modal
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      window.toggleProfileModal(false);
    });
  }
  if (modalOverlay) {
    // Also close if the user clicks on the overlay background
    modalOverlay.addEventListener('click', (event) => {
      if (event.target === modalOverlay) {
        window.toggleProfileModal(false);
      }
    });
  }
});
