'use client'

import { ArrowUp, Clipboard, Loader2, Trash2, Wand2, X } from 'lucide-react'
import { startTransition, useEffect, useMemo, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  AssistantQuestionOptions,
  OTHER_OPTION_VALUE,
} from '@/components/AssistantQuestionOptions'
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
import { useArkivStore } from '@/store/useArkivStore'
import { useSchemaStore } from '@/store/useSchemaStore'

const MODEL_UNAVAILABLE_MESSAGE =
  'Model unavailable temporarily, please try later.'

type LoadingMode = 'discussIdea' | 'generateSchema' | 'generateImplementationPlan'

const loadingLabels: Record<LoadingMode, string> = {
  discussIdea: 'Understanding your app',
  generateSchema: 'Building schema',
  generateImplementationPlan: 'Drafting implementation prompt',
}

const isDebugChatToolsEnabled =
  process.env.NODE_ENV === 'development' &&
  process.env.NEXT_PUBLIC_ENABLE_CHAT_DEBUG_TOOLS === 'true'

const createMessage = (
  role: AssistantMessage['role'],
  content: string,
  questions?: AssistantMessage['questions'],
): AssistantMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  ...(questions && questions.length > 0 ? { questions } : {}),
})

const formatSelectionsAsAnswer = (
  questions: AssistantMessage['questions'],
  selections: Record<string, string>,
) => {
  if (!questions || questions.length === 0) return ''
  return questions
    .map((question) => `${question.prompt} ${selections[question.id] ?? ''}`.trim())
    .filter(Boolean)
    .join('\n')
}

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

type UseCasePromptPanelProps = {
  onSchemaBuilt?: () => void
  onClose?: () => void
}

export function UseCasePromptPanel({
  onSchemaBuilt,
  onClose,
}: UseCasePromptPanelProps = {}) {
  const connectedWalletAddress = useArkivStore((state) => state.account)
  const nodes = useSchemaStore((state) => state.nodes)
  const edges = useSchemaStore((state) => state.edges)
  const loadGraphOfEntities = useSchemaStore((state) => state.loadGraphOfEntities)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [plan, setPlan] = useState('')
  const [generationTrace, setGenerationTrace] =
    useState<AssistantSchemaResponse['generationTrace']>()
  const [loadingMode, setLoadingMode] = useState<LoadingMode>()
  const [error, setError] = useState<string>()
  const [selections, setSelections] = useState<Record<string, Record<string, string>>>({})
  const submittedSelectionsRef = useRef<Set<string>>(new Set())
  const runDiscussionTurnRef = useRef<(userText: string) => Promise<void>>(async () => {})
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLTextAreaElement | null>(null)
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

  useEffect(() => {
    const latestMessage = messages.at(-1)
    if (!latestMessage) return

    const frame = window.requestAnimationFrame(() => {
      if (latestMessage.role === 'assistant') {
        messageRefs.current
          .get(latestMessage.id)
          ?.scrollIntoView({ block: 'start', behavior: 'smooth' })
        return
      }

      messagesEndRef.current?.scrollIntoView({ block: 'end', behavior: 'smooth' })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [messages])

  useEffect(() => {
    const textarea = inputRef.current
    if (!textarea) return

    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 144)}px`
  }, [input])

  const runDiscussionTurn = async (userText: string) => {
    const trimmed = userText.trim()
    if (!trimmed) return

    const nextMessages = [...messages, createMessage('user', trimmed)]
    setMessages(nextMessages)
    setError(undefined)
    setLoadingMode('discussIdea')

    try {
      const response = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mode: 'discussIdea',
          messages: nextMessages,
          useCase: trimmed,
          connectedWalletAddress,
        }),
      })

      const payload = (await response.json()) as AssistantDiscussionResponse

      if (!response.ok || !payload.message) {
        throw new Error(payload.error || 'Failed to discuss this idea.')
      }

      const assistantMessage = createMessage(
        'assistant',
        payload.message,
        payload.questions,
      )
      setMessages((currentMessages) => [...currentMessages, assistantMessage])

      if (payload.readyToBuild && !payload.questions?.length) {
        const conversationForBuild = [...nextMessages, assistantMessage]
        await runBuildSchema(conversationForBuild)
      }
    } catch (nextError) {
      console.error('[ai:assistant:client] discussion failed', nextError)
      setError(MODEL_UNAVAILABLE_MESSAGE)
    } finally {
      setLoadingMode(undefined)
    }
  }

  runDiscussionTurnRef.current = runDiscussionTurn

  const handleSend = async () => {
    const trimmedInput = input.trim()

    if (!trimmedInput) {
      setError('Describe the app idea or ask a follow-up first.')
      return
    }

    setInput('')
    await runDiscussionTurn(trimmedInput)
  }

  const runBuildSchema = async (conversation: AssistantMessage[]) => {
    const useCase = getConversationUseCase(conversation, '')

    if (!useCase) {
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
          messages: conversation,
          useCase,
          currentModel,
          connectedWalletAddress,
        }),
      })

      const payload = (await response.json()) as AssistantSchemaResponse

      if (!response.ok || !payload.dataModel) {
        throw new Error(payload.error || 'Failed to generate a deployable data model.')
      }

      setGenerationTrace(payload.generationTrace)

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
      onSchemaBuilt?.()
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
          connectedWalletAddress,
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

  const handleCopyThread = async () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      environment: {
        nodeEnv: process.env.NODE_ENV,
        debugChatToolsEnabled: isDebugChatToolsEnabled,
      },
      chat: {
        messages,
        selections,
        submittedSelectionMessageIds: Array.from(submittedSelectionsRef.current),
        draftInput: input,
        plan,
        generationTrace: generationTrace ?? null,
      },
      state: {
        loadingMode: loadingMode ?? null,
        hasExistingModel,
        hasCurrentModel: Boolean(currentModel),
        currentModel: currentModel ?? null,
        error: error ?? null,
      },
    }

    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2))
  }

  const handleClearChat = () => {
    setMessages([])
    setPlan('')
    setGenerationTrace(undefined)
    setInput('')
    setError(undefined)
    setSelections({})
    submittedSelectionsRef.current = new Set()
  }

  const handleOptionSelect = (messageId: string, questionId: string, value: string) => {
    setSelections((current) => {
      const existing = current[messageId] ?? {}
      if (existing[questionId] === value) return current
      return {
        ...current,
        [messageId]: { ...existing, [questionId]: value },
      }
    })

    if (value === OTHER_OPTION_VALUE) {
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }

  const latestAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const candidate = messages[i]
      if (candidate.role === 'assistant' && candidate.questions?.length) {
        return candidate
      }
      if (candidate.role === 'user') break
    }
    return undefined
  }, [messages])

  useEffect(() => {
    if (!latestAssistantMessage?.id || !latestAssistantMessage.questions) return
    if (isLoading) return
    if (submittedSelectionsRef.current.has(latestAssistantMessage.id)) return

    const messageSelections = selections[latestAssistantMessage.id] ?? {}
    const allAnswered = latestAssistantMessage.questions.every(
      (question) => Boolean(messageSelections[question.id]),
    )
    if (!allAnswered) return

    const hasOther = Object.values(messageSelections).includes(OTHER_OPTION_VALUE)
    if (hasOther) return

    const answerText = formatSelectionsAsAnswer(
      latestAssistantMessage.questions,
      messageSelections,
    )
    if (!answerText) return

    submittedSelectionsRef.current.add(latestAssistantMessage.id)
    void runDiscussionTurnRef.current(answerText)
  }, [latestAssistantMessage, selections, isLoading])

  const canClearChat = messages.length > 0 || plan.length > 0 || input.length > 0
  const canCopyThread = messages.length > 0 || plan.length > 0

  return (
    <section className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-[24px] border border-[#ffd8c3]/80 bg-white/95 backdrop-blur-md">
      <div className="shrink-0 border-b border-[#ffe0d1] bg-white/95 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-[10px] bg-[#fff0e8] text-[#ff7a45]">
            <Wand2 className="size-4" />
          </div>
          <div className="min-w-[10rem] flex-1">
            <h2 className="truncate text-sm font-bold text-gray-950">
              Arkiv Build Agent
            </h2>
            <p className="truncate text-xs text-gray-500">
              Discuss, build, prompt
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGeneratePlan}
            disabled={isLoading}
            className="flex h-8 items-center gap-1.5 rounded-[10px] border border-[#ffc4a6] bg-[#fff8f4] px-2.5 text-xs font-bold text-[#ff7a45] shadow-sm transition hover:bg-[#fff0e8] disabled:opacity-40"
          >
            {loadingMode === 'generateImplementationPlan' ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Clipboard className="size-3.5" />
            )}
            Prompt
          </Button>
          {isDebugChatToolsEnabled ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyThread}
              disabled={!canCopyThread}
              title="Copy full thread JSON"
              className="flex h-8 items-center gap-1.5 rounded-[10px] border border-[#ffc4a6] bg-[#fff8f4] px-2.5 text-xs font-bold text-[#ff7a45] shadow-sm transition hover:bg-[#fff0e8] disabled:opacity-40"
            >
              <Clipboard className="size-3.5" />
              Copy Thread
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClearChat}
            disabled={!canClearChat}
            title="Clear chat"
            className="flex h-8 items-center gap-1.5 rounded-[10px] border border-[#ffb3ad] bg-[#fff0ee] px-2.5 text-xs font-bold text-[#ff3b30] shadow-sm transition hover:bg-[#ffe1de] hover:text-red-600 disabled:opacity-40"
          >
            <Trash2 className="size-3.5" />
            Clear
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="flex h-8 items-center gap-1.5 rounded-[10px] border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-600 shadow-sm transition hover:bg-gray-50 hover:text-gray-800"
          >
            <X className="size-3.5" />
            Close
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#fbfbfc] px-4 py-4">
        {messages.length === 0 ? (
          <div className="rounded-[18px] border border-dashed border-[#ffd4bf] bg-white px-4 py-4 text-sm leading-6 text-gray-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <p className="font-semibold text-gray-900">Start with the shape of the app.</p>
            <p className="mt-1">
              Describe what users create, read, or update. Arkiv will ask only for the missing pieces before building the data model.
            </p>
          </div>
        ) : null}

        <div className="flex flex-col gap-4">
          {messages.map((message) => {
            const messageId = message.id
            const messageSelections = messageId
              ? selections[messageId] ?? {}
              : {}
            const isAlreadySubmitted = messageId
              ? submittedSelectionsRef.current.has(messageId)
              : false

            return (
              <div
                key={messageId ?? `${message.role}-${message.content}`}
                ref={(element) => {
                  if (!messageId) return
                  if (element) {
                    messageRefs.current.set(messageId, element)
                    return
                  }
                  messageRefs.current.delete(messageId)
                }}
                className={`group flex max-w-[92%] flex-col gap-1.5 ${
                  message.role === 'user'
                    ? 'ml-auto items-end'
                    : 'mr-auto w-full max-w-[46rem] items-start'
                }`}
              >
                <p
                  className={`px-1 text-[11px] font-semibold uppercase ${
                    message.role === 'user' ? 'text-[#d95018]' : 'text-gray-500'
                  }`}
                >
                  {message.role === 'user' ? 'You' : 'Arkiv'}
                </p>
                {message.role === 'assistant' ? (
                  <div className="w-full rounded-[18px] border border-gray-200 bg-white px-4 py-3 text-gray-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    <MarkdownMessage content={message.content} />
                  </div>
                ) : (
                  <div className="max-w-[34rem] rounded-[18px] bg-[#ff7a45] px-4 py-3 text-sm leading-6 text-white shadow-[0_6px_18px_rgba(255,122,69,0.2)]">
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                )}

                {message.role === 'assistant' && message.questions && messageId ? (
                  <div className="w-full">
                    <AssistantQuestionOptions
                      questions={message.questions}
                      selections={messageSelections}
                      disabled={isAlreadySubmitted}
                      onSelect={(questionId, value) =>
                        handleOptionSelect(messageId, questionId, value)
                      }
                    />
                  </div>
                ) : null}
              </div>
            )
          })}
          {loadingMode ? (
            <div className="mr-auto flex max-w-[46rem] items-center gap-2 rounded-[18px] border border-gray-200 bg-white px-4 py-3 text-sm text-gray-500 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <Loader2 className="size-3.5 animate-spin" />
              {loadingLabels[loadingMode]}
            </div>
          ) : null}
          <div ref={messagesEndRef} />
        </div>

        {plan ? (
          <div className="mt-4 overflow-hidden rounded-[18px] border border-[#ffd4bf] bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between border-b border-[#ffe0d1] px-3 py-2">
              <p className="text-xs font-bold text-gray-800">Implementation prompt</p>
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
            <div className="max-h-[260px] overflow-auto px-4 py-3">
              <MarkdownMessage content={plan} />
            </div>
          </div>
        ) : null}
      </div>

      <div className="shrink-0 border-t border-gray-200/70 bg-white p-3">
        {error ? (
          <p className="mb-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        ) : null}

        <div className="relative">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            rows={1}
            className="max-h-36 min-h-14 w-full resize-none overflow-y-auto rounded-[18px] border border-gray-200 bg-white py-4 pl-4 pr-16 text-sm leading-6 text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-[#ffc4a6] focus:ring-4 focus:ring-[#fff0e8]"
            placeholder={
              hasExistingModel
                ? 'Ask for a schema change, new entity, or relationship...'
                : 'Describe what this app should store or change...'
            }
            spellCheck={false}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                void handleSend()
              }
            }}
          />

          <Button
            type="button"
            onClick={handleSend}
            disabled={isLoading}
            className="absolute bottom-3 right-3 flex size-10 items-center justify-center rounded-full bg-[#f2f4f7] text-gray-500 transition hover:bg-[#ffefe5] hover:text-[#ff7a45] disabled:opacity-40"
          >
            {isLoading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowUp className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </section>
  )
}
