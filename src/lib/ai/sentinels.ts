import type { ChoiceQuestion } from '@/lib/ai/assistantTypes'

const BUILD_SENTINEL_PATTERN = /\[\[\s*BUILD_NOW\s*\]\]/gi
const OPTIONS_BLOCK_PATTERN = /\[\[\s*OPTIONS\s*\]\]\s*([\s\S]*?)\s*\[\[\s*\/\s*OPTIONS\s*\]\]/gi

export const extractBuildSentinel = (text: string) => {
  const readyToBuild = BUILD_SENTINEL_PATTERN.test(text)
  BUILD_SENTINEL_PATTERN.lastIndex = 0
  const stripped = text.replace(BUILD_SENTINEL_PATTERN, '').trim()
  return { stripped, readyToBuild }
}

const isChoiceQuestion = (value: unknown): value is ChoiceQuestion => {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<ChoiceQuestion>
  return (
    typeof candidate.id === 'string' &&
    candidate.id.trim().length > 0 &&
    typeof candidate.prompt === 'string' &&
    candidate.prompt.trim().length > 0 &&
    Array.isArray(candidate.options) &&
    candidate.options.length > 0 &&
    candidate.options.every((option) => typeof option === 'string' && option.trim().length > 0)
  )
}

const parseOptionsPayload = (raw: string): ChoiceQuestion[] => {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return []
    const candidate = parsed as { questions?: unknown }
    if (!Array.isArray(candidate.questions)) return []
    const questions = candidate.questions.filter(isChoiceQuestion)
    const seenIds = new Set<string>()
    return questions.filter((question) => {
      if (seenIds.has(question.id)) return false
      seenIds.add(question.id)
      return true
    })
  } catch {
    return []
  }
}

export const extractOptionsBlock = (text: string) => {
  const matches = [...text.matchAll(OPTIONS_BLOCK_PATTERN)]
  if (matches.length === 0) {
    return { stripped: text, questions: [] as ChoiceQuestion[] }
  }

  const questions = matches
    .flatMap((match) => parseOptionsPayload(match[1] ?? ''))
    .reduce<ChoiceQuestion[]>((accumulator, question) => {
      if (accumulator.some((existing) => existing.id === question.id)) {
        return accumulator
      }
      accumulator.push(question)
      return accumulator
    }, [])

  const stripped = text.replace(OPTIONS_BLOCK_PATTERN, '').trim()
  return { stripped, questions }
}
