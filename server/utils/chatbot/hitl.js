/**
 * HITL (Human-in-the-loop) Node:
 * Acts as a checkpoint/review gate before finalizing the agent response.
 * If the user (human) sends a correction (retryFeedback), we route the graph back to the respective agent.
 */
export async function hitlNode(state) {
  console.log(`👤 HITL Node reached. Current Agent: ${state.lastAgent || "None"}. Retry Feedback: ${state.retryFeedback ? `"${state.retryFeedback}"` : "None"}. Processed: ${state.feedbackProcessed}`);

  if (state.retryFeedback && !state.feedbackProcessed) {
    // Mark as processed so the subsequent pass doesn't loop infinitely
    return { feedbackProcessed: true };
  }

  // If already processed, clear the feedback to stop the loop
  return { retryFeedback: "" };
}
