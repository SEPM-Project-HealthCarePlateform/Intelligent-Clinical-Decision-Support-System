import express from 'express';
import { protect, admin } from '../middleware/auth.js';
import User from '../models/User.js';
import DoctorProfile from '../models/DoctorProfile.js';
import PatientProfile from '../models/PatientProfile.js';

const router = express.Router();

// @desc    Get all unverified doctors
// @route   GET /api/admin/unverified-doctors
// @access  Private/Admin
router.get('/unverified-doctors', protect, admin, async (req, res) => {
  try {
    const unverifiedUsers = await User.find({ role: 'Doctor', isVerified: false }).select('-password');
    
    const unverifiedDoctors = [];
    for (const user of unverifiedUsers) {
      const profile = await DoctorProfile.findOne({ userId: user._id });
      unverifiedDoctors.push({
        user,
        profile: profile || {}
      });
    }

    res.json({ success: true, data: unverifiedDoctors });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Verify a doctor
// @route   PUT /api/admin/verify-doctor/:id
// @access  Private/Admin
router.put('/verify-doctor/:id', protect, admin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'Doctor') {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    user.isVerified = true;
    await user.save();

    const profile = await DoctorProfile.findOne({ userId: user._id });
    if (profile) {
      profile.verified = true;
      await profile.save();
    }

    res.json({ success: true, message: 'Doctor verified successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Mark a doctor as fraud (Convert to Patient)
// @route   PUT /api/admin/fraud-doctor/:id
// @access  Private/Admin
router.put('/fraud-doctor/:id', protect, admin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== 'Doctor') {
      return res.status(404).json({ success: false, message: 'Doctor not found' });
    }

    // Convert back to patient
    user.role = 'Patient';
    user.isVerified = false;
    await user.save();

    // Delete the pending doctor profile to prevent clutter
    await DoctorProfile.findOneAndDelete({ userId: user._id });

    // Initialize a patient profile so they can continue acting as a patient
    const existingPatientProfile = await PatientProfile.findOne({ userId: user._id });
    if (!existingPatientProfile) {
      const patientProfile = new PatientProfile({ userId: user._id });
      await patientProfile.save();
    }

    res.json({ success: true, message: 'Doctor marked as fraud and converted to Patient' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
