'use client'

import type { CSSProperties } from 'react'
import { ChevronDown, Database, X } from 'lucide-react'

import { compactToggleClassName } from '@/components/entity-node/styles'
import { getDurationLabel } from '@/components/entity-node/utils'
import { sanitizeIdentifier } from '@/lib/arkiv/schema'
import {
  EXPIRATION_DURATION_OPTIONS,
  type ExpirationDuration,
} from '@/lib/arkiv/types'
import { useSchemaStore, type EntityNodeData } from '@/store/useSchemaStore'

export function EntityHeader({
  nodeId,
  data,
  isDraft,
  shouldShowCollapse,
  onCollapse,
}: {
  nodeId: string
  data: EntityNodeData
  isDraft: boolean
  shouldShowCollapse: boolean
  onCollapse: () => void
}) {
  const updateEntityName = useSchemaStore((s) => s.updateEntityName)
  const removeNode = useSchemaStore((s) => s.removeNode)
  const updateExpirationDuration = useSchemaStore((s) => s.updateExpirationDuration)

  return (
    <div className="p-7 pb-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-1 items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-[16px] bg-[#ff7a45] text-white">
            <Database className="size-6" />
          </div>
          <input
            value={data.label}
            onChange={(e) => updateEntityName(nodeId, sanitizeIdentifier(e.target.value))}
            size={Math.max(data.label.length || 0, 12)}
            style={{ fieldSizing: 'content' } as CSSProperties}
            className="nodrag nopan h-10 min-w-0 border-transparent bg-transparent text-[22px] font-bold uppercase tracking-wider text-gray-900 outline-none placeholder:text-gray-300"
            placeholder="ENTITY TYPE"
            disabled={!isDraft}
          />
        </div>

        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            {isDraft ? (
              <div className="relative">
                <select
                  value={data.expirationDuration}
                  onChange={(e) =>
                    updateExpirationDuration(nodeId, e.target.value as ExpirationDuration)
                  }
                  className="nodrag nopan bg-transparent text-sm font-mono text-gray-500 underline underline-offset-4 decoration-gray-300 outline-none cursor-pointer hover:text-gray-700 appearance-none pr-5 relative z-10"
                >
                  {EXPIRATION_DURATION_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      EXP: {getDurationLabel(option)}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 size-3.5 text-gray-400 pointer-events-none" />
              </div>
            ) : (
              <span className="text-sm font-mono text-gray-500 underline underline-offset-4 decoration-gray-300">
                EXP: {getDurationLabel(data.expirationDuration)}
              </span>
            )}
          </div>

          {shouldShowCollapse ? (
            <button
              onClick={onCollapse}
              className={compactToggleClassName}
              title="Collapse attributes"
            >
              Collapse
            </button>
          ) : null}

          <button
            onClick={() => removeNode(nodeId)}
            className="nodrag nopan flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-900"
            title="Remove Entity"
          >
            <X className="size-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
