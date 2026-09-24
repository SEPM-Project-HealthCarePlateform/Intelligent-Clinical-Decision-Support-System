import { CohereClient } from 'cohere-ai';
import Tesseract from 'tesseract.js';
import dotenv from 'dotenv';

dotenv.config();

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY || 'YOUR_MOCK_KEY',
});

/**
 * Report Summarizer Node:
 * Handles OCR of lab reports, summarizes values, identifies high/low levels,
 * and incorporates human feedback/retries.
 */
export async function reportSummarizerNode(state) {
  const file = state.fileData;
  const feedback = state.retryFeedback;

  if (!file) {
    const errMsg = "Please upload a lab report to summarize.";
    if (state.onToken) state.onToken({ text: errMsg });
    return { messages: [{ role: "assistant", content: errMsg }] };
  }

  const isBase64 = file.content && file.content.startsWith('data:');
  let extractedText = isBase64 ? "" : (file.content || "");

  if (isBase64) {
    try {
      if (state.onToken) state.onToken({ text: "🔍 Reading lab report document image... " });
      console.log("🔍 Running OCR on base64 lab report...");
      const { data: { text } } = await Tesseract.recognize(file.content, 'eng');
      extractedText = text;
      console.log("✅ OCR extracted text:", extractedText.substring(0, 100) + "...");
    } catch (ocrErr) {
      console.error("❌ OCR Error:", ocrErr);
    }
  }

  try {
    let summaryPrompt = `
You are an experienced clinical doctor. Summarize this lab report in a patient-friendly manner:
File Name: ${file.name}
Report Data: 
---
${extractedText || "No readable text found."}
---`;

    if (feedback) {
      summaryPrompt += `\n\nCRITICAL USER FEEDBACK/CORRECTION:\n"${feedback}"\nApply this feedback to refine or correct the summary.`;
    }

    summaryPrompt += `

Explain all values, highlight abnormal levels (high/low), provide medical insights on what these could mean, and give supportive health advice. KEEP IT EXTREMELY SHORT AND CONCISE (MAX 3-4 BULLET POINTS). End with a brief medical disclaimer in bold italics.`;

    let fullText = "";

    if (state.onToken) {
      const stream = await cohere.chatStream({
        message: summaryPrompt,
        preamble: "You are an experienced, empathetic doctor who simplifies lab reports concisely."
      });

      for await (const chunk of stream) {
        if (chunk.eventType === "text-generation") {
          fullText += chunk.text;
          state.onToken({ text: chunk.text });
        }
      }
    } else {
      const response = await cohere.chat({
        message: summaryPrompt,
        preamble: "You are an experienced, empathetic doctor who simplifies lab reports concisely."
      });
      fullText = response.text;
    }

    const assistantMsg = {
      role: "assistant",
      content: fullText
    };

    return {
      summary: fullText,
      messages: [assistantMsg]
    };
  } catch (e) {
    console.error("❌ Error parsing lab report:", e);
    const errMsg = "I uploaded your lab report, but encountered an issue compiling the medical summary. Please try again or paste the report text.";
    if (state.onToken) {
      state.onToken({ text: errMsg });
    }
    return {
      summary: "Unable to process the lab report fully at this time.",
      messages: [{
        role: "assistant",
        content: errMsg
      }]
    };
  }
}
