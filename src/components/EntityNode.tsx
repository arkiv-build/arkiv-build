'use client'

import { Handle, Position, type NodeProps } from '@xyflow/react'
import { CheckCircle, Database, ExternalLink, Link, Loader2, Minus, Plus, RefreshCw, Rocket, X } from 'lucide-react'
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
  'nodrag nopan h-10 w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 text-sm text-slate-950 shadow-[0_1px_1px_rgba(15,23,42,0.04),0_10px_30px_rgba(148,163,184,0.08)] outline-none transition duration-200 placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-500/10 disabled:cursor-not-allowed disabled:opacity-80 dark:border-slate-700/80 dark:bg-slate-900/90 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:border-sky-400 dark:focus:bg-slate-900 dark:focus:ring-sky-400/10'

const selectClassName =
  'nodrag nopan h-10 rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 text-sm font-medium text-slate-700 shadow-[0_1px_1px_rgba(15,23,42,0.04),0_10px_30px_rgba(148,163,184,0.08)] outline-none transition duration-200 focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-500/10 disabled:cursor-not-allowed disabled:opacity-80 dark:border-slate-700/80 dark:bg-slate-900/90 dark:text-slate-200 dark:focus:border-sky-400 dark:focus:bg-slate-900 dark:focus:ring-sky-400/10'

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
      <div className="space-y-2">
        {entries.map(([key, val]) => {
          const valStr = typeof val === 'object' ? JSON.stringify(val) : String(val)
          const isReadOnly =
            key === 'app' || key === 'version' || key === 'deployedAt'

          return (
            <div
              key={key}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-2 rounded-[18px] border border-white/70 bg-white/70 p-2.5 shadow-[0_8px_20px_-16px_rgba(15,23,42,0.2)] backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/55"
            >
              <p className="ml-2 truncate text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-600 dark:text-violet-400">
                {key}
              </p>
              <input
                value={valStr}
                onChange={(e) => handleValueChange(key, e.target.value)}
                disabled={isReadOnly}
                className={`${inputClassName} h-8 py-0 text-xs disabled:opacity-50`}
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
      className="nodrag nopan w-full resize-none rounded-[18px] border border-slate-200/80 bg-white/80 px-3 py-2.5 font-mono text-[11px] leading-5 text-slate-700 shadow-[0_8px_20px_-16px_rgba(15,23,42,0.2)] outline-none transition focus:border-violet-300 focus:ring-4 focus:ring-violet-500/10 dark:border-slate-800/80 dark:bg-slate-950/60 dark:text-slate-200"
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

  const estimatedExpirationBlock = estimateExpirationBlock(data.expirationDuration, blockTiming)
  const isDraft = data.mode === 'draft'
  const expirationBlockLabel = isDraft
    ? formatBlockNumber(estimatedExpirationBlock)
    : data.confirmedExpirationBlock

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
    <div className="relative min-w-[31rem]">
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-[3px] !border-white !bg-slate-400 shadow-[0_8px_18px_rgba(148,163,184,0.28)] dark:!border-slate-950 dark:!bg-slate-500"
      />

      <div
        className={[
          'overflow-hidden rounded-[30px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.94)_100%)] shadow-[0_18px_50px_-28px_rgba(15,23,42,0.38),0_2px_6px_rgba(255,255,255,0.7)_inset] backdrop-blur-xl',
          'dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(2,6,23,0.94)_100%)]',
          selected
            ? 'border-sky-300/90 ring-[6px] ring-sky-400/15 dark:border-sky-300/80 dark:ring-sky-400/15'
            : 'border-white/80 dark:border-slate-800/80',
        ].join(' ')}
      >
        {/* ------------------------------------------------------------------ Header */}
        <div className="border-b border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(248,250,252,0.55)_100%)] px-5 py-4 dark:border-slate-800/70 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.72)_0%,rgba(15,23,42,0.34)_100%)]">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 pt-1 text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
              <div className="flex size-6 items-center justify-center rounded-full bg-slate-100/90 text-slate-600 dark:bg-slate-800/90 dark:text-slate-300">
                <Database className="size-3.5" />
              </div>
              {isDraft ? 'Draft Entity' : 'Deployed Entity'}
            </div>

            <div className="flex items-start gap-3">
              <div className="w-60 space-y-2 rounded-[22px] border border-white/80 bg-white/72 p-3 shadow-[0_14px_34px_-24px_rgba(15,23,42,0.3)] backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/70">
                <p className="text-[11px] leading-4 font-medium text-slate-500 dark:text-slate-400">
                  {isDraft ? 'Estimated On-Chain Expiration Block' : 'On-Chain Expiration Block'}
                  : {expirationBlockLabel ?? ' Loading...'}
                </p>
                {isDraft ? (
                  <select
                    value={data.expirationDuration}
                    onChange={(e) =>
                      updateExpirationDuration(id, e.target.value as ExpirationDuration)
                    }
                    className={`${selectClassName} h-10 w-full`}
                  >
                    {EXPIRATION_DURATION_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2 text-sm text-slate-600 dark:border-slate-700/80 dark:bg-slate-900/80 dark:text-slate-300">
                    Fetched live from Arkiv Kaolin
                  </div>
                )}
              </div>

              <button
                onClick={() => removeNode(id)}
                className="nodrag nopan flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                title="Remove Entity"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <input
              value={data.label}
              onChange={(e) => updateEntityName(id, sanitizeIdentifier(e.target.value))}
              className={`${inputClassName} h-11 border-white/90 bg-white/88 text-lg font-semibold tracking-[-0.02em] shadow-[0_1px_1px_rgba(15,23,42,0.04),0_12px_32px_rgba(148,163,184,0.12)]`}
              placeholder="Entity name"
              disabled={!isDraft}
            />
          </div>
        </div>

        {/* ------------------------------------------------------------------ Body */}
        <div className="space-y-3 px-4 py-4">

          {/* ---- Indexed Attributes ---- */}
          <div className="space-y-2.5">
            <div className="px-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Queryable Indexed Attributes
              </p>
            </div>

            {/* Column headers */}
            {data.fields.length > 0 && (
              <div className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2 px-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  Field Name
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  Initial Value
                </p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 min-w-44">
                  Type
                </p>
                <span className="size-8" />
              </div>
            )}

            {data.fields.map((field) => {
              const isRelation = !!field.edgeId;

              return (
                <div
                  key={field.id}
                  className={[
                    'grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2 rounded-[22px] border p-2.5 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.24)] backdrop-blur transition-all',
                    isRelation
                      ? 'border-indigo-200/80 bg-indigo-50/50 dark:border-indigo-500/20 dark:bg-indigo-500/10'
                      : 'border-white/70 bg-white/70 dark:border-slate-800/80 dark:bg-slate-950/55'
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                    {isRelation ? (
                      <div className="ml-1.5 flex size-4 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/50 dark:text-indigo-400 shrink-0">
                        <Link className="size-2.5" />
                      </div>
                    ) : (
                      <span
                        className={[
                          'ml-2 size-2 rounded-full shrink-0',
                          field.type === 'indexedNumber'
                            ? 'bg-sky-400 dark:bg-sky-500'
                            : 'bg-violet-400 dark:bg-violet-500',
                        ].join(' ')}
                      />
                    )}
                    <input
                      value={field.name}
                      onChange={(e) => updateFieldName(id, field.id, sanitizeIdentifier(e.target.value))}
                      className={`${inputClassName} h-10 min-w-0 border-transparent bg-transparent px-1 shadow-none dark:bg-transparent ${isRelation ? 'font-medium text-indigo-700 dark:text-indigo-300' : ''}`}
                      placeholder="e.g. name"
                    />
                  </div>

                  <input
                    value={field.value}
                    onChange={(e) => updateFieldValue(id, field.id, e.target.value)}
                    disabled={isRelation}
                    className={`${inputClassName} h-10 min-w-0 ${isRelation && !field.value
                        ? 'text-indigo-400/70 italic dark:text-indigo-300/50'
                        : isRelation
                          ? 'text-indigo-600 font-mono text-[10px] bg-indigo-100/50 border-indigo-200/60 dark:bg-indigo-900/30 dark:border-indigo-500/30'
                          : ''
                      }`}
                    placeholder={
                      isRelation
                        ? 'Pending deployment…'
                        : field.type === 'indexedNumber'
                          ? '0'
                          : 'Initial value…'
                    }
                    inputMode={field.type === 'indexedNumber' ? 'decimal' : 'text'}
                  />

                  <select
                    value={field.type}
                    onChange={(e) =>
                      updateFieldType(id, field.id, e.target.value as IndexedAttributeType)
                    }
                    className={`${selectClassName} h-10 min-w-44 disabled:opacity-60`}
                    disabled={isRelation}
                  >
                    <option value="indexedString">String</option>
                    <option value="indexedNumber">Number</option>
                  </select>

                  <button
                    onClick={() => removeField(id, field.id)}
                    className="nodrag nopan flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
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
              className="nodrag nopan h-9 w-full rounded-[18px] border-dashed border-slate-300 bg-white/60 text-slate-600 shadow-none hover:border-slate-400 hover:bg-white dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              <Plus className="mr-1 size-3.5" />
              Add Field
            </Button>
          </div>

          {/* ---- Entity Data ---- */}
          {isDraft ? (
            <div className="rounded-[24px] border border-violet-100/80 bg-violet-50/70 p-3.5 shadow-[0_14px_34px_-24px_rgba(139,92,246,0.2)] dark:border-violet-500/15 dark:bg-violet-500/8">
              <div className="mb-2.5 px-1">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-violet-700 dark:text-violet-300">
                  Initial Entity Data
                </p>
                <p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                  JSON payload stored on-chain with this entity.
                </p>
              </div>

              {/* Column headers */}
              {(data.dataFields ?? []).length > 0 && (
                <div className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 px-3 mb-1">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-400 dark:text-violet-500">
                    Key
                  </p>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-violet-400 dark:text-violet-500">
                    Value
                  </p>
                  <span className="size-8" />
                </div>
              )}

              <div className="space-y-2">
                {(data.dataFields ?? []).map((df) => (
                  <div
                    key={df.id}
                    className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 rounded-[20px] border border-white/70 bg-white/70 p-2.5 shadow-[0_12px_30px_-20px_rgba(139,92,246,0.18)] backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/55"
                  >
                    <input
                      value={df.key}
                      onChange={(e) => updateDataFieldKey(id, df.id, sanitizeIdentifier(e.target.value))}
                      className={`${inputClassName} h-10 min-w-0`}
                      placeholder="e.g. bio"
                    />
                    <input
                      value={df.value}
                      onChange={(e) => updateDataFieldValue(id, df.id, e.target.value)}
                      className={`${inputClassName} h-10 min-w-0`}
                      placeholder="Value…"
                    />
                    <button
                      onClick={() => removeDataField(id, df.id)}
                      className="nodrag nopan flex size-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10 dark:hover:text-red-400"
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
                className="nodrag nopan mt-2 h-9 w-full rounded-[18px] border-dashed border-violet-300 bg-white/60 text-violet-600 shadow-none hover:border-violet-400 hover:bg-white dark:border-violet-700 dark:bg-slate-900/50 dark:text-violet-300 dark:hover:bg-slate-900"
              >
                <Plus className="mr-1 size-3.5" />
                Add Data Field
              </Button>
            </div>
          ) : data.entityData ? (
            <div className="rounded-[24px] border border-violet-100/80 bg-violet-50/70 p-3.5 shadow-[0_14px_34px_-24px_rgba(139,92,246,0.2)] dark:border-violet-500/15 dark:bg-violet-500/8">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-violet-700 dark:text-violet-300">
                  Entity Data
                </p>
                <p className="text-[11px] font-medium text-slate-500">
                  {data.entitySize} bytes
                </p>
              </div>
              <EntityDataEditor entityData={data.entityData} nodeId={id} />
            </div>
          ) : null}

          {/* ---- System Attributes (persisted only, read-only) ---- */}
          {!isDraft && data.systemAttributes ? (
            <div className="rounded-[24px] border border-sky-100/80 bg-sky-50/70 p-3.5 shadow-[0_14px_34px_-24px_rgba(14,165,233,0.2)] dark:border-sky-500/15 dark:bg-sky-500/8">
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-sky-700 dark:text-sky-300">
                    Automatic System Attributes (On-Chain)
                  </p>
                  {data.explorerUrl ? (
                    <a
                      href={data.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-700 transition hover:text-sky-900 dark:text-sky-300 dark:hover:text-sky-100"
                    >
                      Explorer
                      <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </div>
                <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                  These values are fetched directly from the Arkiv network for this entity.
                </p>
              </div>

              <div className="mt-3 space-y-2">
                {data.systemAttributes.map((attribute) => (
                  <div
                    key={attribute.name}
                    className="rounded-[20px] border border-white/80 bg-white/78 px-3 py-2.5 shadow-[0_10px_24px_-20px_rgba(15,23,42,0.3)] dark:border-slate-800/80 dark:bg-slate-950/60"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                      {attribute.name}
                    </p>
                    <p className="mt-1 break-all font-mono text-xs leading-5 text-slate-700 dark:text-slate-200">
                      {attribute.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* ---- Actions ---- */}
          {isDraft ? (
            /* Draft: Deploy to Kaolin button */
            <div className="space-y-2">
              {hasPendingUpstream && (
                <div className="rounded-[18px] border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400 text-center">
                  Deploy upstream relations first
                </div>
              )}
              <Button
                size="sm"
                onClick={() => deployDraft(id)}
                disabled={!walletAvailable || !account || !isArkivKaolinChain(chainId) || deploying || hasPendingUpstream}
                className="nodrag nopan h-11 w-full rounded-[22px] border border-transparent bg-slate-950 text-white shadow-[0_18px_40px_-22px_rgba(15,23,42,0.7)] transition duration-200 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200"
              >
                {deploying ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Deploying…
                  </>
                ) : hasPendingUpstream ? (
                  <>
                    <Rocket className="mr-2 size-4 opacity-50" />
                    Blocked by Upstream
                  </>
                ) : (
                  <>
                    <Rocket className="mr-2 size-4" />
                    Deploy to Kaolin
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
                'nodrag nopan h-11 w-full rounded-[22px] border border-transparent shadow-[0_18px_40px_-22px_rgba(15,23,42,0.7)] transition duration-200',
                updateSuccess
                  ? 'bg-emerald-600 text-white hover:bg-emerald-500 dark:bg-emerald-600 dark:hover:bg-emerald-500'
                  : 'bg-violet-600 text-white hover:bg-violet-500 dark:bg-violet-600 dark:hover:bg-violet-500',
              ].join(' ')}
            >
              {updating ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Updating on Arkiv…
                </>
              ) : updateSuccess ? (
                <>
                  <CheckCircle className="mr-2 size-4" />
                  Updated!
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 size-4" />
                  Update Entity on Arkiv
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-[3px] !border-white !bg-sky-500 shadow-[0_8px_18px_rgba(14,165,233,0.28)] dark:!border-slate-950"
      />
    </div>
  )
}
