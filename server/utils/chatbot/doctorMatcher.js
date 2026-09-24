import { CohereClient } from 'cohere-ai';
import dotenv from 'dotenv';
import DoctorProfile from '../../models/DoctorProfile.js';
import User from '../../models/User.js';

dotenv.config();

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY || 'YOUR_MOCK_KEY',
});

/**
 * Doctor Matcher Node:
 * Identifies the patient's symptoms, maps them to a medical specialization, 
 * queries verified doctors from the database, and presents the best matches.
 */
export async function doctorMatcherNode(state) {
  const history = state.messages || [];
  const lastUserMsg = history[history.length - 1]?.content || "";
  const feedback = state.retryFeedback;

  try {
    // 1. Fetch all verified doctors with filled profiles
    const doctors = await DoctorProfile.find({ verified: true }).populate('userId');
    const validDoctors = doctors.filter(doc => doc.userId && doc.userId.role === 'Doctor');

    // Create a list of available doctors for the LLM context
    const doctorsContext = validDoctors.map(doc => ({
      name: doc.userId.name,
      specialization: doc.specialization,
      experience: doc.experience,
      rating: doc.rating,
      fee: doc.consultationFee,
      bio: doc.bio
    }));

    // 2. Draft the match prompt
    let prompt = `
You are a medical triage assistant. Match the patient's symptoms to the most suitable doctors.

Available Doctors in our clinic:
${JSON.stringify(doctorsContext, null, 2)}

Patient's Symptoms/Request: "${lastUserMsg}"
`;

    if (feedback) {
      prompt += `\n\nCRITICAL PATIENT FEEDBACK/CORRECTION:\n"${feedback}"\nApply this feedback to find/adjust the doctor selection.`;
    }

    prompt += `
Recommend the best specialization and select the matching doctors from the available list.
Format your output in a beautiful, warm, patient-friendly manner.
1. Start with a short analysis of the symptoms (1-2 sentences).
2. Clearly recommend a specific specialization.
3. List the recommended doctor(s) name, fee, rating, and brief bio.
Keep the response extremely short, professional, and clear.
End with a brief one-sentence disclaimer in bold italics: "Always consult a healthcare professional in case of emergencies."`;

    let fullText = "";

    if (state.onToken) {
      const stream = await cohere.chatStream({
        message: prompt,
        preamble: "You are an expert medical triage coordinator matching patients with doctors."
      });

      for await (const chunk of stream) {
        if (chunk.eventType === "text-generation") {
          fullText += chunk.text;
          state.onToken({ text: chunk.text });
        }
      }
    } else {
      const response = await cohere.chat({
        message: prompt,
        preamble: "You are an expert medical triage coordinator matching patients with doctors."
      });
      fullText = response.text;
    }

    const assistantMsg = {
      role: "assistant",
      content: fullText
    };

    // Filter which doctors are recommended based on names/specializations in Cohere output
    const recommendedDocs = validDoctors.filter(doc => {
      const nameClean = (doc.userId?.name || "").toLowerCase().replace("dr. ", "").trim();
      const spec = (doc.specialization || "").toLowerCase().trim();
      return (nameClean && fullText.toLowerCase().includes(nameClean)) || 
             (spec && fullText.toLowerCase().includes(spec));
    }).map(doc => ({
      id: doc._id.toString(),
      userId: doc.userId?._id?.toString(),
      name: doc.userId?.name,
      specialization: doc.specialization,
      experience: doc.experience,
      rating: doc.rating,
      fee: doc.consultationFee,
      degree: doc.degree,
      bio: doc.bio
    }));

    return { 
      messages: [assistantMsg],
      matchingDoctors: recommendedDocs
    };
  } catch (error) {
    console.error("❌ Error in doctorMatcher node:", error);
    const errText = "I encountered an issue matching you with our doctors. Please try describing your symptoms again.";
    if (state.onToken) {
      state.onToken({ text: errText });
    }
    return {
      messages: [{
        role: "assistant",
        content: errText
      }],
      matchingDoctors: []
    };
  }
}
