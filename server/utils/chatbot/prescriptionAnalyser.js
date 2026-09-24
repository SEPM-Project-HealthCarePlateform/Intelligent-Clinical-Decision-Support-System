import { CohereClient } from 'cohere-ai';
import Tesseract from 'tesseract.js';
import dotenv from 'dotenv';
import { matchMedicinesInDatabase, matchLabTestsInDatabase } from './helpers.js';

dotenv.config();

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY || 'YOUR_MOCK_KEY',
});

/**
 * Prescription Analyser Node:
 * Extracts medicine details from prescription attachments, applies retry feedback,
 * maps them to inventory database items, and formats the output.
 */
export async function prescriptionAnalyserNode(state) {
  const file = state.fileData;
  const feedback = state.retryFeedback;

  if (!file) {
    const errMsg = "Please attach a prescription file to analyze.";
    if (state.onToken) state.onToken({ text: errMsg });
    return { messages: [{ role: "assistant", content: errMsg }] };
  }

  const isBase64 = file.content && file.content.startsWith('data:');
  let extractedText = isBase64 ? "" : (file.content || "");

  if (isBase64) {
    try {
      if (state.onToken) state.onToken({ text: "🔍 Reading prescription document image... " });
      console.log("🔍 Running OCR on base64 prescription...");
      const { data: { text } } = await Tesseract.recognize(file.content, 'eng');
      extractedText = text;
      console.log("✅ OCR extracted text:", extractedText.substring(0, 100) + "...");
    } catch (ocrErr) {
      console.error("❌ OCR Error:", ocrErr);
    }
  }

  try {
    let matchedMeds = [];

    let extractionPrompt = `
You are a highly precise medical data extraction system. Extract all prescription medicines and recommended lab tests listed in this document or text.
File Name: ${file.name}
Prescription content:
---
${extractedText || "No readable text found."}
---`;

    if (feedback) {
      extractionPrompt += `\n\nCRITICAL USER FEEDBACK FOR CORRECTION:\n"${feedback}"\nApply this feedback to correct the extraction.`;
    }

    extractionPrompt += `
Extract the medicines and lab tests and return them ONLY as a valid JSON object.
Do not write any preamble, explanation, or notes outside the JSON object.
If no medicines or lab tests are found, return empty arrays.

IMPORTANT RULES:
- ONLY extract items explicitly mentioned in the content. Do NOT guess or invent.
- CALCULATE QUANTITY CORRECTLY for medicines: Analyze dosage and duration. For example, "1 tablet twice a day for 5 days" = quantity 10.
- For lab tests, extract the exact name of the test.

The JSON object MUST have exactly these two arrays:
1. "medicines": Array of objects. Each object MUST have:
   - "name": Exact medicine name
   - "dosage": Dosage details
   - "quantity": Total integer quantity
2. "labTests": Array of objects. Each object MUST have:
   - "name": Exact lab test name

Format:
{
  "medicines": [
    { "name": "MedicineName", "dosage": "Dosage details", "quantity": 10 }
  ],
  "labTests": [
    { "name": "TestName" }
  ]
}`;

    const response = await cohere.chat({
      message: extractionPrompt,
      preamble: "You are a strict JSON-only extractor. Respond ONLY with a valid JSON object and nothing else."
    });

    // Clean the response text to find the JSON object
    let rawText = response.text.trim();
    const startIdx = rawText.indexOf('{');
    const endIdx = rawText.lastIndexOf('}');
    
    let parsedData = { medicines: [], labTests: [] };
    if (startIdx !== -1 && endIdx !== -1) {
      const jsonStr = rawText.substring(startIdx, endIdx + 1);
      try {
        parsedData = JSON.parse(jsonStr);
      } catch (err) {
        console.error("❌ JSON parse error from LLM extraction response:", err);
      }
    }

    matchedMeds = [];
    let matchedTests = [];

    if (parsedData.medicines && parsedData.medicines.length > 0) {
      matchedMeds = await matchMedicinesInDatabase(parsedData.medicines);
    }
    if (parsedData.labTests && parsedData.labTests.length > 0) {
      matchedTests = await matchLabTestsInDatabase(parsedData.labTests);
    }

    let replyContent = "";
    if (matchedMeds.length === 0 && matchedTests.length === 0) {
      replyContent = "The file is not clear enough to extract medicines or lab tests. Please upload a clearer copy or verify the text.";
    } else {
      let medsContent = "";
      if (matchedMeds.length > 0) {
        const availableMeds = matchedMeds.filter(m => !m.unmatched).map(m => `• **${m.name}** (Brand: ${m.brand || "Generics"}, Price: ₹${m.price}/pack)`).join("\n");
        const unavailableMeds = matchedMeds.filter(m => m.unmatched).map(m => `• **${m.name}** (Not stocked in local pharmacy)`).join("\n");
        medsContent = `
📋 **All Extracted Medicines:**
${matchedMeds.map(m => `- ${m.name} (${m.description || "dosage unspecified"})`).join("\n")}

✅ **Available in Pharmacy (Can be ordered):**
${availableMeds || "• *None of the extracted medicines are currently available.*"}

⚠️ **Unavailable Items (Out of stock/Not stocked):**
${unavailableMeds || "• *All items are available in our pharmacy!*"}
`;
      }

      let testsContent = "";
      if (matchedTests.length > 0) {
        const availableTests = matchedTests.filter(m => !m.unmatched).map(m => `• **${m.name}** (Price: ₹${m.price})`).join("\n");
        const unavailableTests = matchedTests.filter(m => m.unmatched).map(m => `• **${m.name}** (Not available in local lab)`).join("\n");
        testsContent = `
🧪 **All Extracted Lab Tests:**
${matchedTests.map(m => `- ${m.name}`).join("\n")}

✅ **Available for Booking:**
${availableTests || "• *None of the extracted lab tests are currently available.*"}

⚠️ **Unavailable Lab Tests:**
${unavailableTests || "• *All lab tests are available for booking!*"}
`;
      }

      replyContent = `📝 **Prescription Summary:**
I have successfully analyzed your prescription.
${medsContent}${testsContent}
You can add the available items directly to your cart below, retry the extraction with new feedback, or cancel to clear the parsing results.`;
    }

    if (state.onToken) {
      state.onToken({ 
        text: replyContent, 
        extractedMedicines: matchedMeds,
        extractedLabTests: matchedTests
      });
    }

    const assistantMsg = {
      role: "assistant",
      content: replyContent,
      extractedMedicines: matchedMeds,
      extractedLabTests: matchedTests
    };

    return {
      extractedMedicines: matchedMeds,
      extractedLabTests: matchedTests,
      messages: [assistantMsg]
    };
  } catch (e) {
    console.error("❌ Error parsing prescription:", e);
    const errMsg = "I had trouble parsing the prescription. Let's try again. Please ensure the prescription text is clear.";
    if (state.onToken) {
      state.onToken({ text: errMsg });
    }
    return {
      messages: [{
        role: "assistant",
        content: errMsg
      }]
    };
  }
}
