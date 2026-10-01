import mongoose from 'mongoose';

const AppointmentSchema = new mongoose.Schema({
  patientId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  originalBookingDate: { type: Date }, // Anchor for the 6-day reschedule window — set once, never updated
  timeSlot: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['Pending', 'Confirmed', 'Postponed', 'Completed', 'Cancelled', 'Missed'], 
    default: 'Pending' 
  },
  paymentStatus: { 
    type: String, 
    enum: ['Pending', 'Completed', 'Failed'], 
    default: 'Pending' 
  },
  paymentId: { type: String }, // Razorpay Payment ID
  rescheduleHistory: [
    {
      originalDate: Date,
      originalTimeSlot: String,
      rescheduledAt: { type: Date, default: Date.now },
      reason: String
    }
  ],
  doctorRequestedReschedule: { type: Boolean, default: false },
  queuePosition: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Appointment', AppointmentSchema);
