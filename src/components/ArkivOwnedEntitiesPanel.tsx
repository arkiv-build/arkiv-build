"use client";

import { ExternalLink, LoaderCircle, RefreshCw, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useArkivStore } from "@/store/useArkivStore";

const shortKey = (value: string) => `${value.slice(0, 10)}...${value.slice(-6)}`;

export function ArkivOwnedEntitiesPanel() {
  const account = useArkivStore((state) => state.account);
  const walletAvailable = useArkivStore((state) => state.walletAvailable);
  const ownedEntities = useArkivStore((state) => state.ownedEntities);
  const loadingOwnedEntities = useArkivStore((state) => state.loadingOwnedEntities);
  const loadingSelectedEntity = useArkivStore((state) => state.loadingSelectedEntity);
  const refreshOwnedEntities = useArkivStore((state) => state.refreshOwnedEntities);
  const loadEntityIntoCanvas = useArkivStore((state) => state.loadEntityIntoCanvas);

  return (
    <div className="w-[24rem] rounded-[28px] border border-white/70 bg-white/72 p-4 shadow-[0_25px_60px_-32px_rgba(15,23,42,0.4)] backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/72">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
            Wallet-Owned Arkiv Entities
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Load entities owned by the connected MetaMask account into the designer.
          </p>
        </div>

        <Button
          variant="outline"
          size="icon-sm"
          className="rounded-full"
          onClick={refreshOwnedEntities}
          disabled={!account || loadingOwnedEntities}
        >
          <RefreshCw className={loadingOwnedEntities ? "animate-spin" : ""} />
        </Button>
      </div>

      <div className="mt-4 rounded-[22px] border border-slate-200/70 bg-white/75 p-3 dark:border-slate-800/80 dark:bg-slate-900/75">
        {!walletAvailable ? (
          <div className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
            <Wallet className="mt-0.5 size-4 text-slate-500" />
            MetaMask is required to browse wallet-owned Arkiv entities.
          </div>
        ) : !account ? (
          <div className="flex items-start gap-3 text-sm text-slate-600 dark:text-slate-300">
            <Wallet className="mt-0.5 size-4 text-slate-500" />
            Connect your wallet to fetch entities already deployed on Arkiv Kaolin.
          </div>
        ) : loadingOwnedEntities ? (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <LoaderCircle className="size-4 animate-spin" />
            Loading entities from Kaolin...
          </div>
        ) : ownedEntities.length === 0 ? (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            No wallet-owned entities were found on Arkiv Kaolin yet.
          </p>
        ) : (
          <div className="space-y-2">
            {ownedEntities.map((entity) => (
              <button
                key={entity.key}
                type="button"
                onClick={() => loadEntityIntoCanvas(entity.key)}
                disabled={!entity.compatible || loadingSelectedEntity}
                className="flex w-full items-start justify-between gap-3 rounded-[20px] border border-slate-200/80 bg-slate-50/80 px-3 py-3 text-left transition hover:border-sky-200 hover:bg-sky-50/70 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-800/80 dark:bg-slate-950/70 dark:hover:border-sky-500/20 dark:hover:bg-sky-500/10"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {entity.label}
                    </p>
                    <span
                      className={[
                        "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em]",
                        entity.compatible
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
                      ].join(" ")}
                    >
                      {entity.compatible ? "Compatible" : "Unsupported"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                    {entity.preview}
                  </p>
                  <p className="mt-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                    {shortKey(entity.key)}
                  </p>
                  {entity.createdAtBlock ? (
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      Created at block {entity.createdAtBlock}
                    </p>
                  ) : null}
                  {entity.unsupportedReason ? (
                    <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
                      {entity.unsupportedReason}
                    </p>
                  ) : null}
                </div>

                <a
                  href={entity.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="rounded-full border border-slate-200 bg-white p-2 text-slate-500 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  aria-label="Open in Arkiv explorer"
                >
                  <ExternalLink className="size-3.5" />
                </a>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
