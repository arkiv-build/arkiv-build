'use client'

import { Handle, Position } from '@xyflow/react'
import { ChevronDown, X } from 'lucide-react'

import { useSchemaStore, type EntityNodeData } from '@/store/useSchemaStore'

export function CompactEntityNode({
  id,
  data,
  selected,
  onExpand,
}: {
  id: string
  data: EntityNodeData
  selected: boolean
  onExpand: () => void
}) {
  const removeNode = useSchemaStore((s) => s.removeNode)

  return (
    <div className="relative w-fit min-w-[20rem] max-w-[40rem]">
      <Handle
        type="target"
        position={Position.Left}
        className="!-left-2 !z-20 !size-4 !border-[4px] !border-white !bg-[#ff7a45]"
      />

      <div
        className={[
          'overflow-hidden rounded-[20px] bg-white/95 backdrop-blur-xl transition-all duration-300 ease-out',
          selected
            ? 'border-[2px] border-[#ff7a45] shadow-xl shadow-orange-500/20 ring-[5px] ring-[#ff7a45]/15'
            : 'border border-gray-200 shadow-lg shadow-gray-300/30 hover:shadow-xl hover:shadow-gray-300/45',
        ].join(' ')}
      >
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="mt-1 grid shrink-0 grid-cols-2 gap-1">
                <span className="size-2.5 rounded-[4px] bg-[#ff7a45]/80" />
                <span className="size-2.5 rounded-[4px] bg-[#ff7a45]/70" />
                <span className="size-2.5 rounded-[4px] bg-[#ff7a45]/65" />
                <span className="size-2.5 rounded-[4px] bg-[#ff7a45]/55" />
              </div>

              <div className="min-w-0">
                <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">
                  Entity
                </p>
                <p className="whitespace-nowrap pt-0.5 text-[14px] font-bold uppercase tracking-wide text-gray-900">
                  {data.label || 'Untitled Entity'}
                </p>
                {data.entityKey ? (
                  <p className="truncate pt-1 font-mono text-[11px] text-gray-500">
                    {data.entityKey}
                  </p>
                ) : null}
              </div>
            </div>

            <button
              onClick={() => removeNode(id)}
              className="nodrag nopan flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-900"
              title="Remove Entity"
            >
              <X className="size-4" />
            </button>
          </div>

          <button
            onClick={onExpand}
            className="nodrag nopan flex h-10 w-full items-center justify-between rounded-[12px] border border-[#ffbe9f] bg-[#fff5f0] px-3 text-left transition hover:border-[#ff7a45] hover:bg-[#ffe8db]"
          >
            <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[#ff7a45]">
              Expand Attributes
            </span>
            <ChevronDown className="size-4 text-[#ff7a45]" />
          </button>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!-right-2 !z-20 !size-4 !border-[4px] !border-white !bg-[#ff7a45]"
      />
    </div>
  )
}
