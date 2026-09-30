import express from 'express';
import mongoose from 'mongoose';
import { protect } from '../middleware/auth.js';
import Appointment from '../models/Appointment.js';
import Subscription from '../models/Subscription.js';
import Message from '../models/Message.js';
import User from '../models/User.js';
import DoctorProfile from '../models/DoctorProfile.js';
import PatientProfile from '../models/PatientProfile.js';

const router = express.Router();

// @desc    Get active chat rooms/connections for the logged-in user
// @route   GET /api/chat/rooms
router.get('/rooms', protect, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const roomsMap = new Map();

    if (user.role === 'Patient') {
      // 1. Check for Active Platform Subscription
      await Subscription.updateMany(
        { status: 'Active', endDate: { $lt: new Date() } },
        { $set: { status: 'Expired' } }
      );

      const activeSubscription = await Subscription.findOne({
        patientId: userId,
        planType: 'Platform',
        status: 'Active',
        endDate: { $gt: new Date() }
      });

      if (activeSubscription) {
        // Find all unique specialization rooms patient has already chatted in
        const existingSubRooms = await Message.find({
          isSubscriptionChat: true,
          roomId: new RegExp(`^sub_chat_${userId}_`)
        }).distinct('roomId');

        for (const rId of existingSubRooms) {
          const spec = rId.split('_')[3] || 'General Physician';
          roomsMap.set(rId, {
            partner: {
              _id: 'system_health_chat',
              name: `Health Chat - ${spec}`,
              role: 'System',
              specialization: spec,
              bio: `Smart chat that routes your queries to the right specialist based on your symptoms.`,
            },
            specialization: spec,
            type: 'Subscription',
            endDate: activeSubscription.endDate,
            roomId: rId
          });
        }
      }

      // 2. Get doctors with confirmed appointments
      const confirmedAppointments = await Appointment.find({
        patientId: userId,
        status: 'Confirmed'
      }).populate('doctorId', 'name email role');

      for (const apt of confirmedAppointments) {
        if (apt.doctorId) {
          const docIdStr = apt.doctorId._id.toString();
          const roomId = `chat_${userId}_${docIdStr}`;
          
          if (!roomsMap.has(roomId)) {
            const docProfile = await DoctorProfile.findOne({ userId: apt.doctorId._id });
            roomsMap.set(roomId, {
              partner: {
                _id: apt.doctorId._id,
                name: apt.doctorId.name,
                email: apt.doctorId.email,
                role: apt.doctorId.role,
                specialization: docProfile?.specialization || 'Specialist',
                bio: docProfile?.bio || '',
                experience: docProfile?.experience || 0,
                consultationFee: docProfile?.consultationFee || 500,
                degree: docProfile?.degree || 'MBBS',
                rating: docProfile?.rating || 0,
              },
              type: 'Appointment',
              roomId: roomId
            });
          }
        }
      }

    } else if (user.role === 'Admin') {
      // Get all subscription chats
      const subMessages = await Message.find({ isSubscriptionChat: true })
        .populate('senderId', 'name email role')
        .populate('receiverId', 'name email role');

      for (const msg of subMessages) {
        const roomId = msg.roomId;
        if (!roomsMap.has(roomId)) {
          const parts = roomId.split('_');
          if (parts.length < 4) continue; // Skip old unpartitioned rooms
          const patientId = parts[2];
          const spec = parts[3] || msg.detectedSpecialization || 'General Physician';

          let patientUser = msg.senderId?.role === 'Patient' ? msg.senderId : 
                            (msg.receiverId?.role === 'Patient' ? msg.receiverId : null);
          
          if (!patientUser && mongoose.isValidObjectId(patientId)) {
            patientUser = await User.findById(patientId);
          }

          if (patientUser) {
            const patProfile = await PatientProfile.findOne({ userId: patientUser._id });
            roomsMap.set(roomId, {
              partner: {
                _id: patientUser._id,
                name: patientUser.name,
                email: patientUser.email,
                role: 'Patient',
                age: patProfile?.age || 'NA',
                height: patProfile?.height || 'NA',
                weight: patProfile?.weight || 'NA',
                disease: patProfile?.disease || 'NA',
                allergy: patProfile?.allergy || 'NA',
                history: patProfile?.medicalHistory || 'NA'
              },
              specialization: spec,
              type: 'Subscription',
              roomId: roomId
            });
          }
        }
      }
    } else if (user.role === 'Doctor') {
      // 1. Get patients from Subscription messages routed to this doctor
      // Find all distinct rooms where this doctor was assigned in a subscription chat
      const assignedMessages = await Message.find({
        assignedDoctorId: userId,
        isSubscriptionChat: true
      }).populate('senderId', 'name email role');

      // Add each unique patient room
      for (const msg of assignedMessages) {
        if (msg.senderId && msg.senderId.role === 'Patient') {
          const patIdStr = msg.senderId._id.toString();
          const roomId = msg.roomId; // sub_chat_{patientId}
          
          if (!roomsMap.has(roomId)) {
            const patProfile = await PatientProfile.findOne({ userId: msg.senderId._id });
            roomsMap.set(roomId, {
              partner: {
                _id: msg.senderId._id,
                name: msg.senderId.name,
                email: msg.senderId.email,
                role: msg.senderId.role,
                age: patProfile?.age || 'NA',
                height: patProfile?.height || 'NA',
                weight: patProfile?.weight || 'NA',
                disease: patProfile?.disease || 'NA',
                allergy: patProfile?.allergy || 'NA',
                history: patProfile?.medicalHistory || 'NA'
              },
              type: 'Subscription',
              roomId: roomId
            });
          }
        }
      }

      // 2. Get patients with confirmed appointments
      const confirmedAppointments = await Appointment.find({
        doctorId: userId,
        status: 'Confirmed'
      }).populate('patientId', 'name email role');

      for (const apt of confirmedAppointments) {
        if (apt.patientId) {
          const patIdStr = apt.patientId._id.toString();
          const roomId = `chat_${patIdStr}_${userId}`;
          
          if (!roomsMap.has(roomId)) {
            const patProfile = await PatientProfile.findOne({ userId: apt.patientId._id });
            roomsMap.set(roomId, {
              partner: {
                _id: apt.patientId._id,
                name: apt.patientId.name,
                email: apt.patientId.email,
                role: apt.patientId.role,
                age: patProfile?.age || 'NA',
                height: patProfile?.height || 'NA',
                weight: patProfile?.weight || 'NA',
                disease: patProfile?.disease || 'NA',
                allergy: patProfile?.allergy || 'NA',
                history: patProfile?.medicalHistory || 'NA'
              },
              type: 'Appointment',
              roomId: roomId
            });
          }
        }
      }
    }

    // Convert Map values to array
    const roomsList = Array.from(roomsMap.values());

    // Fetch the last message in each room to provide sidebar previews
    const results = [];
    for (const rm of roomsList) {
      const lastMessage = await Message.findOne({ roomId: rm.roomId })
        .sort({ timestamp: -1 })
        .select('content timestamp senderId');
      
      results.push({
        ...rm,
        lastMessage: lastMessage ? {
          content: lastMessage.content,
          timestamp: lastMessage.timestamp,
          senderId: lastMessage.senderId
        } : null
      });
    }

    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    console.error('Error fetching chat rooms:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Get message history for a specific room
// @route   GET /api/chat/messages/:roomId
router.get('/messages/:roomId', protect, async (req, res) => {
  try {
    const { roomId } = req.params;

    // Populate assignedDoctorId so the UI knows which doctor answered in the sub chat
    const messages = await Message.find({ roomId })
      .sort({ timestamp: 1 })
      .populate('senderId', 'name email role')
      .populate('assignedDoctorId', 'name email role');

    // Attach specialization info to populated assignedDoctorId if present
    const messagesWithSpec = [];
    for (let msg of messages) {
      const msgObj = msg.toObject();
      if (msgObj.assignedDoctorId) {
         const docProfile = await DoctorProfile.findOne({ userId: msgObj.assignedDoctorId._id });
         msgObj.assignedDoctorId.specialization = docProfile?.specialization || 'Specialist';
         msgObj.assignedDoctorId.bio = docProfile?.bio || '';
         msgObj.assignedDoctorId.experience = docProfile?.experience || 0;
         msgObj.assignedDoctorId.degree = docProfile?.degree || 'MBBS';
         msgObj.assignedDoctorId.consultationFee = docProfile?.consultationFee || 500;
         msgObj.assignedDoctorId.rating = docProfile?.rating || 0;
      }
      messagesWithSpec.push(msgObj);
    }

    res.json({
      success: true,
      data: messagesWithSpec
    });
  } catch (error) {
    console.error('Error fetching chat messages:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
