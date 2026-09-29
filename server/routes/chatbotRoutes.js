import express from 'express';
import { protect } from '../middleware/auth.js';
import chatbotAgent from '../utils/chatbot/index.js';
import ChatbotMessage from '../models/ChatbotMessage.js';
import { encryptMessage, decryptMessage } from '../utils/cryptoHelper.js';

const router = express.Router();

// @desc    Get chatbot conversation history
// @route   GET /api/chatbot/history
router.get('/history', protect, async (req, res) => {
  try {
    const history = await ChatbotMessage.find({ user: req.user.userId }).sort({ timestamp: 1 });
    res.json({
      success: true,
      data: history
    });
  } catch (error) {
    console.error("❌ History fetch error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Clear chatbot conversation history
// @route   DELETE /api/chatbot/history
router.delete('/history', protect, async (req, res) => {
  try {
    await ChatbotMessage.deleteMany({ user: req.user.userId });
    res.json({
      success: true,
      message: "Chat history cleared successfully."
    });
  } catch (error) {
    console.error("❌ History clear error:", error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// @desc    Process chatbot message and files (LangGraph + Cohere)
// @route   POST /api/chatbot/message
router.post('/message', protect, async (req, res) => {
  // Set headers for Server-Sent Events (SSE) streaming
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Prevent proxy buffering in nginx/etc.

  const chatKey = req.user.userId;

  try {
    const { message, chatHistory, file, feedback } = req.body;

    // Decrypt incoming message
    const decryptedMessage = decryptMessage(message, chatKey);

    // 1. Save User's query/file directly to MongoDB Chatbot Message History (Encrypted)
    const userMsgContent = decryptedMessage?.trim() || (file ? `Uploaded file: ${file.name}` : "");
    if (userMsgContent || file) {
      await ChatbotMessage.create({
        user: req.user.userId,
        role: 'user',
        content: encryptMessage(userMsgContent || (file ? `Uploaded file: ${file.name}` : "Sent a file"), chatKey),
        file: file ? { name: file.name, type: file.type, size: file.size } : null
      });
    }

    // Format and decrypt chat history into standard messages list for state
    let messages = [];
    if (chatHistory && Array.isArray(chatHistory)) {
      messages = chatHistory.map(msg => ({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: decryptMessage(msg.content, chatKey)
      }));
    }

    // Append the new message if present
    if (decryptedMessage && decryptedMessage.trim()) {
      messages.push({
        role: 'user',
        content: decryptedMessage.trim()
      });
    }

    // Callback invoked by graph nodes as tokens generate - encrypt tokens before streaming
    const onToken = (tokenData) => {
      const encryptedTokenData = {
        ...tokenData,
        text: tokenData.text ? encryptMessage(tokenData.text, chatKey) : ""
      };
      res.write(`data: ${JSON.stringify(encryptedTokenData)}\n\n`);
    };

    // Prepare initial state for the LangGraph execution
    const initialState = {
      messages: messages,
      fileData: file || null,
      extractedMedicines: [],
      extractedLabTests: [],
      summary: "",
      isHealthTopic: true,
      retryFeedback: feedback || "",
      lastAgent: "",
      matchingDoctors: [],
      feedbackProcessed: false,
      onToken: onToken // Pass the callback to the graph state
    };

    console.log(`🤖 Invoking chatbotAgent (Streaming) for user: ${req.user.userId}.`);

    // Execute the State Graph
    const finalState = await chatbotAgent.invoke(initialState);

    // Get final bot response text
    const lastBotMessage = finalState.messages[finalState.messages.length - 1];
    const botReplyText = lastBotMessage ? lastBotMessage.content : "";

    // 2. Save complete Bot message to MongoDB Chatbot Message History (Encrypted)
    if (botReplyText && botReplyText.trim()) {
      await ChatbotMessage.create({
        user: req.user.userId,
        role: 'assistant',
        content: encryptMessage(botReplyText.trim(), chatKey),
        extractedMedicines: finalState.extractedMedicines || [],
        extractedLabTests: finalState.extractedLabTests || [],
        summary: finalState.summary || "",
        matchingDoctors: finalState.matchingDoctors || []
      });
    }

    // Send final payload with full extracted metadata (extracted medicines & summaries)
    res.write(`data: ${JSON.stringify({ 
      text: "", 
      extractedMedicines: finalState.extractedMedicines || [],
      extractedLabTests: finalState.extractedLabTests || [],
      summary: finalState.summary || "",
      matchingDoctors: finalState.matchingDoctors || [],
      isHealthTopic: finalState.isHealthTopic,
      isFinal: true
    })}\n\n`);

    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error("❌ Chatbot route error:", error);
    res.write(`data: ${JSON.stringify({ text: encryptMessage(`⚠️ An error occurred while processing your query: ${error.message}`, chatKey) })}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  }
});

export default router;
