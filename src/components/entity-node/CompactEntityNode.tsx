'use client'

import { Handle, Position } from '@xyflow/react'
import { ChevronDown, Link, X } from 'lucide-react'

import { removeCircleButtonClassName } from '@/components/entity-node/styles'
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
  const removeField = useSchemaStore((s) => s.removeField)
  const relationFields = data.fields.filter((field) => field.edgeId)
  const isExternalCreator = data.isExternalCreator === true
  const accent = isExternalCreator
    ? {
        handle: '!bg-rose-500',
        selected: 'border-[2px] border-rose-500 shadow-xl shadow-rose-500/20 ring-[5px] ring-rose-500/15',
        idle: 'border border-rose-200 shadow-lg shadow-rose-200/30 hover:shadow-xl hover:shadow-rose-200/45',
        icon: ['bg-rose-500/80', 'bg-rose-500/70', 'bg-rose-500/65', 'bg-rose-500/55'],
        relation: 'border-rose-200 bg-rose-50 text-rose-600',
        relationButton: 'border-rose-200 text-rose-500 hover:border-rose-300 hover:text-rose-700',
        expand: 'border-rose-200 bg-rose-50 hover:border-rose-400 hover:bg-rose-100',
        expandText: 'text-rose-600',
      }
    : {
        handle: '!bg-[#ff7a45]',
        selected: 'border-[2px] border-[#ff7a45] shadow-xl shadow-orange-500/20 ring-[5px] ring-[#ff7a45]/15',
        idle: 'border border-gray-200 shadow-lg shadow-gray-300/30 hover:shadow-xl hover:shadow-gray-300/45',
        icon: ['bg-[#ff7a45]/80', 'bg-[#ff7a45]/70', 'bg-[#ff7a45]/65', 'bg-[#ff7a45]/55'],
        relation: 'border-[#ffd3bd] bg-[#fff8f4] text-[#ff7a45]',
        relationButton: 'border-[#ffc6ad] text-[#ff7a45] hover:border-red-200 hover:text-red-600',
        expand: 'border-[#ffbe9f] bg-[#fff5f0] hover:border-[#ff7a45] hover:bg-[#ffe8db]',
        expandText: 'text-[#ff7a45]',
      }

  return (
    <div className="relative w-fit min-w-[20rem] max-w-[40rem]">
      <Handle
        type="target"
        position={Position.Left}
        className={`!-left-2 !z-20 !size-4 !border-[4px] !border-white ${accent.handle}`}
      />

      <div
        className={[
          'overflow-hidden rounded-[20px] bg-white/95 backdrop-blur-xl transition-all duration-300 ease-out',
          selected ? accent.selected : accent.idle,
        ].join(' ')}
      >
        <div className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="mt-1 grid shrink-0 grid-cols-2 gap-1">
                {accent.icon.map((className) => (
                  <span key={className} className={`size-2.5 rounded-[4px] ${className}`} />
                ))}
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

          {relationFields.length > 0 ? (
            <div className="space-y-2">
              <p className="font-mono text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Relations
              </p>
              <div className="flex flex-wrap gap-2">
                {relationFields.map((field) => (
                  <div
                    key={field.id}
                    className={`nodrag nopan flex max-w-full items-center gap-1.5 rounded-full border py-1 pl-2.5 pr-1 ${accent.relation}`}
                  >
                    <Link className="size-3.5 shrink-0" />
                    <span className="max-w-36 truncate font-mono text-[10px] font-bold tracking-wide">
                      {field.name || 'relation'}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeField(id, field.id)}
                      className={`${removeCircleButtonClassName} size-5 ${accent.relationButton}`}
                      aria-label={`Remove ${field.name || 'relation'} relation`}
                      title="Remove relation"
                    >
                      <X className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <button
            onClick={onExpand}
            className={`nodrag nopan flex h-10 w-full items-center justify-between rounded-[12px] border px-3 text-left transition ${accent.expand}`}
          >
            <span className={`font-mono text-[11px] font-bold uppercase tracking-widest ${accent.expandText}`}>
              Expand Attributes
            </span>
            <ChevronDown className={`size-4 ${accent.expandText}`} />
          </button>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className={`!-right-2 !z-20 !size-4 !border-[4px] !border-white ${accent.handle}`}
      />
    </div>
  )
}
