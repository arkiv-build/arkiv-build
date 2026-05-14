import {
  getAiEndpointConfig,
  getEndpointHost,
} from '@/lib/ai/chatCompletions'
import { generateDataModelFromAi } from '@/lib/ai/dataModelGeneration'
import { getSkillContextResult } from '@/lib/ai/skillContext'
import type { DataModelGenerationMode, GeneratedDataModel } from '@/lib/ai/dataModel'
import { getErrorMessage } from '@/lib/errors'

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()
  const { endpointUrl, apiKey, model } = getAiEndpointConfig()

  console.info('[ai:data-model] request received', { requestId })

  if (!endpointUrl) {
    console.warn('[ai:data-model] missing endpoint URL', { requestId })
    return Response.json(
      {
        error: 'Missing AI_CHAT_COMPLETIONS_URL. Set it to a Chat Completions compatible endpoint before generating a model.',
      },
      { status: 500 },
    )
  }

  if (!apiKey) {
    console.warn('[ai:data-model] missing API key', {
      requestId,
      endpointHost: getEndpointHost(endpointUrl),
    })
    return Response.json(
      {
        error: 'Missing AI_API_KEY. Add it to your environment before generating a model.',
      },
      { status: 500 },
    )
  }

  if (!model) {
    console.warn('[ai:data-model] missing model', {
      requestId,
      endpointHost: getEndpointHost(endpointUrl),
    })
    return Response.json(
      {
        error: 'Missing AI_MODEL. Set it in your environment before generating a model.',
      },
      { status: 500 },
    )
  }

  const body = (await request.json()) as {
    mode?: DataModelGenerationMode
    useCase?: string
    currentModel?: GeneratedDataModel
  }
  const mode = body.mode === 'edit' ? 'edit' : 'create'
  const useCase = body.useCase?.trim()
  const currentModel = body.currentModel

  console.info('[ai:data-model] parsed request body', {
    requestId,
    endpointHost: getEndpointHost(endpointUrl),
    model,
    mode,
    useCaseLength: useCase?.length ?? 0,
    hasCurrentModel: Boolean(currentModel),
    currentEntityCount: currentModel?.entities.length ?? 0,
    currentRelationCount: currentModel?.relations.length ?? 0,
  })

  if (!useCase) {
    console.warn('[ai:data-model] rejected empty use case', { requestId })
    return Response.json({ error: 'Use case text is required.' }, { status: 400 })
  }

  try {
    const skillContextResult = await getSkillContextResult()

    console.info('[ai:data-model] skill context loaded', {
      requestId,
      source: skillContextResult.source,
      contextLength: skillContextResult.context.length,
    })

    const dataModel = await generateDataModelFromAi({
      endpointUrl,
      apiKey,
      model,
      mode,
      useCase,
      currentModel,
      skillContext: skillContextResult.context,
      requestId,
    })

    return Response.json({
      dataModel,
      model,
    })
  } catch (error) {
    console.error('[ai:data-model] generation failed', {
      requestId,
      error: getErrorMessage(
        error,
        'The AI response could not be converted into a deployable data model.',
      ),
    })

    return Response.json(
      {
        error: getErrorMessage(
          error,
          'The AI response could not be converted into a deployable data model.',
        ),
      },
      { status: 502 },
    )
  }
}
