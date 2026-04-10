"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Database, ExternalLink, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { estimateExpirationBlock, formatBlockNumber } from "@/lib/arkiv/mappers";
import { EXPIRATION_DURATION_OPTIONS, type ExpirationDuration, type IndexedAttributeType } from "@/lib/arkiv/types";
import { useArkivStore } from "@/store/useArkivStore";
import { useSchemaStore, type SchemaNode } from "@/store/useSchemaStore";

const inputClassName =
  "nodrag nopan h-10 w-full rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 text-sm text-slate-950 shadow-[0_1px_1px_rgba(15,23,42,0.04),0_10px_30px_rgba(148,163,184,0.08)] outline-none transition duration-200 placeholder:text-slate-400 focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-500/10 disabled:cursor-not-allowed disabled:opacity-80 dark:border-slate-700/80 dark:bg-slate-900/90 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:border-sky-400 dark:focus:bg-slate-900 dark:focus:ring-sky-400/10";

const selectClassName =
  "nodrag nopan h-10 rounded-2xl border border-slate-200/80 bg-white/90 px-3.5 text-sm font-medium text-slate-700 shadow-[0_1px_1px_rgba(15,23,42,0.04),0_10px_30px_rgba(148,163,184,0.08)] outline-none transition duration-200 focus:border-sky-300 focus:bg-white focus:ring-4 focus:ring-sky-500/10 disabled:cursor-not-allowed disabled:opacity-80 dark:border-slate-700/80 dark:bg-slate-900/90 dark:text-slate-200 dark:focus:border-sky-400 dark:focus:bg-slate-900 dark:focus:ring-sky-400/10";

export function EntityNode({ id, data, selected }: NodeProps<SchemaNode>) {
  const updateEntityName = useSchemaStore((state) => state.updateEntityName);
  const updateExpirationDuration = useSchemaStore(
    (state) => state.updateExpirationDuration,
  );
  const addField = useSchemaStore((state) => state.addField);
  const updateFieldName = useSchemaStore((state) => state.updateFieldName);
  const updateFieldValue = useSchemaStore((state) => state.updateFieldValue);
  const updateFieldType = useSchemaStore((state) => state.updateFieldType);
  const blockTiming = useArkivStore((state) => state.blockTiming);
  const estimatedExpirationBlock = estimateExpirationBlock(
    data.expirationDuration,
    blockTiming,
  );
  const isDraft = data.mode === "draft";
  const expirationBlockLabel = isDraft
    ? formatBlockNumber(estimatedExpirationBlock)
    : data.confirmedExpirationBlock;

  return (
    <div className="relative min-w-[31rem]">
      <Handle
        type="target"
        position={Position.Left}
        className="!size-3 !border-[3px] !border-white !bg-slate-400 shadow-[0_8px_18px_rgba(148,163,184,0.28)] dark:!border-slate-950 dark:!bg-slate-500"
      />

      <div
        className={[
          "overflow-hidden rounded-[30px] border bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(248,250,252,0.94)_100%)] shadow-[0_18px_50px_-28px_rgba(15,23,42,0.38),0_2px_6px_rgba(255,255,255,0.7)_inset] backdrop-blur-xl",
          "dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96)_0%,rgba(2,6,23,0.94)_100%)]",
          selected
            ? "border-sky-300/90 ring-[6px] ring-sky-400/15 dark:border-sky-300/80 dark:ring-sky-400/15"
            : "border-white/80 dark:border-slate-800/80",
        ].join(" ")}
      >
        <div className="border-b border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(248,250,252,0.55)_100%)] px-5 py-4 dark:border-slate-800/70 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.72)_0%,rgba(15,23,42,0.34)_100%)]">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div className="flex items-center gap-2 pt-1 text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
              <div className="flex size-6 items-center justify-center rounded-full bg-slate-100/90 text-slate-600 dark:bg-slate-800/90 dark:text-slate-300">
                <Database className="size-3.5" />
              </div>
              Entity
            </div>

            <div className="w-60 space-y-2 rounded-[22px] border border-white/80 bg-white/72 p-3 shadow-[0_14px_34px_-24px_rgba(15,23,42,0.3)] backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/70">
              <p className="text-[11px] leading-4 font-medium text-slate-500 dark:text-slate-400">
                {isDraft
                  ? "Estimated On-Chain Expiration Block"
                  : "On-Chain Expiration Block"}
                : {expirationBlockLabel ?? " Loading..."}
              </p>
              {isDraft ? (
                <select
                  value={data.expirationDuration}
                  onChange={(event) =>
                    updateExpirationDuration(
                      id,
                      event.target.value as ExpirationDuration,
                    )
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
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <input
              value={data.label}
              onChange={(event) => updateEntityName(id, event.target.value)}
              className={`${inputClassName} h-11 border-white/90 bg-white/88 text-lg font-semibold tracking-[-0.02em] shadow-[0_1px_1px_rgba(15,23,42,0.04),0_12px_32px_rgba(148,163,184,0.12)]`}
              placeholder="Entity name"
              disabled={!isDraft}
            />
          </div>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div className="space-y-2.5">
            <div className="px-1">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                Queryable Indexed Attributes
              </p>
            </div>
            {data.fields.map((field) => (
              <div
                key={field.id}
                className="grid grid-cols-[1fr_1fr_auto] items-center gap-2 rounded-[22px] border border-white/70 bg-white/70 p-2.5 shadow-[0_12px_30px_-20px_rgba(15,23,42,0.24)] backdrop-blur dark:border-slate-800/80 dark:bg-slate-950/55"
              >
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200">
                  <span
                    className={[
                      "ml-2 size-2 rounded-full",
                      field.type === "indexedNumber"
                        ? "bg-sky-400 dark:bg-sky-500"
                        : "bg-violet-400 dark:bg-violet-500",
                    ].join(" ")}
                  />
                  <input
                    value={field.name}
                    onChange={(event) => updateFieldName(id, field.id, event.target.value)}
                    className={`${inputClassName} h-10 min-w-0 border-transparent bg-transparent px-1 shadow-none dark:bg-transparent`}
                    placeholder="Field name"
                    disabled={!isDraft}
                  />
                </div>

                <input
                  value={field.value}
                  onChange={(event) => updateFieldValue(id, field.id, event.target.value)}
                  className={`${inputClassName} h-10 min-w-0`}
                  placeholder={field.type === "indexedNumber" ? "123" : "Field value"}
                  disabled={!isDraft}
                  inputMode={field.type === "indexedNumber" ? "decimal" : "text"}
                />

                <select
                  value={field.type}
                  onChange={(event) =>
                    updateFieldType(id, field.id, event.target.value as IndexedAttributeType)
                  }
                  className={`${selectClassName} h-10 min-w-52`}
                  disabled={!isDraft}
                >
                  <option value="indexedString">Indexed String Attribute</option>
                  <option value="indexedNumber">Indexed Number Attribute</option>
                </select>
              </div>
            ))}
          </div>

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

          {isDraft ? (
            <Button
              size="sm"
              onClick={() => addField(id)}
              className="nodrag nopan h-11 w-full rounded-[22px] border border-transparent bg-slate-950 text-white shadow-[0_18px_40px_-22px_rgba(15,23,42,0.7)] transition duration-200 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-white"
            >
              <Plus className="size-4" />
              New Field
            </Button>
          ) : (
            <div className="rounded-[22px] border border-slate-200/80 bg-white/78 px-4 py-3 text-sm text-slate-600 dark:border-slate-800/80 dark:bg-slate-950/60 dark:text-slate-300">
              This entity is loaded from Arkiv and shown read-only in the designer.
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!size-3 !border-[3px] !border-white !bg-sky-500 shadow-[0_8px_18px_rgba(14,165,233,0.28)] dark:!border-slate-950"
      />
    </div>
  );
}
