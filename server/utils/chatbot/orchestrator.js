import { CohereClient } from 'cohere-ai';
import dotenv from 'dotenv';

dotenv.config();

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY || 'YOUR_MOCK_KEY',
});

/**
 * Orchestrator Node:
 * Classifies the incoming message or file to decide which specialized agent handles it.
 */
export async function orchestratorNode(state) {
  const lastMessage = state.messages[state.messages.length - 1];
  const query = lastMessage ? lastMessage.content : "";
  const queryLower = query.toLowerCase();
  const file = state.fileData;

  // 1. File Upload Routing (highest priority)
  if (file) {
    const fileNameLower = file.name.toLowerCase();
    const isLabReport = fileNameLower.includes('report') ||
      fileNameLower.includes('lab') ||
      fileNameLower.includes('cbc') ||
      fileNameLower.includes('lipid') ||
      fileNameLower.includes('test') ||
      queryLower.includes('report') ||
      queryLower.includes('summarize');

    if (isLabReport) {
      return { lastAgent: 'reportSummarizer' };
    } else {
      return { lastAgent: 'prescriptionAnalyser' };
    }
  }

  // 2. Retry / Feedback Routing
  if (state.retryFeedback && state.lastAgent) {
    return { lastAgent: state.lastAgent };
  }

  // 3. Smart Keyword Routing (Fast & Deterministic)
  // Doctor Matching Keywords
  const doctorKeywords = [
    'doctor', 'symptom', 'cardiologist', 'dermatologist', 'physician', 
    'pediatrician', 'consult', 'match', 'fever', 'headache', 'cough', 
    'pain', 'rash', 'hurt', 'sick', 'specialist', 'appointment'
  ];
  if (doctorKeywords.some(keyword => queryLower.includes(keyword))) {
    return { lastAgent: 'doctorMatcher' };
  }

  // Prescription Analyser Keywords
  const prescriptionKeywords = [
    'prescription', 'medicine', 'medication', 'pill', 'tablet', 
    'capsule', 'order medicine', 'drug', 'pharmacy'
  ];
  if (prescriptionKeywords.some(keyword => queryLower.includes(keyword))) {
    return { lastAgent: 'prescriptionAnalyser' };
  }

  // Lab Report Keywords
  const reportKeywords = [
    'report', 'lab', 'cbc', 'lipid', 'test results', 'blood test', 
    'summarize report', 'diagnostic'
  ];
  if (reportKeywords.some(keyword => queryLower.includes(keyword))) {
    return { lastAgent: 'reportSummarizer' };
  }

  // 4. LLM Classifier Fallback
  if (!process.env.COHERE_API_KEY) {
    return { lastAgent: 'chatAgent' };
  }

  try {
    const classificationPrompt = `
You are a medical chatbot router. Classify the user query into one of these 4 exact categories:
- doctorMatcher (if user wants a doctor, specialist recommendation, or describes physical symptoms)
- prescriptionAnalyser (if user mentions ordering medicines or analyzing prescriptions)
- reportSummarizer (if user wants to summarize lab/medical test reports)
- chatAgent (if it is general health advice, general knowledge, greetings, or chit-chat)

User Query: "${query}"

Respond with ONLY the category name.`;

    const response = await cohere.chat({
      message: classificationPrompt,
      preamble: "You are a precise classifier. Respond ONLY with doctorMatcher, prescriptionAnalyser, reportSummarizer, or chatAgent.",
    });

    const responseText = response.text.trim().toLowerCase();
    
    if (responseText.includes('doctormatcher')) {
      return { lastAgent: 'doctorMatcher' };
    }
    if (responseText.includes('prescriptionanalyser')) {
      return { lastAgent: 'prescriptionAnalyser' };
    }
    if (responseText.includes('reportsummarizer')) {
      return { lastAgent: 'reportSummarizer' };
    }
    
    return { lastAgent: 'chatAgent' };
  } catch (error) {
    console.error("❌ Error in orchestrator node LLM fallback:", error);
    return { lastAgent: 'chatAgent' };
  }
}
