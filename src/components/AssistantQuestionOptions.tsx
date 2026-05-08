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
            className="overflow-hidden rounded-[14px] border border-[#ffd8c3] bg-[#fffaf6]"
          >
            <div className="flex items-center justify-between border-b border-[#ffe7db] px-3 py-2">
              <p className="pr-2 text-[11px] font-semibold text-gray-700">
                {question.prompt}
              </p>
              {questionCount > 1 ? (
                <p className="shrink-0 text-[10px] text-gray-500">
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
                        'flex w-full items-start gap-2 rounded-[10px] border px-2.5 py-2 text-left text-xs transition',
                        isActive
                          ? 'border-[#ffb894] bg-[#fff2ea] text-[#c5531e]'
                          : 'border-[#ffe2d3] bg-white text-gray-700 hover:border-[#ffcfb6] hover:bg-[#fff7f2]',
                        isDisabled ? 'cursor-not-allowed opacity-50' : '',
                      ].join(' ')}
                    >
                      <span className="text-[11px] text-gray-500">
                        {optionIndex + 1}.
                      </span>
                      <span className="min-w-0 flex-1 whitespace-normal break-words leading-5">
                        {option}
                      </span>
                      {isRecommended ? (
                        <span className="mt-0.5 shrink-0 rounded-full border border-[#ffc7a9] bg-[#fff2ea] px-1.5 py-0.5 text-[10px] font-semibold text-[#e66a39]">
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
