'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useMemo, useState } from 'react'

import { CompactEntityNode } from '@/components/entity-node/CompactEntityNode'
import { EntityActions } from '@/components/entity-node/EntityActions'
import { EntityAttributesEditor } from '@/components/entity-node/EntityAttributesEditor'
import { EntityHeader } from '@/components/entity-node/EntityHeader'
import { EntityPayloadEditor } from '@/components/entity-node/EntityPayloadEditor'
import { EntitySystemAttributes } from '@/components/entity-node/EntitySystemAttributes'
import { useArkivStore } from '@/store/useArkivStore'
import { useSchemaStore, type SchemaNode } from '@/store/useSchemaStore'

export function EntityNode({ id, data, selected }: NodeProps<SchemaNode>) {
  const updateActiveEntity = useArkivStore((s) => s.updateActiveEntity)
  const nodes = useSchemaStore((s) => s.nodes)

  const [updateSuccess, setUpdateSuccess] = useState(false)
  const [systemAttributesOpen, setSystemAttributesOpen] = useState(false)
  const [attributesExpanded, setAttributesExpanded] = useState(false)

  const isDraft = data.mode === 'draft'
  const shouldUseCompactCards = nodes.length > 3
  const isExternalCreator = data.isExternalCreator === true
  const handleClassName = isExternalCreator
    ? '!-left-2 !z-20 !size-4 !border-[4px] !border-white !bg-rose-500'
    : '!-left-2 !z-20 !size-4 !border-[4px] !border-white !bg-[#ff7a45]'

  const pendingParentNodes = useMemo(() => {
    if (!isDraft) return []
    return data.fields
      .filter((field) => field.relationNodeId)
      .map((field) => nodes.find((node) => node.id === field.relationNodeId))
      .filter((node) => node && node.data.mode === 'draft')
  }, [data.fields, isDraft, nodes])

  const hasPendingParent = pendingParentNodes.length > 0
  const showCompactCard = shouldUseCompactCards && !attributesExpanded

  const handleUpdate = async () => {
    await updateActiveEntity()
    setUpdateSuccess(true)
    setTimeout(() => setUpdateSuccess(false), 3000)
  }

  if (showCompactCard) {
    return (
      <CompactEntityNode
        id={id}
        data={data}
        selected={selected}
        onExpand={() => setAttributesExpanded(true)}
      />
    )
  }

  return (
    <div className="relative w-fit min-w-[34rem] max-w-[60rem]">
      <Handle
        type="target"
        position={Position.Left}
        className={handleClassName}
      />

      <div
        className={[
          'overflow-hidden rounded-[24px] bg-white/90 backdrop-blur-xl transition-all duration-400 ease-out',
          isExternalCreator
            ? selected
              ? 'border-[2px] border-rose-500 shadow-2xl shadow-rose-500/20 ring-[8px] ring-rose-500/15 scale-[1.02]'
              : 'border-[2px] border-rose-200 ring-1 ring-rose-200 shadow-xl shadow-rose-200/30 hover:shadow-2xl hover:shadow-rose-200/50 hover:-translate-y-1'
            : selected
              ? 'border-[2px] border-[#ff7a45] shadow-2xl shadow-orange-500/20 ring-[8px] ring-[#ff7a45]/15 scale-[1.02]'
              : 'border-[2px] border-transparent ring-1 ring-gray-200 shadow-xl hover:shadow-2xl hover:shadow-gray-300/50 hover:-translate-y-1',
        ].join(' ')}
      >
        <EntityHeader
          nodeId={id}
          data={data}
          isDraft={isDraft}
          shouldShowCollapse={shouldUseCompactCards}
          onCollapse={() => setAttributesExpanded(false)}
        />

        <div className="space-y-8 p-7 pt-2">
          <EntityAttributesEditor
            nodeId={id}
            fields={data.fields}
            isDraft={isDraft}
            projectAttributeValue={data.projectAttributeValue}
          />

          <EntityPayloadEditor nodeId={id} data={data} isDraft={isDraft} />

          <EntitySystemAttributes
            data={data}
            open={systemAttributesOpen}
            onToggle={() => setSystemAttributesOpen((open) => !open)}
          />

          <div className="pt-2">
            <EntityActions
              nodeId={id}
              data={data}
              isDraft={isDraft}
              hasPendingParent={hasPendingParent}
              updateSuccess={updateSuccess}
              onUpdate={handleUpdate}
            />
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className={isExternalCreator ? '!-right-2 !z-20 !size-4 !border-[4px] !border-white !bg-rose-500' : '!-right-2 !z-20 !size-4 !border-[4px] !border-white !bg-[#ff7a45]'}
      />
    </div>
  )
}
