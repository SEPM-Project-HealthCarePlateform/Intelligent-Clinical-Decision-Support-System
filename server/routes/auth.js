import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';
import User from '../models/User.js';
import DoctorProfile from '../models/DoctorProfile.js';
import PatientProfile from '../models/PatientProfile.js';
import Otp from '../models/Otp.js';
import admin from '../utils/firebaseAdmin.js';

const router = express.Router();

// Setup Nodemailer Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can use other services as well
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Send OTP Route for Signup
router.post('/send-signup-otp', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email || !name) {
      return res.status(400).json({ success: false, message: "Email and name are required" });
    }

    const user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    // Generate 6-digit OTP
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Remove any existing OTP for this email
    await Otp.deleteMany({ email });

    // Save new OTP
    const otpData = new Otp({ email, otp: otpCode });
    await otpData.save();

    // Send Email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Verify your heAlthI account',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to heAlthI, ${name}!</h2>
          <p>Please use the following OTP to complete your signup process. This OTP is valid for 10 minutes.</p>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold; border-radius: 5px;">
            ${otpCode}
          </div>
          <p>If you did not request this, please ignore this email.</p>
        </div>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ success: true, message: "OTP sent successfully" });
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json({ success: false, message: "Failed to send OTP email" });
  }
});

// Signup Route (Verify OTP and Create User)
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, role, otp } = req.body;

    if (!name || !email || !password || !role || !otp) {
      return res.status(400).json({ success: false, message: "All fields including OTP are required" });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }

    // Verify OTP
    const validOtp = await Otp.findOne({ email, otp });
    if (!validOtp) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    // Delete the OTP after successful verification
    await Otp.deleteMany({ email });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      name,
      email,
      password: hashedPassword,
      role
    });

    await user.save();

    // Auto-initialize profile document in separate collection based on role
    let effectiveRole = user.role;
    if (user.role === 'Doctor') {
      const doctorProfile = new DoctorProfile({
        userId: user._id,
        specialization: 'General Physician',
        degree: 'M.B.B.S.',
        experience: 5,
        consultationFee: 500,
        bio: 'Dedicated healthcare professional providing comprehensive medical services.',
        availability: [
          { day: 'Mon', slots: ['10:00 AM - 4:00 PM'] },
          { day: 'Tue', slots: ['10:00 AM - 4:00 PM'] },
          { day: 'Wed', slots: ['10:00 AM - 4:00 PM'] },
          { day: 'Thu', slots: ['10:00 AM - 4:00 PM'] },
          { day: 'Fri', slots: ['10:00 AM - 4:00 PM'] }
        ],
        verified: false,
        hasFilledProfile: false
      });
      await doctorProfile.save();
      // An unverified doctor acts as a patient initially
      effectiveRole = 'Patient';
    } else if (user.role === 'Patient') {
      const patientProfile = new PatientProfile({ userId: user._id });
      await patientProfile.save();
    }

    const token = jwt.sign(
      { userId: user._id, role: effectiveRole },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: effectiveRole,
          profilePicture: user.profilePicture || ''
        }
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Login Route
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ success: false, message: "User doesn't exist. Please sign up." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid credentials" });
    }

    // A doctor cannot login as a Doctor until verified; they must act as a Patient.
    let effectiveRole = user.role;
    if (user.role === 'Doctor' && !user.isVerified) {
      effectiveRole = 'Patient';
    }

    const token = jwt.sign(
      { userId: user._id, role: effectiveRole },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: effectiveRole,
          profilePicture: user.profilePicture || ''
        }
      }
    });

  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Google Login Route
router.post('/google-login', async (req, res) => {
  try {
    const { idToken, role = 'Patient' } = req.body;

    if (!idToken) {
      return res.status(400).json({ success: false, message: "Firebase ID Token is required" });
    }

    // 1. Verify token with Firebase
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { email, name, picture } = decodedToken;

    // 2. Check if user exists in your MongoDB
    let user = await User.findOne({ email });

    let effectiveRole = role;

    // 3. If new user, create them in MongoDB
    if (!user) {
      // If no role provided by frontend, ask them for it
      if (!role) {
        return res.status(202).json({ success: true, requireRole: true, message: "Please select a role to complete registration." });
      }

      user = new User({
        name,
        email,
        password: Math.random().toString(36).slice(-10), // Random password since Google handles auth
        role: role,
        isVerified: role === 'Patient' ? true : false, 
        profilePicture: picture || ''
      });
      await user.save();

      // Auto-initialize profile document
      if (user.role === 'Doctor') {
        const doctorProfile = new DoctorProfile({
          userId: user._id,
          specialization: 'General Physician',
          degree: 'M.B.B.S.',
          experience: 5,
          consultationFee: 500,
          verified: false,
          hasFilledProfile: false
        });
        await doctorProfile.save();
        
        // Also create a patient profile for the doctor
        const patientProfile = new PatientProfile({ userId: user._id });
        await patientProfile.save();
        
        effectiveRole = 'Patient'; // Unverified doctors act as patients
      } else {
        const patientProfile = new PatientProfile({ userId: user._id });
        await patientProfile.save();
      }
    } else {
       // Existing user logic for effective role
       effectiveRole = user.role;
       if (user.role === 'Doctor' && !user.isVerified) {
         effectiveRole = 'Patient';
       }
    }

    // 4. Generate App JWT
    const token = jwt.sign(
      { userId: user._id, role: effectiveRole },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: effectiveRole,
          profilePicture: user.profilePicture || ''
        }
      }
    });

  } catch (error) {
    console.error("Firebase Auth Error:", error);
    res.status(401).json({ success: false, message: error.message || 'Unauthorized / Invalid Firebase Token' });
  }
});

// Forgot Password - Send OTP
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'No account found with this email' });

    // Generate 6-digit OTP (reusing existing Otp model)
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.deleteMany({ email });
    await new Otp({ email, otp: otpCode }).save();

    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Reset your heAlthI password',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hi ${user.name}, we received a request to reset your password. Use the OTP below. It is valid for 10 minutes.</p>
          <div style="background-color: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold; border-radius: 5px;">
            ${otpCode}
          </div>
          <p>If you did not request a password reset, please ignore this email.</p>
        </div>
      `,
    });

    res.status(200).json({ success: true, message: 'Password reset OTP sent to your email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Failed to send reset email' });
  }
});

// Reset Password - Verify OTP and set new password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const validOtp = await Otp.findOne({ email, otp });
    if (!validOtp) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await User.updateOne({ email }, { password: hashedPassword });
    await Otp.deleteMany({ email });

    res.status(200).json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Failed to reset password' });
  }
});

export default router;
