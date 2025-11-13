// js/checkout.js
// This script will handle the checkout process.
// It assumes 'supabase' is a global variable.

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
    console.error('Error getting session:', sessionError);
    return { complete: false, reason: 'Not logged in', profile: null };
  }

  const user = session.user;
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, phone_number, address, postal_code, province, regency, district, village, latitude, longitude')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching profile:', error);
    return { complete: false, reason: 'Profile does not exist', profile: null };
  }

  const requiredFields = ['full_name', 'phone_number', 'address', 'postal_code', 'province', 'regency', 'district', 'village'];
  for (const field of requiredFields) {
    if (!data[field] || String(data[field]).trim() === '') {
      return { complete: false, reason: `Missing field: ${field}`, profile: null };
    }
  }

  return { complete: true, reason: 'Profile is complete', profile: data };
}

/**
 * Processes the checkout: creates an order in Supabase and clears the cart.
 * @param {object} profile The user's complete profile data.
 */
async function processCheckout(profile) {
  const cartItems = JSON.parse(localStorage.getItem('cartItems')) || [];
  const cartTotal = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  if (cartItems.length === 0) {
    alert('Keranjang belanja Anda kosong.');
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    alert('Sesi tidak ditemukan. Silakan login kembali.');
    window.location.href = 'login page.html';
    return;
  }

  const orderCode = generateOrderCode();
  const orderDetails = cartItems.map(item => ({
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    price: item.price
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
    alert(`Terjadi kesalahan saat membuat pesanan: ${error.message}`);
    return;
  }

  // Clear the cart from localStorage and Alpine store
  localStorage.removeItem('cartItems');
  const cartStore = Alpine.store('cart');
  if (cartStore) {
    cartStore.items = [];
    cartStore.updateTotalsAndSave();
  }

  alert(`Pesanan Anda dengan kode ${orderCode} berhasil dibuat!`);
  window.location.href = 'order-history.html'; // Redirect to the new order history page
}
