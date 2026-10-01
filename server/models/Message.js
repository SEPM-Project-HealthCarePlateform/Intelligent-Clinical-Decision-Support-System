import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  content: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  roomId: { type: String, required: true }, // Can be appointmentId or composite of user IDs
  detectedSpecialization: { type: String }, // e.g., 'Cardiologist'
  assignedDoctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // The doctor assigned to respond
  isSubscriptionChat: { type: Boolean, default: false } // True for platform health chat
});

export default mongoose.model('Message', MessageSchema);
