import { DATA_MODEL_JSON_SCHEMA } from '@/lib/ai/dataModelSchema'
import {
  DATA_MODEL_EVALUATOR_SYSTEM_PROMPT,
  JSON_REPAIR_SYSTEM_PROMPT,
  NON_STRUCTURED_OUTPUT_APPENDIX,
  SYSTEM_PROMPT,
  buildDataModelEvaluatorUserPrompt,
  buildDataModelUserPrompt,
} from '@/lib/ai/dataModelPrompts'
import {
  MODELS_WITHOUT_STRUCTURED_OUTPUTS,
  applyTokenLimit,
  extractResponseText,
  isOpenAiEndpoint,
  isOpenRouterEndpoint,
  parseJsonContent,
  postToChatCompletions,
  type ChatCompletionResponse,
} from '@/lib/ai/chatCompletions'
import {
  normalizeGeneratedDataModel,
  type DataModelGenerationMode,
  type GeneratedDataModel,
} from '@/lib/ai/dataModel'
import { getErrorMessage } from '@/lib/errors'

const MAX_GENERATION_ATTEMPTS = 5

const DATA_MODEL_EVALUATION_JSON_SCHEMA = {
  name: 'arkiv_data_model_evaluation',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      accepted: {
        type: 'boolean',
      },
      criticalIssues: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
      suggestions: {
        type: 'array',
        items: {
          type: 'string',
        },
      },
      summary: {
        type: 'string',
      },
    },
    required: ['accepted', 'criticalIssues', 'suggestions', 'summary'],
  },
} as const

type DataModelEvaluation = {
  accepted: boolean
  criticalIssues: string[]
  suggestions: string[]
  summary: string
}

export type DataModelGenerationTraceAttempt = {
  attempt: number
  generatorPrompt: string
  candidateModel: GeneratedDataModel
  evaluatorResult?: DataModelEvaluation
}

export type DataModelGenerationTrace = {
  accepted: boolean
  finalAttempt: number
  attempts: DataModelGenerationTraceAttempt[]
}

export type DataModelGenerationResult = {
  dataModel: GeneratedDataModel
  generationTrace?: DataModelGenerationTrace
}

const normalizeEvaluation = (value: unknown): DataModelEvaluation => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Model evaluation response was not a JSON object.')
  }

  const record = value as Record<string, unknown>
  const accepted = Boolean(record.accepted)
  const criticalIssues = Array.isArray(record.criticalIssues)
    ? record.criticalIssues.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : []
  const suggestions = Array.isArray(record.suggestions)
    ? record.suggestions.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : []
  const summary = typeof record.summary === 'string' ? record.summary.trim() : ''

  return {
    accepted,
    criticalIssues,
    suggestions,
    summary,
  }
}

export const generateDataModelFromAi = async ({
  endpointUrl,
  apiKey,
  model,
  mode,
  useCase,
  currentModel,
  projectAttributeWalletPrefix,
  requestId,
}: {
  endpointUrl: string
  apiKey: string
  model: string
  mode: DataModelGenerationMode
  useCase: string
  currentModel?: GeneratedDataModel
  projectAttributeWalletPrefix?: string
  requestId: string
}): Promise<DataModelGenerationResult> => {
  const baseUserPrompt = buildDataModelUserPrompt({
    mode,
    useCase,
    currentModel,
    projectAttributeWalletPrefix,
  })
  const supportsStructuredOutputs = !MODELS_WITHOUT_STRUCTURED_OUTPUTS.has(model)
  const openRouterEndpoint = isOpenRouterEndpoint(endpointUrl)
  const supportsCustomTemperature =
    !isOpenAiEndpoint(endpointUrl) || !model.startsWith('gpt-5')
  const generateCandidate = async (userPrompt: string) => {
    const requestBody: Record<string, unknown> = {
      model,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: supportsStructuredOutputs
            ? userPrompt
            : `${userPrompt}\n\n${NON_STRUCTURED_OUTPUT_APPENDIX}`,
        },
      ],
    }

    if (supportsCustomTemperature) {
      requestBody.temperature = supportsStructuredOutputs ? 0.2 : 0
    }

    applyTokenLimit({
      body: requestBody,
      endpointUrl,
      maxTokens: 6000,
    })

    if (supportsStructuredOutputs) {
      requestBody.response_format = {
        type: 'json_schema',
        json_schema: DATA_MODEL_JSON_SCHEMA,
      }

      if (openRouterEndpoint) {
        requestBody.provider = {
          require_parameters: true,
        }
        requestBody.plugins = [{ id: 'response-healing' }]
      }
    }

    console.info('[ai:data-model] sending upstream generation request', {
      requestId,
      model,
      supportsStructuredOutputs,
      supportsCustomTemperature,
      openRouterEndpoint,
      messageCount: 2,
      userPromptLength: userPrompt.length,
    })

    const upstreamResponse = await postToChatCompletions({
      endpointUrl,
      apiKey,
      body: requestBody,
    })

    const payload = (await upstreamResponse.json()) as ChatCompletionResponse

    console.info('[ai:data-model] upstream generation response received', {
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
    console.info('[ai:data-model] generation content extracted', {
      requestId,
      contentLength: content.length,
      finishReason,
    })

    let parsed: unknown

    try {
      parsed = parseJsonContent(content)
    } catch (parseError) {
      console.warn('[ai:data-model] initial generation JSON parse failed', {
        requestId,
        error: getErrorMessage(parseError, 'Unknown parse error.'),
        finishReason,
        willAttemptRepair: !supportsStructuredOutputs,
      })

      if (finishReason === 'length') {
        throw new Error(
          'The schema response was too large and got truncated. Try simplifying the use case or splitting it into smaller pieces.',
        )
      }

      if (supportsStructuredOutputs) {
        throw parseError
      }

      const repairRequestBody: Record<string, unknown> = {
        model,
        messages: [
          {
            role: 'system',
            content: JSON_REPAIR_SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              `Original modeling prompt:\n${userPrompt}`,
              `Schema requirements:\n${JSON.stringify(DATA_MODEL_JSON_SCHEMA.schema)}`,
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
        maxTokens: 6000,
      })

      const repairResponse = await postToChatCompletions({
        endpointUrl,
        apiKey,
        body: repairRequestBody,
      })
      const repairPayload = (await repairResponse.json()) as ChatCompletionResponse

      console.info('[ai:data-model] repair response received', {
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

      parsed = parseJsonContent(extractResponseText(repairPayload))
    }

    return normalizeGeneratedDataModel(parsed)
  }

  const evaluateCandidate = async (candidateModel: GeneratedDataModel) => {
    const evaluatorUserPrompt = buildDataModelEvaluatorUserPrompt({
      mode,
      useCase,
      currentModel,
      candidateModel,
      projectAttributeWalletPrefix,
    })

    const requestBody: Record<string, unknown> = {
      model,
      messages: [
        {
          role: 'system',
          content: DATA_MODEL_EVALUATOR_SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: supportsStructuredOutputs
            ? evaluatorUserPrompt
            : `${evaluatorUserPrompt}\n\n${NON_STRUCTURED_OUTPUT_APPENDIX}`,
        },
      ],
    }

    if (supportsCustomTemperature) {
      requestBody.temperature = 0
    }

    applyTokenLimit({
      body: requestBody,
      endpointUrl,
      maxTokens: 2500,
    })

    if (supportsStructuredOutputs) {
      requestBody.response_format = {
        type: 'json_schema',
        json_schema: DATA_MODEL_EVALUATION_JSON_SCHEMA,
      }
    }

    const response = await postToChatCompletions({
      endpointUrl,
      apiKey,
      body: requestBody,
    })
    const payload = (await response.json()) as ChatCompletionResponse

    if (!response.ok) {
      throw new Error(
        payload.error?.message ||
          `Evaluator request failed with status ${response.status}.`,
      )
    }

    const parsed = parseJsonContent(extractResponseText(payload))
    return normalizeEvaluation(parsed)
  }

  const includeGenerationTrace = process.env.NODE_ENV === 'development'
  const traceAttempts: DataModelGenerationTraceAttempt[] = []
  let feedbackForRetry = ''
  let lastCandidate: GeneratedDataModel | undefined

  for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const attemptPrompt = feedbackForRetry
      ? [
          baseUserPrompt,
          'Evaluator feedback from previous attempt. You MUST resolve all items below in the next model:',
          feedbackForRetry,
        ].join('\n\n')
      : baseUserPrompt

    const candidate = await generateCandidate(attemptPrompt)
    lastCandidate = candidate
    if (includeGenerationTrace) {
      traceAttempts.push({
        attempt,
        generatorPrompt: attemptPrompt,
        candidateModel: candidate,
      })
    }

    let evaluation: DataModelEvaluation | null = null
    try {
      evaluation = await evaluateCandidate(candidate)
    } catch (evaluationError) {
      console.warn('[ai:data-model] evaluator failed, accepting latest candidate', {
        requestId,
        attempt,
        error: getErrorMessage(evaluationError, 'Unknown evaluator error.'),
      })
      return {
        dataModel: candidate,
        ...(includeGenerationTrace
          ? {
              generationTrace: {
                accepted: true,
                finalAttempt: attempt,
                attempts: traceAttempts,
              },
            }
          : {}),
      }
    }

    if (includeGenerationTrace) {
      const traceAttempt = traceAttempts[traceAttempts.length - 1]
      if (traceAttempt) {
        traceAttempt.evaluatorResult = evaluation
      }
    }

    console.info('[ai:data-model] evaluator result', {
      requestId,
      attempt,
      accepted: evaluation.accepted,
      issueCount: evaluation.criticalIssues.length,
      suggestionCount: evaluation.suggestions.length,
    })

    if (evaluation.accepted) {
      return {
        dataModel: candidate,
        ...(includeGenerationTrace
          ? {
              generationTrace: {
                accepted: true,
                finalAttempt: attempt,
                attempts: traceAttempts,
              },
            }
          : {}),
      }
    }

    feedbackForRetry = [
      evaluation.summary ? `Summary: ${evaluation.summary}` : '',
      ...evaluation.criticalIssues.map((issue, index) => `Critical ${index + 1}: ${issue}`),
      ...evaluation.suggestions.map((suggestion, index) => `Suggestion ${index + 1}: ${suggestion}`),
    ]
      .filter(Boolean)
      .join('\n')
  }

  if (!lastCandidate) {
    throw new Error('Failed to generate a data model candidate.')
  }

  console.warn('[ai:data-model] returning last candidate after evaluator retries', {
    requestId,
    attempts: MAX_GENERATION_ATTEMPTS,
  })

  return {
    dataModel: lastCandidate,
    ...(includeGenerationTrace
      ? {
          generationTrace: {
            accepted: false,
            finalAttempt: MAX_GENERATION_ATTEMPTS,
            attempts: traceAttempts,
          },
        }
      : {}),
  }
}
