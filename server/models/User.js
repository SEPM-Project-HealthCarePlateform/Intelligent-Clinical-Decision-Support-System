import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['Patient', 'Doctor', 'Admin'],
    default: 'Patient'
  },
  isVerified: { type: Boolean, default: false }, // For Dummy medical verification
  profilePicture: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('User', UserSchema);
