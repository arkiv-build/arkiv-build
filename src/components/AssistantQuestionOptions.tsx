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
    <div className="mt-3 flex flex-col gap-3">
      {questions.map((question, questionIndex) => {
        const activeValue = selections[question.id]
        const questionCount = questions.length

        return (
          <div
            key={question.id}
            className="overflow-hidden rounded-[14px] border border-[#2b3140] bg-[#151922]"
          >
            <div className="flex items-center justify-between border-b border-[#232838] px-3 py-2">
              <p className="pr-2 text-[11px] font-semibold text-slate-100">
                {question.prompt}
              </p>
              {questionCount > 1 ? (
                <p className="shrink-0 text-[10px] text-slate-400">
                  {questionIndex + 1} of {questionCount}
                </p>
              ) : null}
            </div>

            <div className="px-2 py-2">
              <div className="flex flex-col gap-1.5">
                {question.options.map((option, optionIndex) => {
                  const isActive = activeValue === option
                  const isDisabled = disabled && !isActive
                  const isRecommended = optionIndex === 0

                  return (
                    <button
                      key={option}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => onSelect(question.id, option)}
                      className={[
                        'flex w-full items-center gap-2 rounded-[10px] border px-2.5 py-2 text-left text-xs transition',
                        isActive
                          ? 'border-[#7bc1ff] bg-[#1f2837] text-white'
                          : 'border-[#2f3648] bg-[#1a1f2b] text-slate-200 hover:border-[#3c4660] hover:bg-[#1f2533]',
                        isDisabled ? 'cursor-not-allowed opacity-50' : '',
                      ].join(' ')}
                    >
                      <span className="text-[11px] text-slate-400">
                        {optionIndex + 1}.
                      </span>
                      <span className="min-w-0 flex-1 truncate">{option}</span>
                      {isRecommended ? (
                        <span className="rounded-full border border-[#4f7aa6] bg-[#213247] px-1.5 py-0.5 text-[10px] font-semibold text-[#9fceff]">
                          Recommended
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
