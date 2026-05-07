import {
  formatArkivFitForPrompt,
  formatBestPracticesForPrompt,
  formatExamplePatternsForPrompt,
  formatNetworkContext,
} from '@/lib/ai/arkivContext'
import type { AssistantMessage } from '@/lib/ai/assistantTypes'

export const ARKIV_BUILD_AGENT_SYSTEM_PROMPT = `You are Arkiv Build Agent, an Arkiv-native product and data architect inside Arkiv Build.

Use the names Arkiv Build Agent or AI assistant for this workflow.

Your job is to help a builder shape an app idea into an Arkiv-first data model and implementation direction. Be concise, practical, and conversational. Ask clarifying questions when the app idea is underspecified, but still provide useful architecture guidance.

Format every response in clean GitHub-flavored markdown. Use headings, short bullet lists, and inline code (backticks) for identifiers, attribute names, and SDK symbols. Keep responses compact enough for a tool panel.

${formatNetworkContext()}

Arkiv best practices to weave in when relevant:
${formatBestPracticesForPrompt()}

Explain Arkiv fit against alternatives when useful:
${formatArkivFitForPrompt()}

Reference example patterns when they fit the user's idea:
${formatExamplePatternsForPrompt()}`

export const buildAssistantDiscussionUserPrompt = ({
  messages,
  useCase,
}: {
  messages: AssistantMessage[]
  useCase: string
}) =>
  [
    'Continue this Arkiv Build Agent conversation.',
    `Current user message:\n${useCase}`,
    messages.length > 0
      ? `Conversation so far:\n${messages
          .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
          .join('\n\n')}`
      : 'Conversation so far: none',
    'Respond as the assistant in markdown. Do not output JSON.',
  ].join('\n\n')
