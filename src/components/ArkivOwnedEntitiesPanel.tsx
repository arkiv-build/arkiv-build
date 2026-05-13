"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ExternalLink, Layers, LoaderCircle, RefreshCw, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useArkivStore } from "@/store/useArkivStore";
import type { OwnedArkivEntitySummary } from "@/lib/arkiv/types";
import type { Hex } from "viem";

const shortKey = (value: string) => `${value.slice(0, 10)}...${value.slice(-6)}`

const WALLET_PREFIX_PATTERN = /^(0x[a-fA-F0-9]{40})(?:-(.+))?$/

const splitProjectAttribute = (value: string) => {
  const match = value.trim().match(WALLET_PREFIX_PATTERN)
  if (!match) return { name: value.trim(), address: undefined as string | undefined }
  const [, address, suffix] = match
  const name = suffix?.trim()
  return {
    name: name && name.length > 0 ? name : `${address.slice(0, 6)}...${address.slice(-4)}`,
    address: name ? `${address.slice(0, 6)}...${address.slice(-4)}` : undefined,
  }
}

type RenderItem =
  | { kind: "single"; entity: OwnedArkivEntitySummary }
  | { kind: "stack"; projectAttributeValue: string; entities: OwnedArkivEntitySummary[] }

const groupEntities = (entities: OwnedArkivEntitySummary[]): RenderItem[] => {
  const buckets = new Map<string, OwnedArkivEntitySummary[]>()
  for (const entity of entities) {
    const key = entity.projectAttributeValue?.trim()
    if (!key) continue
    const existing = buckets.get(key)
    if (existing) existing.push(entity)
    else buckets.set(key, [entity])
  }

  const items: RenderItem[] = []
  const seen = new Set<string>()
  for (const entity of entities) {
    const key = entity.projectAttributeValue?.trim()
    if (!key) {
      items.push({ kind: "single", entity })
      continue
    }
    if (seen.has(key)) continue
    seen.add(key)
    const group = buckets.get(key)!
    if (group.length === 1) {
      items.push({ kind: "single", entity: group[0] })
    } else {
      items.push({ kind: "stack", projectAttributeValue: key, entities: group })
    }
  }
  return items
}

type EntityCardProps = {
  entity: OwnedArkivEntitySummary
  onLoad: (key: Hex) => void
  disabled: boolean
  showProjectAttribute?: boolean
  variant?: "default" | "project"
}

function EntityCard({ entity, onLoad, disabled, showProjectAttribute = true, variant = "default" }: EntityCardProps) {
  const containerClass =
    variant === "project"
      ? "group flex w-full items-start justify-between gap-3 rounded-xl border border-orange-200/70 bg-orange-50/50 px-4 py-4 text-left shadow-sm ring-1 ring-orange-100/60 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/10 hover:ring-[#ff7a45] hover:border-transparent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
      : "group flex w-full items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-4 text-left shadow-sm ring-1 ring-gray-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/10 hover:ring-[#ff7a45] hover:border-transparent active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"

  return (
    <button
      type="button"
      onClick={() => onLoad(entity.key)}
      disabled={!entity.compatible || disabled}
      className={containerClass}
    >
      <div className="min-w-0">
        {showProjectAttribute && entity.projectAttributeValue ? (() => {
          const parsed = splitProjectAttribute(entity.projectAttributeValue)
          return (
            <div className="min-w-0">
              {parsed.address ? (
                <p className="truncate font-mono text-[11px] text-gray-400">{parsed.address}</p>
              ) : null}
              <p className="truncate text-base font-bold text-gray-900">{parsed.name}</p>
            </div>
          )
        })() : (
          <p className="truncate text-sm font-bold text-gray-900">{entity.label}</p>
        )}
        <p className="mt-1 text-xs text-gray-600">{entity.preview}</p>
        <p className="mt-1 font-mono text-[11px] text-gray-500">{shortKey(entity.key)}</p>
        {entity.createdAtBlock ? (
          <p className="mt-1 text-[12px] text-gray-400">
            Created at block {entity.createdAtBlock}
          </p>
        ) : null}
        {entity.unsupportedReason ? (
          <p className="mt-1 text-[12px] text-rose-600">{entity.unsupportedReason}</p>
        ) : null}
      </div>

      <a
        href={entity.explorerUrl}
        target="_blank"
        rel="noreferrer"
        onClick={(event) => event.stopPropagation()}
        className="rounded-lg border border-gray-100 bg-gray-50 p-2 text-gray-400 transition-all duration-300 hover:bg-[#ff7a45] hover:text-white hover:scale-110 hover:shadow-md group-hover:border-transparent"
        aria-label="Open in Arkiv explorer"
      >
        <ExternalLink className="size-3.5" />
      </a>
    </button>
  )
}

type StackedGroupProps = {
  projectAttributeValue: string
  entities: OwnedArkivEntitySummary[]
  onLoad: (key: Hex) => void
  disabled: boolean
}

function StackedGroup({ projectAttributeValue, entities, onLoad, disabled }: StackedGroupProps) {
  const [expanded, setExpanded] = useState(false)
  const count = entities.length
  const previewLayers = Math.min(count - 1, 2)
  const parsed = splitProjectAttribute(projectAttributeValue)

  if (expanded) {
    return (
      <div className="rounded-2xl border border-orange-200/70 bg-orange-50/40 p-2.5">
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mb-2 flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-orange-100/60"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Layers className="size-3.5 shrink-0 text-[#ff7a45]" />
            <div className="min-w-0">
              {parsed.address ? (
                <p className="truncate font-mono text-[10px] text-gray-400">{parsed.address}</p>
              ) : null}
              <p className="truncate text-sm font-bold text-gray-900">{parsed.name}</p>
            </div>
            <span className="shrink-0 rounded-full bg-[#ff7a45]/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#ff7a45]">
              {count}
            </span>
          </div>
          <ChevronDown className="size-3.5 shrink-0 rotate-180 text-gray-500 transition-transform" />
        </button>
        <div className="space-y-2">
          {entities.map((entity) => (
            <EntityCard
              key={entity.key}
              entity={entity}
              onLoad={onLoad}
              disabled={disabled}
              showProjectAttribute={false}
            />
          ))}
        </div>
      </div>
    )
  }

  const top = entities[0]

  return (
    <div className="relative pb-[10px]" style={{ paddingBottom: `${previewLayers * 6 + 4}px` }}>
      {Array.from({ length: previewLayers }).map((_, index) => {
        const offset = (index + 1) * 6
        const inset = (index + 1) * 8
        const opacity = 1 - (index + 1) * 0.35
        return (
          <div
            key={index}
            aria-hidden
            className="pointer-events-none absolute rounded-xl border border-gray-200 bg-white shadow-sm"
            style={{
              top: `${offset}px`,
              left: `${inset}px`,
              right: `${inset}px`,
              bottom: `${previewLayers * 6 + 4 - offset}px`,
              opacity,
            }}
          />
        )
      })}

      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="group relative flex w-full items-start justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-4 text-left shadow-sm ring-1 ring-gray-100 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/10 hover:ring-[#ff7a45] hover:border-transparent active:scale-[0.98]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              {parsed.address ? (
                <p className="truncate font-mono text-[11px] text-gray-400">{parsed.address}</p>
              ) : null}
              <p className="truncate text-base font-bold text-gray-900">{parsed.name}</p>
            </div>
            <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-[#ff7a45]/10 px-2 py-0.5 font-mono text-[10px] font-bold text-[#ff7a45]">
              <Layers className="size-3" />
              {count}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-600">{top.preview}</p>
          <p className="mt-1 text-[12px] text-gray-500">
            {count} entities share this project
          </p>
          <p className="mt-1 text-[12px] text-gray-400">Click to expand</p>
        </div>

        <div className="rounded-lg border border-gray-100 bg-gray-50 p-2 text-gray-400 transition-all duration-300 group-hover:border-transparent group-hover:bg-[#ff7a45] group-hover:text-white">
          <ChevronDown className="size-3.5" />
        </div>
      </button>
    </div>
  )
}

export function ArkivOwnedEntitiesPanel() {
  const account = useArkivStore((state) => state.account)
  const walletAvailable = useArkivStore((state) => state.walletAvailable)
  const ownedEntities = useArkivStore((state) => state.ownedEntities)
  const loadingOwnedEntities = useArkivStore((state) => state.loadingOwnedEntities)
  const loadingSelectedEntity = useArkivStore((state) => state.loadingSelectedEntity)
  const refreshOwnedEntities = useArkivStore((state) => state.refreshOwnedEntities)
  const loadEntityIntoCanvas = useArkivStore((state) => state.loadEntityIntoCanvas)

  const renderItems = useMemo(() => groupEntities(ownedEntities), [ownedEntities])
  const { projectItems, otherItems } = useMemo(() => {
    const projectItems: RenderItem[] = []
    const otherItems: RenderItem[] = []
    for (const item of renderItems) {
      if (item.kind === "stack") projectItems.push(item)
      else if (item.entity.projectAttributeValue?.trim()) projectItems.push(item)
      else otherItems.push(item)
    }
    return { projectItems, otherItems }
  }, [renderItems])

  return (
    <div className="flex w-[24rem] min-h-0 flex-1 flex-col rounded-[16px] border border-gray-200 bg-white/80 backdrop-blur-xl p-5 shadow-2xl shadow-gray-200/50">
      <div className="flex shrink-0 items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 font-mono">
            Wallet-Owned Entities
          </p>
          <p className="mt-1 text-sm text-gray-700">
            Load entities owned by the connected wallet
          </p>
        </div>

        <Button
          variant="outline"
          size="icon-sm"
          className="rounded-xl border-gray-200 shadow-sm transition-all duration-300 hover:rotate-180 hover:bg-gray-100 hover:shadow-md"
          onClick={refreshOwnedEntities}
          disabled={!account || loadingOwnedEntities}
        >
          <RefreshCw className={`size-4 ${loadingOwnedEntities ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-[12px] border border-gray-200 bg-gray-50/50 p-3">
        {!walletAvailable ? (
          <div className="flex items-start gap-3 text-sm text-gray-600">
            <Wallet className="mt-0.5 size-4 text-gray-400" />
            MetaMask is required to browse wallet-owned Arkiv entities.
          </div>
        ) : !account ? (
          <div className="flex items-start gap-3 text-sm text-gray-600">
            <Wallet className="mt-0.5 size-4 text-gray-400" />
            Connect your wallet to fetch entities already deployed on Arkiv Braga.
          </div>
        ) : loadingOwnedEntities ? (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <LoaderCircle className="size-4 animate-spin" />
            Loading entities from Braga...
          </div>
        ) : ownedEntities.length === 0 ? (
          <p className="shrink-0 text-sm text-gray-600">
            No wallet-owned entities were found on Arkiv Braga yet.
          </p>
        ) : (
          <div className="flex-1 space-y-4 overflow-y-auto px-1 pt-2 pb-2">
            {projectItems.length > 0 ? (
              <div className="space-y-2">
                <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-[#ff7a45] font-mono">
                  With project attribute
                </p>
                {projectItems.map((item) =>
                  item.kind === "single" ? (
                    <EntityCard
                      key={item.entity.key}
                      entity={item.entity}
                      onLoad={loadEntityIntoCanvas}
                      disabled={loadingSelectedEntity}
                      variant="project"
                    />
                  ) : (
                    <StackedGroup
                      key={item.projectAttributeValue}
                      projectAttributeValue={item.projectAttributeValue}
                      entities={item.entities}
                      onLoad={loadEntityIntoCanvas}
                      disabled={loadingSelectedEntity}
                    />
                  ),
                )}
              </div>
            ) : null}

            {projectItems.length > 0 && otherItems.length > 0 ? (
              <div className="border-t border-dashed border-gray-200" />
            ) : null}

            {otherItems.length > 0 ? (
              <div className="space-y-2">
                <p className="px-1 text-[10px] font-bold uppercase tracking-wider text-gray-500 font-mono">
                  Without project attribute
                </p>
                {otherItems.map((item) =>
                  item.kind === "single" ? (
                    <EntityCard
                      key={item.entity.key}
                      entity={item.entity}
                      onLoad={loadEntityIntoCanvas}
                      disabled={loadingSelectedEntity}
                    />
                  ) : null,
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
