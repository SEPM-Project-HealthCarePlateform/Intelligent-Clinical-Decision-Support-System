import mongoose from 'mongoose';

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  items: [
    {
      product: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'items.itemModel'
      },
      itemModel: {
        type: String,
        required: true,
        enum: ['Medicine', 'LabTest']
      },
      quantity: {
        type: Number,
        required: true,
        default: 1,
        min: 1
      }
    }
  ]
}, { timestamps: true });

export default mongoose.model('Cart', cartSchema);
