import { DATA_MODEL_JSON_SCHEMA } from '@/lib/ai/dataModelSchema'
import {
  JSON_REPAIR_SYSTEM_PROMPT,
  NON_STRUCTURED_OUTPUT_APPENDIX,
  SYSTEM_PROMPT,
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

export const generateDataModelFromAi = async ({
  endpointUrl,
  apiKey,
  model,
  mode,
  useCase,
  currentModel,
  requestId,
}: {
  endpointUrl: string
  apiKey: string
  model: string
  mode: DataModelGenerationMode
  useCase: string
  currentModel?: GeneratedDataModel
  requestId: string
}) => {
  const userPrompt = buildDataModelUserPrompt({
    mode,
    useCase,
    currentModel,
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
    maxTokens: 2800,
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

  console.info('[ai:data-model] sending upstream request', {
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

  console.info('[ai:data-model] upstream response received', {
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
  console.info('[ai:data-model] upstream content extracted', {
    requestId,
    contentLength: content.length,
  })

  let parsed: unknown

  try {
    parsed = parseJsonContent(content)
  } catch (parseError) {
    console.warn('[ai:data-model] initial JSON parse failed', {
      requestId,
      error: getErrorMessage(parseError, 'Unknown parse error.'),
      willAttemptRepair: !supportsStructuredOutputs,
    })

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
      maxTokens: 2800,
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

  const dataModel = normalizeGeneratedDataModel(parsed)
  console.info('[ai:data-model] model normalized', {
    requestId,
    modelTitle: dataModel.title,
    entityCount: dataModel.entities.length,
    relationCount: dataModel.relations.length,
  })

  return dataModel
}
