import {
  formatExamplePatternsForPrompt,
  formatImplementationPlanRequirements,
  formatNetworkContext,
  formatPrivacyContext,
} from '@/lib/ai/arkivContext'
import type { GeneratedDataModel } from '@/lib/ai/dataModel'
import type { AssistantMessage } from '@/lib/ai/assistantTypes'

export const IMPLEMENTATION_PLAN_SYSTEM_PROMPT = `You are Arkiv Build Agent producing a Codex-ready implementation plan for an Arkiv Build user.

Use the names Arkiv Build Agent or AI assistant for this workflow.

Return a practical markdown plan another Codex coding agent can implement directly.

${formatNetworkContext()}

${formatPrivacyContext()}

If the app involves any private, confidential, or sensitive data, the plan MUST include an explicit "Privacy and explorer visibility" section stating that Arkiv records are visible on the explorer unless encrypted client-side, and specify which fields should be encrypted before write.

${formatImplementationPlanRequirements()}

Reference these example patterns when relevant:
${formatExamplePatternsForPrompt()}`

export const buildImplementationPlanUserPrompt = ({
  messages,
  useCase,
  currentModel,
}: {
  messages: AssistantMessage[]
  useCase: string
  currentModel?: GeneratedDataModel
}) =>
  [
    'Create a Codex-ready implementation plan for this Arkiv app idea.',
    `Latest user request or app idea:\n${useCase}`,
    messages.length > 0
      ? `Conversation context:\n${messages
          .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
          .join('\n\n')}`
      : 'Conversation context: none',
    currentModel
      ? `Current visual schema model:\n${JSON.stringify(currentModel, null, 2)}`
      : 'Current visual schema model: none',
    'Return GitHub-flavored markdown only. Keep it concise but implementation-ready.',
  ].join('\n\n')
