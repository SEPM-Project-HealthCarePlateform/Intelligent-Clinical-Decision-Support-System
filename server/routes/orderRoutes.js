import express from 'express';
import Order from '../models/Order.js';
import Cart from '../models/Cart.js';
import { protect } from '../middleware/auth.js';
import Razorpay from 'razorpay';
import crypto from 'crypto';

const router = express.Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_Sd7HXWLedK9qh5',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'iQDFb0ou7FKbi0xmuERWI6VQ'
});

// @desc    Create Razorpay Order for Cart Checkout
// @route   POST /api/orders/pay/create-order
router.post('/pay/create-order', protect, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user.userId }).populate('items.product');
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Your cart is empty.' });
    }

    let totalAmount = 0;
    cart.items.forEach(item => {
      const price = item.product?.price || 0;
      totalAmount += price * item.quantity;
    });

    if (totalAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid cart total amount.' });
    }

    const options = {
      amount: Math.round(totalAmount * 100), // in paise
      currency: 'INR',
      receipt: `receipt_cart_${Date.now()}`
    };

    const order = await razorpay.orders.create(options);

    res.status(201).json({
      success: true,
      keyId: process.env.RAZORPAY_KEY_ID,
      order
    });
  } catch (error) {
    console.error('Error creating Razorpay order for cart:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Place an order (verify payment & clear cart)
// @route   POST /api/orders
router.post('/', protect, async (req, res) => {
  try {
    const { items, totalAmount, address, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!items || items.length === 0 || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'All order and payment details are required.' });
    }

    // Cryptographic Signature Verification
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'iQDFb0ou7FKbi0xmuERWI6VQ')
      .update(body.toString())
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Payment verification failed. Invalid signature.' });
    }

    // Create the Order document (ONLY on payment success)
    const order = await Order.create({
      user: req.user.userId,
      items,
      totalAmount,
      address,
      paymentStatus: 'Completed',
      paymentId: razorpay_payment_id,
      status: 'Confirmed'
    });

    console.log('Order created successfully:', order._id);
    console.log('🧹 Clearing cart in database for user:', req.user.userId);

    // Delete the cart in database ONLY on payment success
    await Cart.findOneAndDelete({ user: req.user.userId });
    console.log('Cart deleted successfully');

    res.status(201).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get user orders
// @route   GET /api/orders
router.get('/', protect, async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.userId }).sort({ createdAt: -1 });
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
