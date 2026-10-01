import mongoose from 'mongoose';

const ChatbotMessageSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  role: { type: String, required: true, enum: ['user', 'assistant', 'bot'] },
  content: { type: String, required: true },
  file: {
    name: { type: String },
    type: { type: String },
    size: { type: String }
  },
  extractedMedicines: [{
    name: String,
    description: String,
    price: Number,
    productId: { type: String, default: null },
    brand: String,
    category: String,
    prescribedTablets: Number,
    tabletsPerPacket: Number,
    quantity: Number,
    unmatched: { type: Boolean, default: false }
  }],
  extractedLabTests: [{
    name: String,
    description: String,
    price: Number,
    productId: { type: String, default: null },
    brand: String,
    category: String,
    quantity: Number,
    unmatched: { type: Boolean, default: false }
  }],
  summary: String,
  matchingDoctors: [{
    id: String,
    userId: String,
    name: String,
    specialization: String,
    experience: Number,
    rating: Number,
    fee: Number,
    degree: String,
    bio: String
  }],
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model('ChatbotMessage', ChatbotMessageSchema);
