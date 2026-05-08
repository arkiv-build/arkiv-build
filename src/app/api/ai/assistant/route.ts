import {
  ARKIV_BUILD_AGENT_SYSTEM_PROMPT,
  buildAssistantDiscussionUserPrompt,
} from '@/lib/ai/assistantPrompts'
import type { AssistantApiRequest, AssistantMessage } from '@/lib/ai/assistantTypes'
import { extractBuildSentinel, extractOptionsBlock } from '@/lib/ai/sentinels'
import {
  applyTokenLimit,
  extractResponseText,
  getAiEndpointConfig,
  getEndpointHost,
  isOpenAiEndpoint,
  postToChatCompletions,
  type ChatCompletionResponse,
} from '@/lib/ai/chatCompletions'
import { generateDataModelFromAi } from '@/lib/ai/dataModelGeneration'
import {
  IMPLEMENTATION_PLAN_SYSTEM_PROMPT,
  buildImplementationPlanUserPrompt,
} from '@/lib/ai/implementationPlanPrompts'
import { getErrorMessage } from '@/lib/errors'

const MAX_MESSAGES = 12

const isAssistantMessage = (value: unknown): value is AssistantMessage => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }

  const maybeMessage = value as Partial<AssistantMessage>

  return (
    (maybeMessage.role === 'user' || maybeMessage.role === 'assistant') &&
    typeof maybeMessage.content === 'string'
  )
}

const normalizeMessages = (messages: unknown) =>
  Array.isArray(messages)
    ? messages
        .filter(isAssistantMessage)
        .slice(-MAX_MESSAGES)
        .map((message) => ({
          role: message.role,
          content: message.content.trim(),
        }))
        .filter((message) => message.content.length > 0)
    : []

const getLatestUserText = ({
  useCase,
  messages,
}: {
  useCase?: string
  messages: AssistantMessage[]
}) => {
  const trimmedUseCase = useCase?.trim()

  if (trimmedUseCase) {
    return trimmedUseCase
  }

  return [...messages].reverse().find((message) => message.role === 'user')?.content.trim()
}

const postTextCompletion = async ({
  endpointUrl,
  apiKey,
  model,
  systemPrompt,
  userPrompt,
  requestId,
  maxTokens,
}: {
  endpointUrl: string
  apiKey: string
  model: string
  systemPrompt: string
  userPrompt: string
  requestId: string
  maxTokens: number
}) => {
  const requestBody: Record<string, unknown> = {
    model,
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: userPrompt,
      },
    ],
  }

  if (!isOpenAiEndpoint(endpointUrl) || !model.startsWith('gpt-5')) {
    requestBody.temperature = 0.3
  }

  applyTokenLimit({
    body: requestBody,
    endpointUrl,
    maxTokens,
  })

  console.info('[ai:assistant] sending upstream request', {
    requestId,
    model,
    maxTokens,
    userPromptLength: userPrompt.length,
  })

  const upstreamResponse = await postToChatCompletions({
    endpointUrl,
    apiKey,
    body: requestBody,
  })
  const payload = (await upstreamResponse.json()) as ChatCompletionResponse

  console.info('[ai:assistant] upstream response received', {
    requestId,
    status: upstreamResponse.status,
    ok: upstreamResponse.ok,
    upstreamError: payload.error?.message,
    hasChoices: Boolean(payload.choices?.length),
  })

  if (!upstreamResponse.ok) {
    throw new Error(
      payload.error?.message ||
        `AI request failed with status ${upstreamResponse.status}.`,
    )
  }

  return extractResponseText(payload).trim()
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  const { endpointUrl, apiKey, model } = getAiEndpointConfig()

  console.info('[ai:assistant] request received', { requestId })

  if (!endpointUrl) {
    return Response.json(
      {
        error: 'Missing AI_CHAT_COMPLETIONS_URL. Set it to a Chat Completions-compatible endpoint before using Arkiv Build Agent.',
      },
      { status: 500 },
    )
  }

  if (!apiKey) {
    return Response.json(
      {
        error: 'Missing AI_API_KEY. Add it to your environment before using Arkiv Build Agent.',
      },
      { status: 500 },
    )
  }

  if (!model) {
    return Response.json(
      {
        error: 'Missing AI_MODEL. Set it in your environment before using Arkiv Build Agent.',
      },
      { status: 500 },
    )
  }

  const body = (await request.json()) as AssistantApiRequest
  const mode = body.mode
  const messages = normalizeMessages(body.messages)
  const useCase = getLatestUserText({ useCase: body.useCase, messages })

  console.info('[ai:assistant] parsed request body', {
    requestId,
    endpointHost: getEndpointHost(endpointUrl),
    model,
    mode,
    messageCount: messages.length,
    useCaseLength: useCase?.length ?? 0,
    hasCurrentModel: Boolean(body.currentModel),
  })

  if (
    mode !== 'discussIdea' &&
    mode !== 'generateSchema' &&
    mode !== 'generateImplementationPlan'
  ) {
    return Response.json({ error: 'Unsupported assistant mode.' }, { status: 400 })
  }

  if (!useCase) {
    return Response.json({ error: 'Describe the app idea first.' }, { status: 400 })
  }

  try {
    if (mode === 'generateSchema') {
      const dataModel = await generateDataModelFromAi({
        endpointUrl,
        apiKey,
        model,
        mode: body.schemaMode === 'edit' ? 'edit' : 'create',
        useCase,
        currentModel: body.currentModel,
        requestId,
      })

      return Response.json({
        dataModel,
        model,
      })
    }

    if (mode === 'generateImplementationPlan') {
      const plan = await postTextCompletion({
        endpointUrl,
        apiKey,
        model,
        systemPrompt: IMPLEMENTATION_PLAN_SYSTEM_PROMPT,
        userPrompt: buildImplementationPlanUserPrompt({
          messages,
          useCase,
          currentModel: body.currentModel,
        }),
        requestId,
        maxTokens: 3600,
      })

      return Response.json({
        plan,
        model,
      })
    }

    const rawMessage = await postTextCompletion({
      endpointUrl,
      apiKey,
      model,
      systemPrompt: ARKIV_BUILD_AGENT_SYSTEM_PROMPT,
      userPrompt: buildAssistantDiscussionUserPrompt({
        messages,
        useCase,
      }),
      requestId,
      maxTokens: 1200,
    })

    const optionsResult = extractOptionsBlock(rawMessage)
    const buildResult = extractBuildSentinel(optionsResult.stripped)

    const hasOpenQuestions = optionsResult.questions.length > 0
    const readyToBuild = buildResult.readyToBuild && !hasOpenQuestions

    return Response.json({
      message: buildResult.stripped,
      readyToBuild,
      questions: hasOpenQuestions ? optionsResult.questions : undefined,
      model,
    })
  } catch (error) {
    console.error('[ai:assistant] request failed', {
      requestId,
      error: getErrorMessage(error, 'Assistant request failed.'),
    })

    return Response.json(
      {
        error: getErrorMessage(error, 'Assistant request failed.'),
      },
      { status: 502 },
    )
  }
}
