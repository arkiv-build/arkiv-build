import type { DataModelGenerationMode, GeneratedDataModel } from '@/lib/ai/dataModel'

export type AssistantMessageRole = 'user' | 'assistant'

export type ChoiceQuestion = {
  id: string
  prompt: string
  options: string[]
}

export type AssistantMessage = {
  id?: string
  role: AssistantMessageRole
  content: string
  questions?: ChoiceQuestion[]
}

export type AssistantRequestMode =
  | 'discussIdea'
  | 'generateSchema'
  | 'generateImplementationPlan'

export type AssistantDiscussionResponse = {
  message: string
  readyToBuild?: boolean
  questions?: ChoiceQuestion[]
  model?: string
  error?: string
}

export type AssistantSchemaResponse = {
  dataModel?: GeneratedDataModel
  model?: string
  error?: string
}

export type AssistantImplementationPlanResponse = {
  plan?: string
  model?: string
  error?: string
}

export type AssistantApiRequest = {
  mode?: AssistantRequestMode
  messages?: AssistantMessage[]
  useCase?: string
  currentModel?: GeneratedDataModel
  schemaMode?: DataModelGenerationMode
}
