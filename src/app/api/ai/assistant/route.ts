import {
  buildAssistantSystemPrompt,
  DISCUSSION_JSON_REPAIR_SYSTEM_PROMPT,
  buildAssistantDiscussionUserPrompt,
  buildImplementationPlanUserPrompt,
  buildImplementationPlanSystemPrompt,
} from '@/lib/prompts'
import type {
  AssistantApiRequest,
  AssistantMessage,
  ChoiceQuestion,
} from '@/lib/ai/assistantTypes'
import {
  MODELS_WITHOUT_STRUCTURED_OUTPUTS,
  applyTokenLimit,
  extractResponseText,
  getAiEndpointConfig,
  getEndpointHost,
  isOpenAiEndpoint,
  isOpenRouterEndpoint,
  parseJsonContent,
  postToChatCompletions,
  type ChatCompletionResponse,
} from '@/lib/ai/chatCompletions'
import { generateDataModelFromAi } from '@/lib/ai/dataModelGeneration'
import { getSkillContextResult } from '@/lib/ai/skillContext'
import { getErrorMessage } from '@/lib/errors'

const MAX_MESSAGES = 12

const DISCUSSION_JSON_SCHEMA = {
  name: 'arkiv_discussion_response',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      messageMarkdown: {
        type: 'string',
        description: 'User-visible markdown response',
      },
      questions: {
        type: 'array',
        description: 'Click-to-select follow-up questions',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: {
              type: 'string',
              description: 'Short snake-case question identifier',
            },
            prompt: {
              type: 'string',
              description: 'Question prompt shown in the UI',
            },
            options: {
              type: 'array',
              description: 'Selectable options shown to the user',
              minItems: 2,
              maxItems: 5,
              items: {
                type: 'string',
              },
            },
          },
          required: ['id', 'prompt', 'options'],
        },
      },
      readyToBuild: {
        type: 'boolean',
        description: 'Whether schema generation should start immediately',
      },
    },
    required: ['messageMarkdown', 'questions', 'readyToBuild'],
  },
} as const

type StructuredDiscussionEnvelope = {
  messageMarkdown: string
  questions: ChoiceQuestion[]
  readyToBuild: boolean
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isAssistantMessage = (value: unknown): value is AssistantMessage => {
  if (!isRecord(value)) {
    return false
  }

  return (
    (value.role === 'user' || value.role === 'assistant') &&
    typeof value.content === 'string'
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

const normalizeConnectedWalletAddress = (value: unknown) => {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    return undefined
  }

  return trimmed.toLowerCase()
}

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

const normalizeChoiceQuestion = (value: unknown): ChoiceQuestion | null => {
  if (!isRecord(value)) return null

  const id = typeof value.id === 'string' ? value.id.trim() : ''
  const prompt = typeof value.prompt === 'string' ? value.prompt.trim() : ''

  if (!id || !prompt || !Array.isArray(value.options)) {
    return null
  }

  const seenOptions = new Set<string>()
  const options = value.options
    .filter((option): option is string => typeof option === 'string')
    .map((option) => option.trim())
    .filter((option) => option.length > 0)
    .filter((option) => {
      if (seenOptions.has(option)) {
        return false
      }

      seenOptions.add(option)
      return true
    })
    .slice(0, 5)

  if (options.length < 2) {
    return null
  }

  return {
    id,
    prompt,
    options,
  }
}

const normalizeDiscussionEnvelope = (value: unknown): StructuredDiscussionEnvelope => {
  if (!isRecord(value)) {
    throw new Error('The assistant discussion response was not a JSON object.')
  }

  const messageMarkdown =
    typeof value.messageMarkdown === 'string' ? value.messageMarkdown.trim() : ''

  if (!messageMarkdown) {
    throw new Error('The assistant discussion response did not include messageMarkdown.')
  }

  const questions = Array.isArray(value.questions)
    ? value.questions
        .map(normalizeChoiceQuestion)
        .filter((question): question is ChoiceQuestion => question !== null)
        .reduce<ChoiceQuestion[]>((accumulator, question) => {
          if (accumulator.some((existing) => existing.id === question.id)) {
            return accumulator
          }

          accumulator.push(question)
          return accumulator
        }, [])
        .slice(0, 3)
    : []

  const readyToBuild =
    typeof value.readyToBuild === 'boolean' ? value.readyToBuild && questions.length === 0 : false

  return {
    messageMarkdown,
    questions,
    readyToBuild,
  }
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

const postStructuredDiscussionCompletion = async ({
  endpointUrl,
  apiKey,
  model,
  systemPrompt,
  messages,
  useCase,
  requestId,
}: {
  endpointUrl: string
  apiKey: string
  model: string
  systemPrompt: string
  messages: AssistantMessage[]
  useCase: string
  requestId: string
}) => {
  const userPrompt = buildAssistantDiscussionUserPrompt({
    messages,
    useCase,
  })

  const supportsStructuredOutputs = !MODELS_WITHOUT_STRUCTURED_OUTPUTS.has(model)
  const openRouterEndpoint = isOpenRouterEndpoint(endpointUrl)
  const supportsCustomTemperature =
    !isOpenAiEndpoint(endpointUrl) || !model.startsWith('gpt-5')

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

  if (supportsCustomTemperature) {
    requestBody.temperature = supportsStructuredOutputs ? 0.2 : 0
  }

  applyTokenLimit({
    body: requestBody,
    endpointUrl,
    maxTokens: 1800,
  })

  if (supportsStructuredOutputs) {
    requestBody.response_format = {
      type: 'json_schema',
      json_schema: DISCUSSION_JSON_SCHEMA,
    }

    if (openRouterEndpoint) {
      requestBody.provider = {
        require_parameters: true,
      }
      requestBody.plugins = [{ id: 'response-healing' }]
    }
  }

  console.info('[ai:assistant] sending discussion request', {
    requestId,
    model,
    supportsStructuredOutputs,
    openRouterEndpoint,
    userPromptLength: userPrompt.length,
  })

  const upstreamResponse = await postToChatCompletions({
    endpointUrl,
    apiKey,
    body: requestBody,
  })
  const payload = (await upstreamResponse.json()) as ChatCompletionResponse

  console.info('[ai:assistant] discussion response received', {
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

  const content = extractResponseText(payload)
  const finishReason = payload.choices?.[0]?.finish_reason

  const parseAndNormalize = (rawContent: string) =>
    normalizeDiscussionEnvelope(parseJsonContent(rawContent))

  try {
    return parseAndNormalize(content)
  } catch (parseError) {
    console.warn('[ai:assistant] discussion parse failed', {
      requestId,
      finishReason,
      error: getErrorMessage(parseError, 'Unknown parse error.'),
    })

    if (finishReason === 'length') {
      throw new Error(
        'The assistant response was too large and got truncated. Please retry with a shorter follow-up.',
      )
    }

    const repairRequestBody: Record<string, unknown> = {
      model,
      messages: [
        {
          role: 'system',
          content: DISCUSSION_JSON_REPAIR_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: [
            `Original discussion prompt:\n${userPrompt}`,
            `Required schema:\n${JSON.stringify(DISCUSSION_JSON_SCHEMA.schema)}`,
            `Model output to repair:\n${content}`,
          ].join('\n\n'),
        },
      ],
    }

    if (supportsCustomTemperature) {
      repairRequestBody.temperature = 0
    }

    applyTokenLimit({
      body: repairRequestBody,
      endpointUrl,
      maxTokens: 1800,
    })

    const repairResponse = await postToChatCompletions({
      endpointUrl,
      apiKey,
      body: repairRequestBody,
    })
    const repairPayload = (await repairResponse.json()) as ChatCompletionResponse

    console.info('[ai:assistant] discussion repair response received', {
      requestId,
      status: repairResponse.status,
      ok: repairResponse.ok,
      upstreamError: repairPayload.error?.message,
      hasChoices: Boolean(repairPayload.choices?.length),
    })

    if (!repairResponse.ok) {
      throw new Error(
        repairPayload.error?.message ||
          `AI repair request failed with status ${repairResponse.status}.`,
      )
    }

    try {
      return parseAndNormalize(extractResponseText(repairPayload))
    } catch (repairParseError) {
      console.warn('[ai:assistant] discussion repair parse failed', {
        requestId,
        error: getErrorMessage(repairParseError, 'Unknown repair parse error.'),
      })

      return {
        messageMarkdown: content.trim() || 'Please share one more detail so I can continue.',
        questions: [],
        readyToBuild: false,
      }
    }
  }
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
  const connectedWalletAddress = normalizeConnectedWalletAddress(
    body.connectedWalletAddress,
  )

  console.info('[ai:assistant] parsed request body', {
    requestId,
    endpointHost: getEndpointHost(endpointUrl),
    model,
    mode,
    messageCount: messages.length,
    useCaseLength: useCase?.length ?? 0,
    hasCurrentModel: Boolean(body.currentModel),
    hasConnectedWalletAddress: Boolean(connectedWalletAddress),
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
    const skillContextResult = await getSkillContextResult()
    const skillContext = skillContextResult.context

    console.info('[ai:assistant] skill context loaded', {
      requestId,
      source: skillContextResult.source,
      contextLength: skillContext.length,
    })

    if (mode === 'generateSchema') {
      const { dataModel, generationTrace } = await generateDataModelFromAi({
        endpointUrl,
        apiKey,
        model,
        mode: body.schemaMode === 'edit' ? 'edit' : 'create',
        useCase,
        currentModel: body.currentModel,
        skillContext,
        requestId,
      })

      return Response.json({
        dataModel,
        ...(generationTrace ? { generationTrace } : {}),
        model,
      })
    }

    if (mode === 'generateImplementationPlan') {
      const plan = await postTextCompletion({
        endpointUrl,
        apiKey,
        model,
        systemPrompt: buildImplementationPlanSystemPrompt(skillContext),
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

    const discussion = await postStructuredDiscussionCompletion({
      endpointUrl,
      apiKey,
      model,
      systemPrompt: buildAssistantSystemPrompt(skillContext),
      messages,
      useCase,
      requestId,
    })

    return Response.json({
      message: discussion.messageMarkdown,
      readyToBuild: discussion.readyToBuild,
      questions: discussion.questions.length > 0 ? discussion.questions : undefined,
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
