'use client'

import { Clipboard, Loader2, Send, Wand2, Workflow } from 'lucide-react'
import { startTransition, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { MarkdownMessage } from '@/components/MarkdownMessage'
import {
  buildSchemaGraphFromGeneratedModel,
  hasMeaningfulCanvasModel,
  serializeCanvasToGeneratedDataModel,
  type DataModelGenerationMode,
} from '@/lib/ai/dataModel'
import type {
  AssistantDiscussionResponse,
  AssistantImplementationPlanResponse,
  AssistantMessage,
  AssistantSchemaResponse,
} from '@/lib/ai/assistantTypes'
import { useSchemaStore } from '@/store/useSchemaStore'

const MODEL_UNAVAILABLE_MESSAGE =
  'Model unavailable temporarily, please try later.'

type LoadingMode = 'discussIdea' | 'generateSchema' | 'generateImplementationPlan'

const createMessage = (
  role: AssistantMessage['role'],
  content: string,
): AssistantMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
})

const getConversationUseCase = (
  messages: AssistantMessage[],
  draftInput: string,
) => {
  const parts = messages
    .filter((message) => message.role === 'user')
    .map((message) => message.content.trim())
    .filter(Boolean)

  const trimmedDraftInput = draftInput.trim()

  if (trimmedDraftInput) {
    parts.push(trimmedDraftInput)
  }

  return parts.join('\n\n')
}

export function UseCasePromptPanel() {
  const nodes = useSchemaStore((state) => state.nodes)
  const edges = useSchemaStore((state) => state.edges)
  const loadGraphOfEntities = useSchemaStore((state) => state.loadGraphOfEntities)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [plan, setPlan] = useState('')
  const [loadingMode, setLoadingMode] = useState<LoadingMode>()
  const [error, setError] = useState<string>()
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const hasExistingModel = useMemo(
    () => hasMeaningfulCanvasModel(nodes, edges),
    [nodes, edges],
  )
  const isLoading = Boolean(loadingMode)

  const currentModel = useMemo(
    () =>
      hasExistingModel
        ? serializeCanvasToGeneratedDataModel(nodes, edges)
        : undefined,
    [edges, hasExistingModel, nodes],
  )

  const scrollMessagesToEnd = () => {
    window.setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ block: 'end' })
    }, 0)
  }

  const handleSend = async () => {
    const trimmedInput = input.trim()

    if (!trimmedInput) {
      setError('Describe the app idea or ask a follow-up first.')
      return
    }

    const nextMessages = [...messages, createMessage('user', trimmedInput)]
    setMessages(nextMessages)
    setInput('')
    setError(undefined)
    setLoadingMode('discussIdea')
    scrollMessagesToEnd()

    try {
      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'discussIdea',
          messages: nextMessages,
          useCase: trimmedInput,
        }),
      })

      const payload = (await response.json()) as AssistantDiscussionResponse

      if (!response.ok || !payload.message) {
        throw new Error(payload.error || 'Failed to discuss this idea.')
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage('assistant', payload.message),
      ])
      scrollMessagesToEnd()
    } catch (nextError) {
      console.error('[ai:assistant:client] discussion failed', nextError)
      setError(MODEL_UNAVAILABLE_MESSAGE)
    } finally {
      setLoadingMode(undefined)
    }
  }

  const handleBuildSchema = async () => {
    const useCase = getConversationUseCase(messages, input)

    if (!useCase) {
      setError('Describe the app idea before building a schema.')
      return
    }

    setError(undefined)
    setLoadingMode('generateSchema')

    try {
      const mode: DataModelGenerationMode = hasExistingModel ? 'edit' : 'create'
      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'generateSchema',
          schemaMode: mode,
          messages,
          useCase,
          currentModel,
        }),
      })

      const payload = (await response.json()) as AssistantSchemaResponse

      if (!response.ok || !payload.dataModel) {
        throw new Error(payload.error || 'Failed to generate a deployable data model.')
      }

      const { nodes: nextNodes, edges: nextEdges } = buildSchemaGraphFromGeneratedModel(
        payload.dataModel,
      )

      startTransition(() => {
        loadGraphOfEntities(nextNodes, nextEdges)
      })

      setMessages((currentMessages) => [
        ...currentMessages,
        createMessage(
          'assistant',
          `Built the ${payload.dataModel?.title || 'Arkiv'} schema on the canvas.`,
        ),
      ])
      setInput('')
      scrollMessagesToEnd()
    } catch (nextError) {
      console.error('[ai:assistant:client] schema generation failed', nextError)
      setError(MODEL_UNAVAILABLE_MESSAGE)
    } finally {
      setLoadingMode(undefined)
    }
  }

  const handleGeneratePlan = async () => {
    const useCase = getConversationUseCase(messages, input)

    if (!useCase) {
      setError('Describe the app idea before generating a plan.')
      return
    }

    setError(undefined)
    setLoadingMode('generateImplementationPlan')

    try {
      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'generateImplementationPlan',
          messages,
          useCase,
          currentModel,
        }),
      })

      const payload = (await response.json()) as AssistantImplementationPlanResponse

      if (!response.ok || !payload.plan) {
        throw new Error(payload.error || 'Failed to generate an implementation plan.')
      }

      setPlan(payload.plan)
    } catch (nextError) {
      console.error('[ai:assistant:client] plan generation failed', nextError)
      setError(MODEL_UNAVAILABLE_MESSAGE)
    } finally {
      setLoadingMode(undefined)
    }
  }

  const handleCopyPlan = async () => {
    if (!plan) {
      return
    }

    await navigator.clipboard.writeText(plan)
  }

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[16px] border border-[#ffc4a6] bg-white/95 shadow-sm">
      <div className="shrink-0 border-b border-[#ffe0d1] px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-[10px] bg-[#fff0e8] text-[#ff7a45]">
            <Wand2 className="size-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-gray-950">
              Arkiv Build Agent
            </h2>
            <p className="truncate text-xs text-gray-500">
              Discuss, model, plan
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {messages.length === 0 ? (
          <div className="rounded-[14px] border border-dashed border-[#ffd4bf] bg-[#fff8f4] px-3 py-3 text-xs leading-5 text-gray-600">
            Start with an app idea. The assistant can shape the Arkiv fit, then build the canvas schema and implementation plan.
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          {messages.map((message) => (
            <div
              key={message.id ?? `${message.role}-${message.content}`}
              className={`max-w-[92%] rounded-[14px] px-3 py-2 text-xs leading-5 ${
                message.role === 'user'
                  ? 'ml-auto bg-[#ff7a45] text-white'
                  : 'mr-auto border border-gray-200 bg-gray-50 text-gray-700'
              }`}
            >
              {message.role === 'assistant' ? (
                <MarkdownMessage content={message.content} />
              ) : (
                <p className="whitespace-pre-wrap break-words">{message.content}</p>
              )}
            </div>
          ))}
          {loadingMode === 'discussIdea' ? (
            <div className="mr-auto flex items-center gap-2 rounded-[14px] border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
              <Loader2 className="size-3.5 animate-spin" />
              Thinking
            </div>
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        {plan ? (
          <div className="mt-3 overflow-hidden rounded-[14px] border border-[#ffd4bf] bg-[#fffaf7]">
            <div className="flex items-center justify-between border-b border-[#ffe0d1] px-3 py-2">
              <p className="text-xs font-bold text-gray-800">Implementation plan</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCopyPlan}
                className="h-7 rounded-[10px] px-2 text-xs text-[#ff7a45] hover:bg-[#fff0e8] hover:text-[#e66a39]"
              >
                <Clipboard className="size-3.5" />
                Copy
              </Button>
            </div>
            <div className="max-h-[260px] overflow-auto px-3 py-3">
              <MarkdownMessage content={plan} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-[#ffe0d1] p-3">
        {error ? (
          <p className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        ) : null}

        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          className="h-20 w-full resize-none rounded-[14px] border border-[#ffc4a6] bg-white px-3 py-2 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#ff7a45]"
          placeholder={
            hasExistingModel
              ? 'Ask a follow-up or describe a schema refinement'
              : 'Describe the app you want to build'
          }
          spellCheck={false}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              void handleSend()
            }
          }}
        />

        <div className="mt-2 grid grid-cols-3 gap-2">
          <Button
            type="button"
            onClick={handleSend}
            disabled={isLoading}
            className="h-10 rounded-[12px] bg-gray-900 px-3 text-xs font-semibold text-white hover:bg-gray-800"
          >
            {loadingMode === 'discussIdea' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
            Send
          </Button>
          <Button
            type="button"
            onClick={handleBuildSchema}
            disabled={isLoading}
            className="h-10 rounded-[12px] bg-[#ff7a45] px-3 text-xs font-semibold text-white hover:bg-[#ff692a]"
          >
            {loadingMode === 'generateSchema' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Workflow className="size-4" />
            )}
            {hasExistingModel ? 'Update' : 'Schema'}
          </Button>
          <Button
            type="button"
            onClick={handleGeneratePlan}
            disabled={isLoading}
            variant="outline"
            className="h-10 rounded-[12px] border-[#ffc4a6] bg-white px-3 text-xs font-semibold text-[#ff7a45] hover:bg-[#fff5f0] hover:text-[#e66a39]"
          >
            {loadingMode === 'generateImplementationPlan' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Clipboard className="size-4" />
            )}
            Plan
          </Button>
        </div>
      </div>
    </section>
  )
}
