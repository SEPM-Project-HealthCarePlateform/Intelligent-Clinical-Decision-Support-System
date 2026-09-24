import { StateGraph, START, END } from '@langchain/langgraph';
import { StateAnnotation } from './state.js';
import { orchestratorNode } from './orchestrator.js';
import { chatAgentNode } from './chatAgent.js';
import { doctorMatcherNode } from './doctorMatcher.js';
import { prescriptionAnalyserNode } from './prescriptionAnalyser.js';
import { reportSummarizerNode } from './reportSummarizer.js';
import { hitlNode } from './hitl.js';

// ----------------------------------------------------
// ROUTING FUNCTIONS
// ----------------------------------------------------

/**
 * Route from Orchestrator to the selected agent
 */
function routeFromOrchestrator(state) {
  const next = state.lastAgent;
  if (['chatAgent', 'doctorMatcher', 'prescriptionAnalyser', 'reportSummarizer'].includes(next)) {
    return next;
  }
  return 'chatAgent';
}

/**
 * Route from HITL node.
 * If retryFeedback is present, we route back to the respective agent to retry.
 * Otherwise, we stop (END).
 */
function routeFromHitl(state) {
  if (state.retryFeedback && state.retryFeedback.trim() !== '' && !state.feedbackProcessed) {
    console.log(`🔄 HITL: Retry feedback received. Routing back to ${state.lastAgent}`);
    return state.lastAgent;
  }
  console.log('🛑 HITL: No retry feedback or already processed. Routing to END.');
  return END;
}

// ----------------------------------------------------
// COMPILE THE LANGGRAPH
// ----------------------------------------------------
const workflow = new StateGraph(StateAnnotation);

// Add all nodes
workflow.addNode('orchestrator', orchestratorNode);
workflow.addNode('chatAgent', chatAgentNode);
workflow.addNode('doctorMatcher', doctorMatcherNode);
workflow.addNode('prescriptionAnalyser', prescriptionAnalyserNode);
workflow.addNode('reportSummarizer', reportSummarizerNode);
workflow.addNode('hitl', hitlNode);

// Define entry point
workflow.addEdge(START, 'orchestrator');

// Add conditional edges from Orchestrator
workflow.addConditionalEdges(
  'orchestrator',
  routeFromOrchestrator,
  {
    chatAgent: 'chatAgent',
    doctorMatcher: 'doctorMatcher',
    prescriptionAnalyser: 'prescriptionAnalyser',
    reportSummarizer: 'reportSummarizer'
  }
);

// Chat Agent goes directly to END
workflow.addEdge('chatAgent', END);

// Other agents go to the HITL checkpoint
workflow.addEdge('doctorMatcher', 'hitl');
workflow.addEdge('prescriptionAnalyser', 'hitl');
workflow.addEdge('reportSummarizer', 'hitl');

// HITL routes conditionally based on human feedback
workflow.addConditionalEdges(
  'hitl',
  routeFromHitl,
  {
    doctorMatcher: 'doctorMatcher',
    prescriptionAnalyser: 'prescriptionAnalyser',
    reportSummarizer: 'reportSummarizer',
    [END]: END
  }
);

const chatbotAgent = workflow.compile();

export default chatbotAgent;
