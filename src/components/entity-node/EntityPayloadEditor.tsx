'use client'

import { Plus, X } from 'lucide-react'

import { EntityDataEditor } from '@/components/entity-node/EntityDataEditor'
import {
  inputClassName,
  removeCircleButtonClassName,
} from '@/components/entity-node/styles'
import { Button } from '@/components/ui/button'
import { sanitizeIdentifier } from '@/lib/arkiv/schema'
import { useSchemaStore, type EntityNodeData } from '@/store/useSchemaStore'

export function EntityPayloadEditor({
  nodeId,
  data,
  isDraft,
}: {
  nodeId: string
  data: EntityNodeData
  isDraft: boolean
}) {
  const addDataField = useSchemaStore((s) => s.addDataField)
  const removeDataField = useSchemaStore((s) => s.removeDataField)
  const updateDataFieldKey = useSchemaStore((s) => s.updateDataFieldKey)
  const updateDataFieldValue = useSchemaStore((s) => s.updateDataFieldValue)

  if (isDraft) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
          <p className="mb-2 text-[13px] font-mono font-bold lowercase tracking-widest text-[#ff7a45] col-span-3 border-b border-gray-100 pb-2">
            DATA FIELDS
          </p>
        </div>

        <div className="space-y-4">
          {(data.dataFields ?? []).map((field) => (
            <div
              key={field.id}
              className="relative pr-8"
            >
              <button
                type="button"
                onClick={() => removeDataField(nodeId, field.id)}
                className={`${removeCircleButtonClassName} absolute right-0 top-8`}
                aria-label="Remove data field"
                title="Remove data field"
              >
                <X className="size-3.5" />
              </button>

              <div className="grid grid-cols-[clamp(100px,1fr,150px)_1fr] items-end gap-3">
                <div>
                  <p className="mb-2 text-[12px] font-mono font-bold uppercase tracking-widest text-gray-400">
                    Key
                  </p>
                  <input
                    value={field.key}
                    onChange={(e) =>
                      updateDataFieldKey(
                        nodeId,
                        field.id,
                        sanitizeIdentifier(e.target.value),
                      )
                    }
                    className={inputClassName}
                    placeholder="e.g. bio"
                  />
                </div>
                <div>
                  <p className="mb-2 text-[12px] font-mono font-bold uppercase tracking-widest text-gray-400">
                    Value
                  </p>
                  <input
                    value={field.value}
                    onChange={(e) => updateDataFieldValue(nodeId, field.id, e.target.value)}
                    className={inputClassName}
                    placeholder="Value…"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button
          size="sm"
          onClick={() => addDataField(nodeId)}
          variant="outline"
          className="nodrag nopan h-12 w-full rounded-[14px] border border-dashed border-gray-300 text-gray-500 transition-all duration-300 hover:border-orange-400 hover:bg-orange-50/50 hover:text-orange-600 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] shadow-none font-mono tracking-widest uppercase text-[12px] bg-transparent"
        >
          <Plus className="mr-2 size-3.5 transition-transform group-hover:rotate-90" />
          Add Data Field
        </Button>
      </div>
    )
  }

  if (!data.entityData) {
    return null
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <p className="text-[13px] font-mono font-bold lowercase tracking-widest text-[#ff7a45]">
          ENTITY DATA
        </p>
        <p className="text-[13px] font-mono text-gray-400">{data.entitySize} BYTES</p>
      </div>
      <EntityDataEditor entityData={data.entityData} nodeId={nodeId} />
    </div>
  )
}
