'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { CheckCircle, Database, ExternalLink, Link, Loader2, Minus, Plus, RefreshCw, Rocket, X, ChevronDown } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { estimateExpirationBlock, formatBlockNumber } from '@/lib/arkiv/mappers'
import {
  EXPIRATION_DURATION_OPTIONS,
  type ExpirationDuration,
  type IndexedAttributeType,
} from '@/lib/arkiv/types'
import { useArkivStore } from '@/store/useArkivStore'
import { useSchemaStore, type SchemaNode } from '@/store/useSchemaStore'

const inputClassName =
  'nodrag nopan h-12 w-full rounded-[14px] border border-gray-100 bg-gray-50/50 px-4 font-mono text-sm text-gray-900 outline-none transition duration-200 placeholder:text-gray-400 focus:border-gray-200 focus:bg-gray-100/50 disabled:cursor-not-allowed disabled:opacity-80'

const selectClassName =
  'nodrag nopan h-12 w-full rounded-[14px] border border-gray-100 bg-gray-50/50 px-4 pr-10 font-mono text-sm text-gray-900 outline-none transition duration-200 focus:border-gray-200 focus:bg-gray-100/50 disabled:cursor-not-allowed disabled:opacity-80 appearance-none'

const sanitizeIdentifier = (val: string) => {
  return val
    .replace(/\s+/g, '_')            // Replace spaces with underscores
    .replace(/^[^\p{L}_]+/u, '')     // Remove invalid starting characters
    .replace(/[^\p{L}\p{N}_]/gu, '') // Remove invalid subsequent characters
}

// ---------------------------------------------------------------------------
// EntityDataEditor – renders JSON as friendly key/value rows, falls back to a
// plain textarea for non-JSON payloads.
// ---------------------------------------------------------------------------
function EntityDataEditor({
  entityData,
  nodeId,
}: {
  entityData: string
  nodeId: string
}) {
  const updateEntityData = useSchemaStore((s) => s.updateEntityData)

  const parsed = useMemo(() => {
    try {
      const obj = JSON.parse(entityData)
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        return obj as Record<string, unknown>
      }
      return null
    } catch {
      return null
    }
  }, [entityData])

  // ---- structured JSON rows ----
  if (parsed) {
    const entries = Object.entries(parsed)

    const handleValueChange = (key: string, value: string) => {
      const updated = { ...parsed }
      // preserve original type if number-like
      const num = Number(value)
      updated[key] = value !== '' && !Number.isNaN(num) && typeof parsed[key] === 'number' ? num : value
      updateEntityData(nodeId, JSON.stringify(updated, null, 2))
    }

    return (
      <div className="space-y-4">
        {entries.map(([key, val]) => {
          const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val)
          const isReadOnly =
            key === 'app' || key === 'version' || key === 'deployedAt'

          return (
            <div key={key}>
              <p className="mb-2 text-[12px] font-mono font-bold uppercase tracking-widest text-gray-400">
                {key}
              </p>
              <input
                value={valStr}
                onChange={(e) => handleValueChange(key, e.target.value)}
                disabled={isReadOnly}
                className={inputClassName}
                placeholder="value"
              />
            </div>
          )
        })}
      </div>
    )
  }

  // ---- raw textarea fallback ----
  return (
    <textarea
      value={entityData}
      onChange={(e) => updateEntityData(nodeId, e.target.value)}
      rows={6}
      className={`nodrag nopan w-full resize-none rounded-xl border border-gray-100 bg-gray-50/50 p-4 font-mono text-sm leading-5 text-gray-900 outline-none transition focus:border-gray-200 focus:bg-gray-100/50`}
      placeholder="Entity payload (JSON or plain text)"
      spellCheck={false}
    />
  )
}

// ---------------------------------------------------------------------------
// EntityNode
// ---------------------------------------------------------------------------
export function EntityNode({ id, data, selected }: NodeProps<SchemaNode>) {
  const updateEntityName = useSchemaStore((s) => s.updateEntityName)
  const removeNode = useSchemaStore((s) => s.removeNode)
  const updateExpirationDuration = useSchemaStore((s) => s.updateExpirationDuration)
  const addField = useSchemaStore((s) => s.addField)
  const removeField = useSchemaStore((s) => s.removeField)
  const updateFieldName = useSchemaStore((s) => s.updateFieldName)
  const updateFieldValue = useSchemaStore((s) => s.updateFieldValue)
  const updateFieldType = useSchemaStore((s) => s.updateFieldType)
  const addDataField = useSchemaStore((s) => s.addDataField)
  const removeDataField = useSchemaStore((s) => s.removeDataField)
  const updateDataFieldKey = useSchemaStore((s) => s.updateDataFieldKey)
  const updateDataFieldValue = useSchemaStore((s) => s.updateDataFieldValue)
  const blockTiming = useArkivStore((s) => s.blockTiming)
  const updating = useArkivStore((s) => s.updating)
  const updateActiveEntity = useArkivStore((s) => s.updateActiveEntity)
  const deployDraft = useArkivStore((s) => s.deployDraft)
  const deploying = useArkivStore((s) => s.deploying)
  const walletAvailable = useArkivStore((s) => s.walletAvailable)
  const account = useArkivStore((s) => s.account)
  const chainId = useArkivStore((s) => s.chainId)
  const { ARKIV_CHAIN, isArkivKaolinChain } = require('@/lib/arkiv/chain')

  const [updateSuccess, setUpdateSuccess] = useState(false)

  const isDraft = data.mode === 'draft'

  const getDurationLabel = (duration: string) => {
    if (duration === '7d') return '1 week'
    if (duration === '30d') return '4 weeks'
    if (duration === '90d') return '13 weeks'
    if (duration === '365d') return '52 weeks'
    return duration
  }

  const handleUpdate = async () => {
    await updateActiveEntity()
    setUpdateSuccess(true)
    setTimeout(() => setUpdateSuccess(false), 3000)
  }

  const nodes = useSchemaStore((s) => s.nodes)

  const pendingUpstreamNodes = useMemo(() => {
    if (!isDraft) return []
    return data.fields
      .filter((f) => f.relationNodeId)
      .map((f) => nodes.find((n) => n.id === f.relationNodeId))
      .filter((n) => n && n.data.mode === 'draft')
  }, [data.fields, isDraft, nodes])

  const hasPendingUpstream = pendingUpstreamNodes.length > 0

  return (
    <div className="relative w-[34rem]">
      <Handle
        type="target"
        position={Position.Left}
        className="!size-4 !border-[4px] !border-white !bg-[#ff7a45]"
      />

      <div
        className={[
          'overflow-hidden rounded-[24px] bg-white transition-all',
          selected
            ? 'border-[2px] border-[#ff7a45] shadow-lg ring-[6px] ring-[#ff7a45]/10'
            : 'border-[2px] border-[#ff7a45] shadow-md',
        ].join(' ')}
      >
        {/* ------------------------------------------------------------------ Header */}
        <div className="p-7 pb-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-1 items-center gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-[16px] bg-[#ff7a45] text-white">
                <Database className="size-6" />
              </div>
              <input
                value={data.label}
                onChange={(e) => updateEntityName(id, sanitizeIdentifier(e.target.value))}
                className="nodrag nopan h-10 w-full min-w-0 border-transparent bg-transparent text-[22px] font-bold uppercase tracking-wider text-gray-900 outline-none placeholder:text-gray-300"
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
                        updateExpirationDuration(id, e.target.value as ExpirationDuration)
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

              <button
                onClick={() => removeNode(id)}
                className="nodrag nopan flex size-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-900"
                title="Remove Entity"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>
        </div>

        {/* ------------------------------------------------------------------ Body */}
        <div className="space-y-8 p-7 pt-2">

          {/* ---- Indexed Attributes ---- */}
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_1fr_auto_auto] items-end gap-3">
              <p className="mb-2 text-[13px] font-mono font-bold lowercase tracking-widest text-[#ff7a45] w-full col-span-4 border-b border-gray-100 pb-2">
                INDEXED ATTRIBUTES
              </p>
            </div>

            {data.fields.map((field) => {
              const isRelation = !!field.edgeId;

              return (
                <div key={field.id} className="grid grid-cols-[clamp(100px,1fr,150px)_1fr_auto_auto] items-end gap-3 pb-2">
                  <div>
                    <p className="mb-2 text-[12px] font-mono font-bold uppercase tracking-widest text-gray-400">
                      Field Name
                    </p>
                    <div className="relative">
                      {isRelation ? (
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ff7a45]">
                          <Link className="size-4" />
                        </div>
                      ) : null}
                      <input
                        value={field.name}
                        onChange={(e) => updateFieldName(id, field.id, sanitizeIdentifier(e.target.value))}
                        className={`${inputClassName} ${isRelation ? 'pl-11 text-[#ff7a45]' : ''}`}
                        placeholder="e.g. name"
                      />
                    </div>
                  </div>

                  <div>
                    <p className="mb-2 text-[12px] font-mono font-bold uppercase tracking-widest text-gray-400">
                      Initial Value
                    </p>
                    <input
                      value={field.value}
                      onChange={(e) => updateFieldValue(id, field.id, e.target.value)}
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
                          updateFieldType(id, field.id, e.target.value as IndexedAttributeType)
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

                  <button
                    onClick={() => removeField(id, field.id)}
                    className="nodrag nopan mb-1 flex size-10 shrink-0 items-center justify-center rounded-xl text-gray-400 border border-gray-100 bg-white shadow-md transition hover:bg-gray-50 hover:text-red-500"
                    title={isRelation ? "Remove relation (also removes edge)" : "Remove field"}
                  >
                    <Minus className="size-4" />
                  </button>
                </div>
              );
            })}

            <Button
              size="sm"
              onClick={() => addField(id)}
              variant="outline"
              className="nodrag nopan h-12 w-full rounded-[14px] border border-dashed border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-white hover:text-gray-900 shadow-none font-mono tracking-widest uppercase text-[12px] bg-transparent"
            >
              <Plus className="mr-2 size-3.5" />
              Add Attribute
            </Button>
          </div>

          {/* ---- Entity Data ---- */}
          {isDraft ? (
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                <p className="mb-2 text-[13px] font-mono font-bold lowercase tracking-widest text-[#ff7a45] col-span-3 border-b border-gray-100 pb-2">
                  DATA FIELDS
                </p>
              </div>

              <div className="space-y-4">
                {(data.dataFields ?? []).map((df) => (
                  <div key={df.id} className="grid grid-cols-[clamp(100px,1fr,150px)_1fr_auto] items-end gap-3">
                    <div>
                      <p className="mb-2 text-[12px] font-mono font-bold uppercase tracking-widest text-gray-400">
                        Key
                      </p>
                      <input
                        value={df.key}
                        onChange={(e) => updateDataFieldKey(id, df.id, sanitizeIdentifier(e.target.value))}
                        className={inputClassName}
                        placeholder="e.g. bio"
                      />
                    </div>
                    <div>
                      <p className="mb-2 text-[12px] font-mono font-bold uppercase tracking-widest text-gray-400">
                        Value
                      </p>
                      <input
                        value={df.value}
                        onChange={(e) => updateDataFieldValue(id, df.id, e.target.value)}
                        className={inputClassName}
                        placeholder="Value…"
                      />
                    </div>
                    <button
                      onClick={() => removeDataField(id, df.id)}
                      className="nodrag nopan mb-1 flex size-10 shrink-0 items-center justify-center rounded-xl text-gray-400 border border-gray-100 bg-white shadow-md transition hover:bg-gray-50 hover:text-red-500"
                      title="Remove data field"
                    >
                      <Minus className="size-4" />
                    </button>
                  </div>
                ))}
              </div>

              <Button
                size="sm"
                onClick={() => addDataField(id)}
                variant="outline"
                className="nodrag nopan h-12 w-full rounded-[14px] border border-dashed border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-white hover:text-gray-900 shadow-none font-mono tracking-widest uppercase text-[12px] bg-transparent"
              >
                <Plus className="mr-2 size-3.5" />
                Add Data Field
              </Button>
            </div>
          ) : data.entityData ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <p className="text-[13px] font-mono font-bold lowercase tracking-widest text-[#ff7a45]">
                  ENTITY DATA
                </p>
                <p className="text-[13px] font-mono text-gray-400">
                  {data.entitySize} BYTES
                </p>
              </div>
              <EntityDataEditor entityData={data.entityData} nodeId={id} />
            </div>
          ) : null}

          {/* ---- System Attributes (persisted only, read-only) ---- */}
          {!isDraft && data.systemAttributes ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-gray-100 pb-2">
                <p className="text-[13px] font-mono font-bold lowercase tracking-widest text-[#ff7a45]">
                  SYSTEM ATTRIBUTES
                </p>
                {data.explorerUrl ? (
                  <a
                    href={data.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[13px] font-mono font-bold uppercase tracking-widest text-[#ff7a45] transition hover:text-[#ff692a]"
                  >
                    Explorer
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </div>

              <div className="space-y-4">
                {data.systemAttributes.map((attribute) => (
                  <div key={attribute.name}>
                    <p className="mb-2 text-[12px] font-mono font-bold uppercase tracking-widest text-gray-400">
                      {attribute.name}
                    </p>
                    <div className="nodrag nopan w-full rounded-[14px] border border-gray-100 bg-gray-50/50 p-4 font-mono text-sm text-gray-900 break-all">
                      {attribute.value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* ---- Actions ---- */}
          <div className="pt-2">
            {isDraft ? (
              /* Draft: Deploy to Kaolin button */
              <div className="flex flex-col gap-3">
                {hasPendingUpstream && (
                  <div className="w-full rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-mono uppercase tracking-widest text-amber-700 text-center">
                    Deploy upstream relations first
                  </div>
                )}
                <Button
                  size="sm"
                  onClick={() => deployDraft(id)}
                  disabled={!walletAvailable || !account || !isArkivKaolinChain(chainId) || deploying || hasPendingUpstream}
                  className="nodrag nopan h-14 w-full rounded-[14px] bg-[#1a1a1a] text-white font-mono tracking-widest uppercase text-xs hover:bg-[#333] transition-colors"
                >
                  {deploying ? (
                    <>
                      <Loader2 className="mr-3 size-4 animate-spin" />
                      Deploying…
                    </>
                  ) : hasPendingUpstream ? (
                    <>
                      <Rocket className="mr-3 size-4 opacity-50" />
                      Blocked
                    </>
                  ) : data.deployFailed ? (
                    <>
                      <Rocket className="mr-3 size-4" />
                      Redeploy to Arkiv Kaolin
                    </>
                  ) : (
                    <>
                      <Rocket className="mr-3 size-4" />
                      Deploy to Arkiv Kaolin
                    </>
                  )}
                </Button>
              </div>
            ) : (
              /* Persisted: Update Entity button */
               <Button
                  size="sm"
                  onClick={handleUpdate}
                  disabled={updating}
                  className={[
                    'nodrag nopan h-14 w-full rounded-[14px] text-white font-mono tracking-widest uppercase text-xs transition-colors',
                    updateSuccess
                      ? 'bg-[#1a1a1a] hover:bg-[#333]'
                      : 'bg-[#ff7a45] hover:bg-[#ff692a]',
                  ].join(' ')}
                >
                  {updating ? (
                    <>
                      <Loader2 className="mr-3 size-4 animate-spin" />
                      Updating…
                    </>
                  ) : updateSuccess ? (
                    <>
                      <CheckCircle className="mr-3 size-4" />
                      Updated!
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-3 size-4" />
                      Update Entity State
                    </>
                  )}
                </Button>
            )}
          </div>

        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!size-4 !border-[4px] !border-white !bg-[#ff7a45]"
      />
    </div>
  )
}
