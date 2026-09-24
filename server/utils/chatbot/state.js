import { Annotation } from '@langchain/langgraph';

export const StateAnnotation = Annotation.Root({
  messages: Annotation({
    reducer: (x, y) => (x || []).concat(y || []),
    default: () => []
  }),
  fileData: Annotation({
    reducer: (x, y) => y !== undefined ? y : x,
    default: () => null
  }),
  extractedMedicines: Annotation({
    reducer: (x, y) => y !== undefined ? y : x,
    default: () => []
  }),
  extractedLabTests: Annotation({
    reducer: (x, y) => y !== undefined ? y : x,
    default: () => []
  }),
  summary: Annotation({
    reducer: (x, y) => y !== undefined ? y : x,
    default: () => ""
  }),
  isHealthTopic: Annotation({
    reducer: (x, y) => y !== undefined ? y : x,
    default: () => true
  }),
  retryFeedback: Annotation({
    reducer: (x, y) => y !== undefined ? y : x,
    default: () => ""
  }),
  lastAgent: Annotation({
    reducer: (x, y) => y !== undefined ? y : x,
    default: () => ""
  }),
  matchingDoctors: Annotation({
    reducer: (x, y) => y !== undefined ? y : x,
    default: () => []
  }),
  feedbackProcessed: Annotation({
    reducer: (x, y) => y !== undefined ? y : x,
    default: () => false
  }),
  onToken: Annotation({
    reducer: (x, y) => y !== undefined ? y : x,
    default: () => null
  })
});
