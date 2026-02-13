const midtransClient = require('midtrans-client');

class MidtransService {
  constructor() {
    this.snap = null;
  }

  getSnap() {
    if (this.snap) return this.snap;

    const serverKey = process.env.MIDTRANS_SERVER_KEY;
    if (!serverKey) {
      throw new Error('MIDTRANS_SERVER_KEY is required');
    }

    this.snap = new midtransClient.Snap({
      isProduction: process.env.MIDTRANS_IS_PRODUCTION === 'true',
      serverKey,
      clientKey: process.env.MIDTRANS_CLIENT_KEY || '',
    });

    return this.snap;
  }

  async createSnapToken({ orderId, grossAmount, itemDetails, customerDetails }) {
    const parameter = {
      transaction_details: {
        order_id: orderId,
        gross_amount: grossAmount,
      },
      item_details: itemDetails,
      customer_details: customerDetails,
    };

    return this.getSnap().createTransactionToken(parameter);
  }
}

module.exports = new MidtransService();
