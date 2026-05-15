'use client'

import { ChevronDown, Link, Plus, X } from 'lucide-react'
import { useEffect, useMemo } from 'react'

import { Button } from '@/components/ui/button'
import {
  inputClassName,
  removeCircleButtonClassName,
  selectClassName,
} from '@/components/entity-node/styles'
import { sanitizeIdentifier } from '@/lib/arkiv/schema'
import type { EntityField, IndexedAttributeType } from '@/lib/arkiv/types'
import { useArkivStore } from '@/store/useArkivStore'
import { useSchemaStore } from '@/store/useSchemaStore'

const PROJECT_ATTRIBUTE_KEY = 'project'
const LEGACY_PROJECT_ATTRIBUTE_KEY = 'PROJECT_ATTRIBUTE'
const PROJECT_COLLISION_CHECK_DEBOUNCE_MS = 650

export function EntityAttributesEditor({
  nodeId,
  fields,
  isDraft,
}: {
  nodeId: string
  fields: EntityField[]
  isDraft: boolean
}) {
  const addField = useSchemaStore((s) => s.addField)
  const removeField = useSchemaStore((s) => s.removeField)
  const updateFieldName = useSchemaStore((s) => s.updateFieldName)
  const updateFieldValue = useSchemaStore((s) => s.updateFieldValue)
  const updateFieldType = useSchemaStore((s) => s.updateFieldType)
  const checkProjectAttributeCollision = useArkivStore(
    (s) => s.checkProjectAttributeCollision,
  )
  const projectAttributeValue = useMemo(
    () =>
      fields
        .find((field) => {
          const name = field.name.trim()
          return (
            name === LEGACY_PROJECT_ATTRIBUTE_KEY ||
            name.toLowerCase() === PROJECT_ATTRIBUTE_KEY
          )
        })
        ?.value.trim() ?? '',
    [fields],
  )

  useEffect(() => {
    if (!isDraft) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      void checkProjectAttributeCollision(projectAttributeValue)
    }, PROJECT_COLLISION_CHECK_DEBOUNCE_MS)

    return () => window.clearTimeout(timeoutId)
  }, [checkProjectAttributeCollision, isDraft, projectAttributeValue])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[1fr_1fr_auto_auto] items-end gap-3">
        <p className="mb-2 text-[13px] font-mono font-bold lowercase tracking-widest text-[#ff7a45] w-full col-span-4 border-b border-gray-100 pb-2">
          INDEXED ATTRIBUTES
        </p>
      </div>

      {fields.map((field) => {
        const isRelation = !!field.edgeId

        return (
          <div key={field.id} className="relative pb-2 pr-8">
            <button
              type="button"
              onClick={() => removeField(nodeId, field.id)}
              className={`${removeCircleButtonClassName} absolute right-0 top-8`}
              aria-label={isRelation ? 'Remove relation' : 'Remove attribute'}
              title={isRelation ? 'Remove relation (also removes edge)' : 'Remove attribute'}
            >
              <X className="size-3.5" />
            </button>

            <div className="grid grid-cols-[clamp(100px,1fr,150px)_1fr_auto] items-end gap-3">
            <div>
              <p className="mb-2 text-[12px] font-mono font-bold uppercase tracking-widest text-gray-400">
                Key
              </p>
              <div className="relative">
                {isRelation ? (
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ff7a45]">
                    <Link className="size-4" />
                  </div>
                ) : null}
                <input
                  value={field.name}
                  onChange={(e) =>
                    updateFieldName(nodeId, field.id, sanitizeIdentifier(e.target.value))
                  }
                  className={`${inputClassName} ${isRelation ? 'pl-11 text-[#ff7a45]' : ''}`}
                  placeholder="Key"
                />
              </div>
            </div>

            <div>
              <p className="mb-2 text-[12px] font-mono font-bold uppercase tracking-widest text-gray-400">
                Value
              </p>
              <input
                value={field.value}
                onChange={(e) => updateFieldValue(nodeId, field.id, e.target.value)}
                disabled={isRelation}
                className={inputClassName}
                placeholder={
                  isRelation
                    ? 'Pending deployment…'
                    : field.type === 'indexedNumber'
                      ? '0'
                      : 'Value…'
                }
                inputMode={field.type === 'indexedNumber' ? 'decimal' : 'text'}
              />
            </div>

            <div>
              <p className="mb-2 text-[12px] font-mono font-bold uppercase tracking-widest text-gray-400">
                Type
              </p>
              <div className="relative w-32">
                <select
                  value={field.type}
                  onChange={(e) =>
                    updateFieldType(
                      nodeId,
                      field.id,
                      e.target.value as IndexedAttributeType,
                    )
                  }
                  className={selectClassName}
                  disabled={isRelation}
                >
                  <option value="indexedString">String</option>
                  <option value="indexedNumber">Number</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            </div>
          </div>
        )
      })}

      <Button
        size="sm"
        onClick={() => addField(nodeId)}
        variant="outline"
        className="nodrag nopan h-12 w-full rounded-[14px] border border-dashed border-gray-300 text-gray-500 transition-all duration-300 hover:border-orange-400 hover:bg-orange-50/50 hover:text-orange-600 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98] shadow-none font-mono tracking-widest uppercase text-[12px] bg-transparent"
      >
        <Plus className="mr-2 size-3.5 transition-transform group-hover:rotate-90" />
        Add Attribute
      </Button>
    </div>
  )
}
