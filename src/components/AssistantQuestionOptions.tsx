'use client'

import type { ChoiceQuestion } from '@/lib/ai/assistantTypes'

type AssistantQuestionOptionsProps = {
  questions: ChoiceQuestion[]
  selections: Record<string, string>
  disabled?: boolean
  onSelect: (questionId: string, value: string) => void
}

export const OTHER_OPTION_VALUE = 'other'

export function AssistantQuestionOptions({
  questions,
  selections,
  disabled = false,
  onSelect,
}: AssistantQuestionOptionsProps) {
  if (questions.length === 0) {
    return null
  }

  return (
    <div className="mt-2 flex flex-col gap-2">
      {questions.map((question) => {
        const activeValue = selections[question.id]

        return (
          <div key={question.id} className="flex flex-col gap-1">
            <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
              {question.prompt}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {question.options.map((option) => {
                const isActive = activeValue === option
                const isDisabled = disabled && !isActive

                return (
                  <button
                    key={option}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => onSelect(question.id, option)}
                    className={[
                      'rounded-full border px-3 py-1 text-xs font-semibold transition',
                      isActive
                        ? 'border-[#ff7a45] bg-[#ff7a45] text-white shadow-sm'
                        : 'border-[#ffc4a6] bg-white text-[#ff7a45] hover:bg-[#fff5f0]',
                      isDisabled ? 'cursor-not-allowed opacity-50' : '',
                    ].join(' ')}
                  >
                    {option}
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
