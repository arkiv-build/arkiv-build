import {
  normalizeGeneratedDataModel,
  type DataModelGenerationMode,
  type GeneratedDataModel,
} from '@/lib/ai/dataModel'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODELS_WITHOUT_STRUCTURED_OUTPUTS = new Set(['openai/gpt-oss-120b:free'])

type ProviderId = 'openrouter' | 'golem'

type ProviderConfig = {
  id: ProviderId
  url: string
  apiKey?: string
  model: string
  supportsStructuredOutputs: boolean
}

const resolveProvider = (): ProviderConfig | { error: string } => {
  const id = (process.env.AI_PROVIDER ?? 'golem') as ProviderId

  if (id === 'golem') {
    const baseUrl = process.env.GOLEM_INFERENCE_URL?.trim()
    const model = process.env.GOLEM_MODEL?.trim() || 'qwen2.5-0.5b-instruct'

    if (!baseUrl) {
      return {
        error:
          'AI_PROVIDER=golem is set but GOLEM_INFERENCE_URL is missing. Start the golem-host script and point this at its proxy.',
      }
    }

    const url = baseUrl.replace(/\/+$/, '') + '/chat/completions'

    return {
      id,
      url,
      model,
      supportsStructuredOutputs: false,
    }
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  const model = process.env.OPENROUTER_MODEL

  if (!apiKey) {
    return { error: 'Missing OPENROUTER_API_KEY. Add it to your environment before generating a model.' }
  }
  if (!model) {
    return { error: 'Missing OPENROUTER_MODEL. Set it in your environment before generating a model.' }
  }

  return {
    id: 'openrouter',
    url: OPENROUTER_URL,
    apiKey,
    model,
    supportsStructuredOutputs: !MODELS_WITHOUT_STRUCTURED_OUTPUTS.has(model),
  }
}

const SYSTEM_PROMPT = `# ROLE AND DIRECTIVE
You are an Elite Web3 Data Architect specializing in Arkiv Network (formerly Golem DB).
Your sole purpose is to translate user requirements into highly optimized, production-ready Arkiv DB structures.

You must output accurate, efficient, and deterministic schemas that respect Arkiv's Layer 3 decentralized architecture, its time-scoped storage economics, and its Roaring Bitmap/PebbleDB indexing engines.

# ARKIV DB CORE PRINCIPLES (NON-NEGOTIABLE)
1. EVM-Native Identifiers:
- Never use arbitrary UUIDs for user-centric or contract-centric data
- Primary identifiers such as _id, userId, owner, creator, subscriber, account, contractAddress, and parent references must be modeled as standard EVM hex strings like 0x...

2. Time-Scoped Economics (TTL):
- Arkiv storage is paid via bytes x lifetime
- Separate permanent state from ephemeral data
- Every entity must have a recommended TTL strategy
- Because this tool renders Arkiv models as canvas entities, encode the TTL recommendation by choosing the most appropriate expirationDuration and explain the permanence rationale in deploymentNotes
- Ephemeral events, logs, temporary agent states, and short-lived intents must be isolated from permanent entities such as profiles, memberships, plans, and core configs

3. Flat over Nested:
- Keep documents as flat as possible
- Deeply nested JSON is expensive to query and index
- Use embedding only for strictly bounded arrays with clear limits
- Never model unbounded collections as embedded arrays

4. Append-Only vs Mutable:
- Distinguish immutable events from mutable state
- Histories, activity, logs, payments, reactions, and ledgers should usually be append-only entities
- Profiles, settings, current configs, and active status records should usually be mutable state entities

# RELATIONAL MODELING RULES
Arkiv does not support SQL joins. Model relationships based on access patterns:
- 1-to-1: embed directly in the parent only when strictly bounded and always fetched together
- 1-to-few bounded: embed only when the list is capped around 10-20 items
- 1-to-many unbounded: create a separate entity and include the parent EVM address or record identifier as a foreign key
- Many-to-many: use an associative or mapping entity storing the EVM identifiers of both sides

# SCHEMA EVOLUTION AND MODIFICATION PROTOCOL
When a user requests to update or edit an existing structure, follow the Principle of Non-Destructive Evolution:
- Never delete existing fields unless the user explicitly and forcefully asks for removal
- Preserve backward compatibility
- Newly added fields should be optional in spirit: they must not invalidate existing payloads or old records
- Never change the type of an existing field unless the user explicitly asks for migration; prefer creating a new versioned field such as amount_v2

# INTERNAL MODELING PROCEDURE
Before writing JSON, reason privately through this sequence:
1. Identify the core nouns in the app
2. Decide which nouns are first-class entities versus plain fields
3. Determine ownership and cardinality for every relationship
4. Determine which entity must exist first for each relationship
5. Add explicit foreign-key relations for every cross-entity dependency
6. Verify that each dependent entity contains every parent reference it needs
7. Verify TTL strategy for each entity
8. Return the full model only after the relationship graph is coherent

Return only valid JSON with this exact top-level shape:
{
  "title": "short title",
  "summary": "2-4 sentence summary",
  "deploymentOrder": ["EntityA", "EntityB"],
  "deploymentNotes": ["short note", "short note"],
  "entities": [
    {
      "name": "EntityName",
      "expirationDuration": "30d",
      "indexedAttributes": [
        { "name": "fieldName", "type": "indexedString", "value": "initial value" }
      ],
      "dataFields": [
        { "key": "keyName", "value": "initial value" }
      ]
    }
  ],
  "relations": [
    {
      "sourceEntity": "ParentEntity",
      "targetEntity": "ChildEntity",
      "fieldName": "parentEntityId"
    }
  ]
}

Rules:
- Use only expirationDuration values from: 1d, 7d, 30d, 90d, 365d
- Make the model concrete and deployment-ready, not abstract
- Include every searchable attribute as an indexed attribute
- Include every payload field needed to bootstrap the entity as a data field
- Summary plus deploymentNotes should serve as the architectural reasoning section
- The entities plus relations JSON should serve as the Arkiv schema definition section
- Use indexedNumber only for numeric values that must stay numeric on-chain
- IDs, owners, parent references, subscriber references, creator references, and contract references should usually be indexedString values containing EVM hex addresses
- Use simple identifier names with letters, numbers, or underscores
- Prefer too many explicit entities over collapsing important business objects into one overloaded entity
- For relations, sourceEntity is the parent that must be deployed first, targetEntity stores the foreign-key field named by fieldName
- Every real dependency between entities must appear in relations
- If an entity belongs to, is created by, references, contains, reacts to, comments on, follows, joins, invoices, subscribes to, or otherwise depends on another entity, model that dependency explicitly as a relation
- Do not leave cross-entity references implied only in prose, summaries, or dataFields
- Keep documents flat and avoid deep nested payload structures
- For append-only event entities, prefer separate event-like entities over mutating a single aggregate record
- For one-to-many, put the relation on the many side pointing to the one side
- For many-to-many, introduce an explicit join entity unless there is a clearly better domain entity already representing the interaction
- Interaction entities such as Like, Follow, Membership, Enrollment, Subscription, Vote, Comment, Review, or Reaction usually need relations to every parent they depend on
- Child entities should usually have at least one relation unless they are true root entities
- Root entities are deployable without any other entity existing first
- deploymentOrder must be topologically valid for the relations you return
- The relations array must be sufficient to reconstruct the dependency graph without reading the summary
- If an existing model is provided, treat the user message as a follow-up edit request and return the fully updated complete model, not a partial patch
- Preserve valid existing entities and relations unless the follow-up request clearly changes or removes them
- When editing an existing model, keep all still-valid relations and only add, remove, or change the ones required by the follow-up request
- If a user asks for a refinement, assume they want the current model improved rather than replaced
- Keep deploymentNotes focused on practical deployment assumptions or caveats
- In deploymentNotes, mention any non-obvious relationship or join-entity assumptions
- In deploymentNotes, mention TTL strategy, embed-vs-reference choices, and backward compatibility considerations for edits
- Do not output analysis, reasoning, or markdown
- Do not wrap the JSON in markdown`

const NON_STRUCTURED_OUTPUT_APPENDIX = `Output requirements:
- Return JSON only
- Start with {
- End with }
- Do not include any explanation before or after the JSON
- Do not use markdown fences`

const JSON_REPAIR_SYSTEM_PROMPT = `Convert the provided content into valid JSON that exactly matches the requested Arkiv data model schema.

Rules:
- Return JSON only
- Do not include markdown fences
- Preserve the intended entities, relations, and deployment order from the source content
- If the source content implies a relationship, include it explicitly in the relations array
- Ensure the final result is a single valid JSON object`

type OpenRouterMessageContentPart = {
  type?: string
  text?: string
}

const DATA_MODEL_JSON_SCHEMA = {
  name: 'arkiv_data_model',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      title: {
        type: 'string',
        description: 'Short title for the generated data model',
      },
      summary: {
        type: 'string',
        description: 'Concise summary of the model and its key relationships',
      },
      deploymentOrder: {
        type: 'array',
        description: 'Topologically valid deployment order for the entities',
        items: {
          type: 'string',
        },
      },
      deploymentNotes: {
        type: 'array',
        description: 'Short notes about relationship assumptions and deployment caveats',
        items: {
          type: 'string',
        },
      },
      entities: {
        type: 'array',
        description: 'All deployable entities in the application model',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: {
              type: 'string',
              description: 'Entity name using identifier-safe naming',
            },
            expirationDuration: {
              type: 'string',
              enum: ['1d', '7d', '30d', '90d', '365d'],
              description: 'Expiration duration for the entity',
            },
            indexedAttributes: {
              type: 'array',
              description: 'Searchable on-chain fields for this entity',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  name: {
                    type: 'string',
                    description: 'Indexed attribute name',
                  },
                  type: {
                    type: 'string',
                    enum: ['indexedString', 'indexedNumber'],
                    description: 'Indexed attribute type',
                  },
                  value: {
                    description: 'Initial attribute value',
                    anyOf: [{ type: 'string' }, { type: 'number' }],
                  },
                },
                required: ['name', 'type', 'value'],
              },
            },
            dataFields: {
              type: 'array',
              description: 'Bootstrap payload fields stored in the entity payload',
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  key: {
                    type: 'string',
                    description: 'Payload field key',
                  },
                  value: {
                    type: 'string',
                    description: 'Payload field value',
                  },
                },
                required: ['key', 'value'],
              },
            },
          },
          required: ['name', 'expirationDuration', 'indexedAttributes', 'dataFields'],
        },
      },
      relations: {
        type: 'array',
        description: 'Explicit cross-entity dependencies',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            sourceEntity: {
              type: 'string',
              description: 'Parent entity that must exist first',
            },
            targetEntity: {
              type: 'string',
              description: 'Dependent child entity',
            },
            fieldName: {
              type: 'string',
              description: 'Foreign-key field stored on the target entity',
            },
          },
          required: ['sourceEntity', 'targetEntity', 'fieldName'],
        },
      },
    },
    required: [
      'title',
      'summary',
      'deploymentOrder',
      'deploymentNotes',
      'entities',
      'relations',
    ],
  },
} as const

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | Record<string, unknown> | OpenRouterMessageContentPart[]
    }
  }>
  error?: {
    message?: string
  }
}

const extractResponseText = (payload: OpenRouterResponse) => {
  const content = payload.choices?.[0]?.message?.content

  if (typeof content === 'string') {
    return content
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (part.type === 'text' ? part.text ?? '' : ''))
      .join('')
  }

  if (content && typeof content === 'object') {
    return JSON.stringify(content)
  }

  throw new Error('OpenRouter returned an empty response.')
}

const parseJsonContent = (content: string) => {
  const trimmedContent = content.trim()

  try {
    return JSON.parse(trimmedContent) as unknown
  } catch {
    const fencedMatch = trimmedContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)

    if (fencedMatch?.[1]) {
      return JSON.parse(fencedMatch[1]) as unknown
    }

    const objectStart = trimmedContent.indexOf('{')
    const objectEnd = trimmedContent.lastIndexOf('}')

    if (objectStart !== -1 && objectEnd !== -1 && objectEnd > objectStart) {
      return JSON.parse(trimmedContent.slice(objectStart, objectEnd + 1)) as unknown
    }

    throw new Error('The AI response was not valid JSON.')
  }
}

const postToProvider = async ({
  provider,
  body,
  url,
}: {
  provider: ProviderConfig
  body: Record<string, unknown>
  url?: string
}) => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (provider.apiKey) {
    headers.Authorization = `Bearer ${provider.apiKey}`
  }

  return fetch(url ?? provider.url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
}

export async function POST(request: Request) {
  const provider = resolveProvider()

  if ('error' in provider) {
    return Response.json({ error: provider.error }, { status: 500 })
  }

  const body = (await request.json()) as {
    mode?: DataModelGenerationMode
    useCase?: string
    currentModel?: GeneratedDataModel
  }
  const mode = body.mode === 'edit' ? 'edit' : 'create'
  const useCase = body.useCase?.trim()
  const currentModel = body.currentModel

  if (!useCase) {
    return Response.json({ error: 'Use case text is required.' }, { status: 400 })
  }

  const userPrompt =
    mode === 'edit' && currentModel
      ? [
          'You are updating an existing Arkiv model from a follow-up user prompt.',
          'Return the full revised model as JSON using the required schema.',
          `Current canvas model JSON:\n${JSON.stringify(currentModel, null, 2)}`,
          `Follow-up prompt:\n${useCase}`,
        ].join('\n\n')
      : `Design an Arkiv data model for this use case:\n\n${useCase}`

  const requestBody: Record<string, unknown> = {
    model: provider.model,
    temperature: provider.supportsStructuredOutputs ? 0.2 : 0,
    max_tokens: 2800,
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: provider.supportsStructuredOutputs
          ? userPrompt
          : `${userPrompt}\n\n${NON_STRUCTURED_OUTPUT_APPENDIX}`,
      },
    ],
  }

  if (provider.supportsStructuredOutputs) {
    requestBody.provider = {
      require_parameters: true,
    }
    requestBody.response_format = {
      type: 'json_schema',
      json_schema: DATA_MODEL_JSON_SCHEMA,
    }
    requestBody.plugins = [{ id: 'response-healing' }]
  }

  const upstreamResponse = await postToProvider({ provider, body: requestBody })

  const payload = (await upstreamResponse.json()) as OpenRouterResponse

  if (!upstreamResponse.ok) {
    return Response.json(
      {
        error:
          payload.error?.message ||
          `${provider.id} request failed with status ${upstreamResponse.status}.`,
      },
      { status: upstreamResponse.status },
    )
  }

  try {
    const content = extractResponseText(payload)
    let parsed: unknown

    try {
      parsed = parseJsonContent(content)
    } catch (parseError) {
      if (provider.supportsStructuredOutputs) {
        throw parseError
      }

      const repairResponse = await postToProvider({
        provider,
        body: {
          model: provider.model,
          temperature: 0,
          max_tokens: 2800,
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
        },
      })

      const repairPayload = (await repairResponse.json()) as OpenRouterResponse

      if (!repairResponse.ok) {
        throw new Error(
          repairPayload.error?.message ||
            `${provider.id} repair request failed with status ${repairResponse.status}.`,
        )
      }

      parsed = parseJsonContent(extractResponseText(repairPayload))
    }

    const dataModel = normalizeGeneratedDataModel(parsed)

    return Response.json({
      dataModel,
      model: provider.model,
      provider: provider.id,
    })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'The AI response could not be converted into a deployable data model.',
      },
      { status: 502 },
    )
  }
}
