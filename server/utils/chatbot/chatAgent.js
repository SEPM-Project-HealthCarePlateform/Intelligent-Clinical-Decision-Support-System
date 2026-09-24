import { CohereClient } from 'cohere-ai';
import dotenv from 'dotenv';

dotenv.config();

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY || 'YOUR_MOCK_KEY',
});

/**
 * Chat Agent Node:
 * Answers general health queries, chit-chat, and basic wellness questions.
 */
export async function chatAgentNode(state) {
  const history = state.messages || [];
  
  // Format history for Cohere chat
  const chatHistory = history.slice(0, -1).map(msg => ({
    role: msg.role === 'user' ? 'USER' : 'CHATBOT',
    message: msg.content
  }));

  const lastUserMsg = history[history.length - 1]?.content || "";

  try {
    const preamble = "You are an experienced, warm, and highly knowledgeable medical assistant. Answer the patient's general health inquiries, wellness questions, or common medical facts in a supportive, professional, and clear manner. KEEP YOUR ANSWERS EXTREMELY SHORT, CONCISE, AND TO THE POINT (MAX 2-3 SENTENCES). Always end with a very brief one-sentence medical disclaimer in bold italics.";
    let fullText = "";

    if (state.onToken) {
      const stream = await cohere.chatStream({
        chatHistory: chatHistory,
        message: lastUserMsg,
        preamble: preamble
      });

      for await (const chunk of stream) {
        if (chunk.eventType === "text-generation") {
          fullText += chunk.text;
          state.onToken({ text: chunk.text });
        }
      }
    } else {
      const response = await cohere.chat({
        chatHistory: chatHistory,
        message: lastUserMsg,
        preamble: preamble
      });
      fullText = response.text;
    }

    const assistantMsg = {
      role: "assistant",
      content: fullText
    };

    return { messages: [assistantMsg] };
  } catch (error) {
    console.error("❌ Error in chat agent node:", error);
    const errText = "I apologize, but I am having trouble connecting to my database. How else can I help today?";
    if (state.onToken) {
      state.onToken({ text: errText });
    }
    return {
      messages: [{
        role: "assistant",
        content: errText
      }]
    };
  }
}
