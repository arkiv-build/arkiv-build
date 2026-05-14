import 'server-only'

import {
  buildAssistantSystemPrompt,
  DISCUSSION_JSON_REPAIR_SYSTEM_PROMPT,
  buildAssistantDiscussionUserPrompt,
} from '@/lib/prompts/assistant'
import {
  DATA_MODEL_EVALUATOR_SYSTEM_PROMPT,
  JSON_REPAIR_SYSTEM_PROMPT,
  NON_STRUCTURED_OUTPUT_APPENDIX,
  SYSTEM_PROMPT,
  buildDataModelSystemPrompt,
  buildDataModelEvaluatorUserPrompt,
  buildDataModelUserPrompt,
} from '@/lib/prompts/dataModel'
import {
  buildImplementationPlanSystemPrompt,
  buildImplementationPlanUserPrompt,
} from '@/lib/prompts/implementationPlan'

export {
  buildAssistantSystemPrompt,
  DATA_MODEL_EVALUATOR_SYSTEM_PROMPT,
  DISCUSSION_JSON_REPAIR_SYSTEM_PROMPT,
  buildImplementationPlanSystemPrompt,
  JSON_REPAIR_SYSTEM_PROMPT,
  NON_STRUCTURED_OUTPUT_APPENDIX,
  SYSTEM_PROMPT,
  buildAssistantDiscussionUserPrompt,
  buildDataModelSystemPrompt,
  buildDataModelEvaluatorUserPrompt,
  buildDataModelUserPrompt,
  buildImplementationPlanUserPrompt,
}

export const SYSTEM_PROMPTS = {
  assistantDiscussion: buildAssistantSystemPrompt,
  assistantDiscussionJsonRepair: DISCUSSION_JSON_REPAIR_SYSTEM_PROMPT,
  dataModelGenerator: buildDataModelSystemPrompt,
  dataModelJsonRepair: JSON_REPAIR_SYSTEM_PROMPT,
  dataModelEvaluator: DATA_MODEL_EVALUATOR_SYSTEM_PROMPT,
  implementationPlan: buildImplementationPlanSystemPrompt,
} as const

export const PROMPT_TEMPLATES = {
  assistantDiscussionUser: buildAssistantDiscussionUserPrompt,
  dataModelUser: buildDataModelUserPrompt,
  dataModelEvaluatorUser: buildDataModelEvaluatorUserPrompt,
  implementationPlanUser: buildImplementationPlanUserPrompt,
} as const

export type SystemPromptKey = keyof typeof SYSTEM_PROMPTS
export type PromptTemplateKey = keyof typeof PROMPT_TEMPLATES
