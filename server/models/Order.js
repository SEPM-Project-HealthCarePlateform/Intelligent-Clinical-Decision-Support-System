import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  items: [
    {
      name: String,
      price: Number,
      quantity: Number,
      itemType: { type: String, enum: ['Medicine', 'LabTest'] }
    }
  ],
  totalAmount: { type: Number, required: true },
  status: { type: String, default: 'Pending' },
  address: { type: String },
  paymentStatus: { type: String, default: 'Pending' },
  paymentId: { type: String }
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);
