export const MODELS_WITHOUT_STRUCTURED_OUTPUTS = new Set(['openai/gpt-oss-120b:free'])

type ChatCompletionMessageContentPart = {
  type?: string
  text?: string
}

export type ChatCompletionResponse = {
  choices?: Array<{
    finish_reason?: string
    message?: {
      content?: string | Record<string, unknown> | ChatCompletionMessageContentPart[]
    }
  }>
  error?: {
    message?: string
  }
}

export const getAiEndpointConfig = () => ({
  endpointUrl: process.env.AI_CHAT_COMPLETIONS_URL,
  apiKey: process.env.AI_API_KEY,
  model: process.env.AI_MODEL,
})

export const isOpenRouterEndpoint = (endpointUrl: string) =>
  endpointUrl.includes('openrouter.ai')

export const isOpenAiEndpoint = (endpointUrl: string) =>
  endpointUrl.includes('api.openai.com')

export const applyTokenLimit = ({
  body,
  endpointUrl,
  maxTokens,
}: {
  body: Record<string, unknown>
  endpointUrl: string
  maxTokens: number
}) => {
  if (isOpenAiEndpoint(endpointUrl)) {
    body.max_completion_tokens = maxTokens
    return
  }

  body.max_tokens = maxTokens
}

export const getEndpointHost = (endpointUrl: string) => {
  try {
    return new URL(endpointUrl).host
  } catch {
    return 'invalid-url'
  }
}

export const extractResponseText = (payload: ChatCompletionResponse) => {
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

  throw new Error('The AI endpoint returned an empty response.')
}

export const parseJsonContent = (content: string) => {
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

export const postToChatCompletions = async ({
  endpointUrl,
  apiKey,
  body,
}: {
  endpointUrl: string
  apiKey: string
  body: Record<string, unknown>
}) =>
  fetch(endpointUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
