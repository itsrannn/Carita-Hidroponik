/**
 * Controller for RajaOngkir API Proxy
 */

const RAJAONGKIR_API_KEY = process.env.RAJAONGKIR_API_KEY;
const RAJAONGKIR_BASE_URL = 'https://api.rajaongkir.com/starter';
const SHOP_ORIGIN_ID = '398'; // Kabupaten Serang

async function getProvinces(req, res) {
  try {
    const response = await fetch(`${RAJAONGKIR_BASE_URL}/province`, {
      headers: { 'key': RAJAONGKIR_API_KEY }
    });
    const data = await response.json();

    if (data.rajaongkir.status.code !== 200) {
      return res.status(data.rajaongkir.status.code).json({ message: data.rajaongkir.status.description });
    }

    return res.json(data.rajaongkir.results);
  } catch (error) {
    console.error('Error fetching provinces:', error);
    return res.status(500).json({ message: 'Internal server error fetching provinces.' });
  }
}

async function getCities(req, res) {
  const { provinceId } = req.params;
  try {
    const response = await fetch(`${RAJAONGKIR_BASE_URL}/city?province=${provinceId}`, {
      headers: { 'key': RAJAONGKIR_API_KEY }
    });
    const data = await response.json();

    if (data.rajaongkir.status.code !== 200) {
      return res.status(data.rajaongkir.status.code).json({ message: data.rajaongkir.status.description });
    }

    return res.json(data.rajaongkir.results);
  } catch (error) {
    console.error('Error fetching cities:', error);
    return res.status(500).json({ message: 'Internal server error fetching cities.' });
  }
}

async function calculateCost(req, res) {
  const { destination, weight, courier } = req.body;

  if (!destination || !weight || !courier) {
    return res.status(400).json({ message: 'Destination, weight, and courier are required.' });
  }

  try {
    const response = await fetch(`${RAJAONGKIR_BASE_URL}/cost`, {
      method: 'POST',
      headers: {
        'key': RAJAONGKIR_API_KEY,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        origin: SHOP_ORIGIN_ID,
        destination: destination,
        weight: weight,
        courier: courier
      })
    });

    const data = await response.json();

    if (data.rajaongkir.status.code !== 200) {
      return res.status(data.rajaongkir.status.code).json({ message: data.rajaongkir.status.description });
    }

    return res.json(data.rajaongkir.results[0]);
  } catch (error) {
    console.error('Error calculating cost:', error);
    return res.status(500).json({ message: 'Internal server error calculating shipping cost.' });
  }
}

module.exports = {
  getProvinces,
  getCities,
  calculateCost
};
