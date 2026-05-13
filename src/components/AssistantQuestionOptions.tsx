'use client'

import { Check } from 'lucide-react'

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
    <div className="mt-4 flex flex-col gap-3 border-t border-gray-200/80 pt-4">
      {questions.map((question, questionIndex) => {
        const activeValue = selections[question.id]
        const questionCount = questions.length

        return (
          <div
            key={question.id}
            className="overflow-hidden rounded-[16px] border border-gray-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase text-[#e66a39]">
                  Help me choose
                </p>
                <p className="mt-1 pr-2 text-sm font-semibold leading-5 text-gray-900">
                  {question.prompt}
                </p>
              </div>
              {questionCount > 1 ? (
                <p className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-[11px] font-medium text-gray-500">
                  {questionIndex + 1} of {questionCount}
                </p>
              ) : null}
            </div>

            <div className="px-3 py-3">
              <div className="flex flex-col gap-2">
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
                        'flex w-full items-start gap-3 rounded-[12px] border px-3 py-3 text-left text-sm transition',
                        isActive
                          ? 'border-[#ffb894] bg-[#fff4ee] text-[#9a3412] shadow-[0_0_0_1px_rgba(255,122,69,0.12)]'
                          : 'border-gray-200 bg-white text-gray-700 hover:border-[#ffc4a6] hover:bg-[#fffaf7]',
                        isDisabled ? 'cursor-not-allowed opacity-50' : '',
                      ].join(' ')}
                    >
                      <span
                        className={[
                          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold',
                          isActive
                            ? 'border-[#ff7a45] bg-[#ff7a45] text-white'
                            : 'border-gray-200 bg-gray-50 text-gray-500',
                        ].join(' ')}
                      >
                        {isActive ? <Check className="size-3" /> : optionIndex + 1}
                      </span>
                      <span className="min-w-0 flex-1 whitespace-normal break-words leading-5">
                        {option}
                      </span>
                      {isRecommended ? (
                        <span className="mt-0.5 shrink-0 rounded-full bg-[#fff0e8] px-2 py-0.5 text-[10px] font-bold uppercase text-[#e66a39]">
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
